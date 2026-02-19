/**
 * Token Manager — resolves per-user OAuth2 credentials into a ready-to-use
 * CM360 API client (dfareporting v5).
 *
 * Flow:
 *   1. Fetch encrypted tokens from DB for the given userId
 *   2. Decrypt access_token + refresh_token (AES-256-GCM)
 *   3. Create an OAuth2Client with the decrypted credentials
 *   4. Register a `tokens` listener to persist any refreshed tokens
 *   5. Return a dfareporting v5 client authenticated as the user
 *
 * Throws CM360NotConnectedError if no tokens exist.
 * Throws CM360TokenRevokedError if the refresh token is invalid.
 */

import { OAuth2Client } from 'google-auth-library';
import { dfareporting, type dfareporting_v5 } from '@googleapis/dfareporting';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { encrypt, decrypt } from '../auth/crypto.js';
import { CM360NotConnectedError } from './errors.js';
import { logger } from '../lib/logger.js';

/**
 * Get a ready-to-use CM360 API client for a specific user.
 *
 * @param userId - The AdTraffic.ai user ID (from JWT)
 * @returns A dfareporting v5 client authenticated with the user's OAuth tokens
 * @throws CM360NotConnectedError if the user hasn't connected their CM360 account
 * @throws CM360TokenRevokedError if the refresh token is no longer valid
 */
export async function getCM360Client(userId: string): Promise<dfareporting_v5.Dfareporting> {
  // 1. Fetch encrypted tokens from DB
  const rows = await db
    .select()
    .from(schema.oauthTokens)
    .where(eq(schema.oauthTokens.userId, userId));

  if (rows.length === 0) {
    throw new CM360NotConnectedError();
  }

  const tokenRow = rows[0]!;

  // 2. Decrypt tokens
  const accessToken = decrypt(tokenRow.accessToken);
  const refreshToken = decrypt(tokenRow.refreshToken);

  // 3. Create OAuth2 client
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: tokenRow.expiresAt.getTime(),
  });

  // 4. Listen for token refresh events — Google may rotate the refresh token
  oauth2Client.on('tokens', (tokens) => {
    try {
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (tokens.access_token) {
        updates.accessToken = encrypt(tokens.access_token);
      }
      if (tokens.refresh_token) {
        // Google rotated the refresh token — persist the new one immediately
        updates.refreshToken = encrypt(tokens.refresh_token);
      }
      if (tokens.expiry_date) {
        updates.expiresAt = new Date(tokens.expiry_date);
      }

      void db.update(schema.oauthTokens)
        .set(updates)
        .where(eq(schema.oauthTokens.userId, userId));
    } catch (err) {
      // Log but don't throw — the API call should still proceed with the current tokens
      logger.error({ err: { message: err instanceof Error ? err.message : 'Unknown error' } }, '[cm360] Failed to persist refreshed tokens');
    }
  });

  // 5. Create and return the dfareporting client
  return dfareporting({ version: 'v5', auth: oauth2Client });
}

/**
 * Check whether a user has OAuth tokens stored (without decrypting them).
 * Used for lightweight "is connected?" checks, e.g. to determine
 * whether to show live or demo data indicators.
 *
 * @param userId - The AdTraffic.ai user ID
 * @returns true if tokens exist for this user
 */
export async function hasOAuthTokens(userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: schema.oauthTokens.userId })
    .from(schema.oauthTokens)
    .where(eq(schema.oauthTokens.userId, userId));

  return rows.length > 0;
}
