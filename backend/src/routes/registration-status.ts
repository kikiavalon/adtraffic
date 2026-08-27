import { Router } from 'express';
import { isBootstrapNeeded } from '../auth/auth-service.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { logger } from '../lib/logger.js';

const router = Router();

const statusLimiter = createRateLimiter({ name: 'registration-status', windowMs: 60_000, maxRequests: 100 });

/**
 * GET /api/v1/auth/registration-status  (public, unauthenticated)
 *
 * The auth screens read this on load to decide:
 *  - needsBootstrap: no users yet → show the "create the agency admin" signup
 *  - registrationOpen: whether public self-registration is currently allowed
 *
 * A fresh instance is always open (someone has to create the first account).
 * Once the admin exists, registration is closed unless the operator opts back
 * in with ALLOW_OPEN_REGISTRATION=true. Returns no user data.
 */
router.get('/auth/registration-status', statusLimiter, async (_req, res) => {
  try {
    const needsBootstrap = await isBootstrapNeeded();
    const registrationOpen = needsBootstrap || process.env.ALLOW_OPEN_REGISTRATION === 'true';
    res.json({ needsBootstrap, registrationOpen });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' } },
      'Error resolving registration status',
    );
    res.status(500).json({ error: 'Failed to resolve registration status' });
  }
});

export default router;
