/**
 * Google OAuth2 routes for CM360 account connection.
 *
 * Flow:
 *   1. GET /connect    — Generate Google auth URL (requires JWT auth)
 *   2. GET /callback   — Handle Google's redirect with auth code
 *   3. GET /status     — Check CM360 connection status (requires JWT auth)
 *   4. POST /disconnect — Revoke tokens and delete from DB (requires JWT auth)
 *
 * CSRF protection: The `state` parameter carries an HMAC-signed payload
 * containing a random nonce + userId. This is stateless and requires no DB cleanup.
 */

import { Router } from 'express';
import crypto, { randomBytes, createHmac } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../auth/middleware.js';
import { encrypt, decrypt } from '../auth/crypto.js';
import { LIVE_ACK_PHRASE, LIVE_ACK_WARNING_TEXT, getAppVersion } from '../cm360/live-acknowledgment.js';
import { db, schema } from '../db/index.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { featureFlagsMiddleware } from '../feature-flags/flag-middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

const CM360_SCOPES = [
  'https://www.googleapis.com/auth/dfatrafficking',
  'https://www.googleapis.com/auth/dfareporting',
];

// Rate limit OAuth routes: 5 requests per minute per IP
const oauthLimiter = createRateLimiter({ name: 'oauth', windowMs: 60_000, maxRequests: 5 });

/** Get the HMAC secret for state signing. Prefers dedicated OAUTH_STATE_SECRET, falls back to JWT_SECRET. */
function getHmacSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error('OAUTH_STATE_SECRET or JWT_SECRET is required for OAuth state signing');
  return secret;
}

/** Create a new OAuth2Client instance. */
function createOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

/**
 * Sign a state payload with HMAC-SHA256.
 * Payload format: base64url({nonce, userId}) + "." + hmac_signature
 */
/** Maximum age of a signed OAuth state, bounding replay of a captured value. */
const MAX_STATE_AGE_MS = 10 * 60 * 1000; // 10 minutes

function signState(userId: string): string {
  const nonce = randomBytes(32).toString('hex');
  const payload = Buffer.from(JSON.stringify({ nonce, userId, iat: Date.now() })).toString('base64url');
  const hmac = createHmac('sha256', getHmacSecret()).update(payload).digest('base64url');
  return `${payload}.${hmac}`;
}

/**
 * Verify and extract a signed state parameter.
 * Returns the userId if valid, null if tampered.
 */
function verifyState(state: string): { userId: string } | null {
  const [payload, signature] = state.split('.');
  if (!payload || !signature) return null;

  // Constant-time HMAC comparison so response timing does not leak how much of a
  // forged signature is correct.
  const expected = createHmac('sha256', getHmacSecret()).update(payload).digest('base64url');
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      userId?: unknown;
      nonce?: unknown;
      iat?: unknown;
    };
    if (typeof data.userId !== 'string' || typeof data.nonce !== 'string') return null;
    // Reject expired states to bound replay of a captured value.
    if (typeof data.iat !== 'number' || Date.now() - data.iat > MAX_STATE_AGE_MS) return null;
    return { userId: data.userId };
  } catch {
    return null;
  }
}

/** Has this user ever typed the live-CM360 acknowledgment? */
async function hasLiveAcknowledgment(userId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(schema.cm360LiveAcknowledgments)
    .where(eq(schema.cm360LiveAcknowledgments.userId, userId));
  return rows.length > 0;
}

/**
 * GET /api/v1/auth/google/acknowledgment
 *
 * Returns the typed-acknowledgment requirements for the live CM360 connect
 * flow: the exact phrase to type, the warning text to display, and whether
 * this user has already acknowledged.
 */
router.get('/auth/google/acknowledgment', requireAuth, featureFlagsMiddleware, async (req, res) => {
  const acknowledged = await hasLiveAcknowledgment(req.user!.userId);
  res.json({
    acknowledged,
    phrase: LIVE_ACK_PHRASE,
    warningText: LIVE_ACK_WARNING_TEXT,
  });
});

/**
 * POST /api/v1/auth/google/acknowledge
 *
 * Records that the user typed the unverified-live-path warning phrase.
 * The typed phrase must match LIVE_ACK_PHRASE exactly (whitespace-trimmed,
 * case-sensitive). Persists userId, timestamp, app version, and the exact
 * warning text shown — an append-only liability record (DISCLAIMER.md).
 */
router.post('/auth/google/acknowledge', oauthLimiter, requireAuth, featureFlagsMiddleware, async (req, res) => {
  const body = req.body as { acknowledgment?: unknown };
  const typed = typeof body.acknowledgment === 'string' ? body.acknowledgment.trim() : '';

  if (typed !== LIVE_ACK_PHRASE) {
    res.status(400).json({
      error: `The acknowledgment must be typed exactly: "${LIVE_ACK_PHRASE}"`,
    });
    return;
  }

  await db.insert(schema.cm360LiveAcknowledgments).values({
    id: crypto.randomUUID(),
    userId: req.user!.userId,
    acknowledgedPhrase: typed,
    warningText: LIVE_ACK_WARNING_TEXT,
    appVersion: getAppVersion(),
    createdAt: new Date(),
  });

  res.json({ acknowledged: true });
});

