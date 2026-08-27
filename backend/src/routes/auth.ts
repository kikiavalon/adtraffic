import { Router } from 'express';
import { z } from 'zod';
import { register, login, getUserById, isBootstrapNeeded } from '../auth/auth-service.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { requireAuth } from '../auth/middleware.js';
import { setAuthCookie, clearAuthCookie } from '../auth/cookies.js';

const router = Router();

const loginLimiter = createRateLimiter({ name: 'login', windowMs: 60_000, maxRequests: 10 });
const registerLimiter = createRateLimiter({ name: 'register', windowMs: 60_000, maxRequests: 5 });

const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must not exceed 128 characters'),
  name: z.string().min(1, 'Name is required').max(200),
  // Optional: only the bootstrap admin supplies this, and it becomes the
  // telemetry identity (see auth-service.register). Ignored for later users.
  agency: z.string().trim().max(120).optional(),
});

const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

router.post('/auth/register', registerLimiter, async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  // Self-registration is open only on a fresh instance (the bootstrap admin), or
  // when the operator opts in with ALLOW_OPEN_REGISTRATION=true. Otherwise an
  // admin adds users from the Team screen.
  if (!(await isBootstrapNeeded()) && process.env.ALLOW_OPEN_REGISTRATION !== 'true') {
    res.status(403).json({ error: 'Registration is closed. Ask your workspace admin to add you.' });
    return;
  }

  try {
    const result = await register(parsed.data.email, parsed.data.password, parsed.data.name, parsed.data.agency);
    setAuthCookie(res, result.token);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Email already registered') {
      // Return generic message to prevent email enumeration (CWE-209)
      res.status(409).json({ error: 'Registration failed' });
      return;
    }
    throw error;
  }
});

router.post('/auth/login', loginLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  try {
    const result = await login(parsed.data.email, parsed.data.password);
    setAuthCookie(res, result.token);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid email or password') {
      res.status(401).json({ error: error.message });
      return;
    }
    if (error instanceof Error && error.message === 'Account deactivated') {
      res.status(403).json({ error: 'Your account has been deactivated. Contact your workspace admin.' });
      return;
    }
    throw error;
  }
});

/**
 * GET /auth/me
 *
 * Returns the authenticated user's profile. The webapp calls this on load to
 * rehydrate its session, since the JWT lives in an httpOnly cookie the client
 * cannot read. Returns 401 when no valid session cookie or Bearer token is present.
 */
router.get('/auth/me', requireAuth, async (req, res) => {
  const user = await getUserById(req.user!.userId);
  if (!user) {
    // Token is valid but the account no longer exists — clear the stale cookie.
    clearAuthCookie(res);
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  res.json({ user });
});

/**
 * POST /auth/logout
 *
 * Clears the session cookie. Intentionally does not require authentication so it
 * still works with an expired cookie; clearing a cookie is harmless without one.
 */
router.post('/auth/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

export default router;