/**
 * GET /api/v1/auth/google/connect
 *
 * Generate a Google OAuth authorization URL and return it.
 * The frontend redirects the user's browser to this URL.
 *
 * Gated: the user must first have typed the live-CM360 acknowledgment
 * (POST /auth/google/acknowledge) — otherwise 428 Precondition Required.
 */
router.get('/auth/google/connect', oauthLimiter, requireAuth, featureFlagsMiddleware, async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    res.status(503).json({
      error: 'Google OAuth is not configured. Contact support.',
    });
    return;
  }

  if (!(await hasLiveAcknowledgment(req.user!.userId))) {
    res.status(428).json({
      error: 'Live CM360 acknowledgment required. Type the unverified-live-path acknowledgment before connecting.',
    });
    return;
  }

  const oauth2Client = createOAuth2Client();
  const state = signState(req.user!.userId);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',   // Get refresh token
    prompt: 'consent',         // Force consent to guarantee refresh token
    scope: CM360_SCOPES,
    state,
  });

  res.json({ url: authUrl });
});

/**
 * GET /api/v1/auth/google/callback
 *
 * Handles Google's redirect with the authorization code.
 * Exchanges the code for tokens, encrypts and stores them,
 * then redirects to the webapp Settings page.
 */
router.get('/auth/google/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  // Handle user denying consent
  if (oauthError) {
    const webappUrl = process.env.WEBAPP_URL ?? 'http://localhost:5173';
    res.redirect(`${webappUrl}/settings?cm360=denied`);
    return;
  }

  if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
    res.status(400).json({ error: 'Missing authorization code or state parameter' });
    return;
  }

  // Verify CSRF state
  const stateData = verifyState(state);
  if (!stateData) {
    res.status(403).json({ error: 'Invalid or tampered OAuth state. Please try again.' });
    return;
  }

  const { userId } = stateData;

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      const webappUrl = process.env.WEBAPP_URL ?? 'http://localhost:5173';
      res.redirect(`${webappUrl}/settings?cm360=error`);
      return;
    }

    // Verify granted scopes include both required scopes
    const grantedScopes = (tokens.scope ?? '').split(' ');
    const missingScopes = CM360_SCOPES.filter(s => !grantedScopes.includes(s));
    if (missingScopes.length > 0) {
      const webappUrl = process.env.WEBAPP_URL ?? 'http://localhost:5173';
      res.redirect(`${webappUrl}/settings?cm360=error`);
      return;
    }

    // Encrypt tokens
    const encryptedAccess = encrypt(tokens.access_token);
    const encryptedRefresh = encrypt(tokens.refresh_token);

    const now = new Date();
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(now.getTime() + 3600_000);

    // Upsert — one row per user (userId is unique)
    const existing = await db
      .select({ id: schema.oauthTokens.id })
      .from(schema.oauthTokens)
      .where(eq(schema.oauthTokens.userId, userId));

    if (existing.length > 0) {
      await db.update(schema.oauthTokens)
        .set({
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          expiresAt,
          scopes: tokens.scope ?? CM360_SCOPES.join(' '),
          updatedAt: now,
        })
        .where(eq(schema.oauthTokens.userId, userId));
    } else {
      await db.insert(schema.oauthTokens)
        .values({
          id: crypto.randomUUID(),
          userId,
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          expiresAt,
          scopes: tokens.scope ?? CM360_SCOPES.join(' '),
          createdAt: now,
          updatedAt: now,
        });
    }

    const webappUrl = process.env.WEBAPP_URL ?? 'http://localhost:5173';
    res.redirect(`${webappUrl}/settings?cm360=connected`);
  } catch (err) {
    logger.error({ err: { message: err instanceof Error ? err.message : 'Unknown error' } }, '[oauth] Token exchange failed');
    const webappUrl = process.env.WEBAPP_URL ?? 'http://localhost:5173';
    res.redirect(`${webappUrl}/settings?cm360=error`);
  }
});

/**
 * GET /api/v1/auth/google/status
 *
 * Returns the current CM360 connection status for the authenticated user.
 */
router.get('/auth/google/status', requireAuth, featureFlagsMiddleware, async (req, res) => {
  const rows = await db
    .select()
    .from(schema.oauthTokens)
    .where(eq(schema.oauthTokens.userId, req.user!.userId));

  if (rows.length === 0) {
    res.json({ connected: false });
    return;
  }

  const token = rows[0]!;
  res.json({
    connected: true,
    scopes: token.scopes.split(/[, ]+/),
    expiresAt: token.expiresAt.toISOString(),
  });
});

/**
 * POST /api/v1/auth/google/disconnect
 *
 * Revoke CM360 tokens at Google and delete them from our database.
 */
router.post('/auth/google/disconnect', oauthLimiter, requireAuth, featureFlagsMiddleware, async (req, res) => {
  const rows = await db
    .select()
    .from(schema.oauthTokens)
    .where(eq(schema.oauthTokens.userId, req.user!.userId));

  if (rows.length === 0) {
    res.json({ disconnected: true });
    return;
  }

  const token = rows[0]!;

  // Best-effort revocation at Google
  try {
    const accessToken = decrypt(token.accessToken);
    const oauth2Client = createOAuth2Client();
    await oauth2Client.revokeToken(accessToken);
  } catch {
    // Revocation failure is not critical — the tokens still get deleted locally
  }

  // Delete from our DB
  await db.delete(schema.oauthTokens)
    .where(eq(schema.oauthTokens.userId, req.user!.userId));

  res.json({ disconnected: true });
});

export default router;
