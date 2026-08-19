import { Router } from 'express';
import { getUsageSummary } from '../claude/usage-tracker.js';
import { getGoogleUsageSummary } from '../cm360/google-usage-tracker.js';
import { requireAuth } from '../auth/middleware.js';
import { featureFlagsMiddleware } from '../feature-flags/flag-middleware.js';

const router = Router();

/**
 * GET /usage
 * Returns today's API usage stats. Auth required to prevent exposure of usage data.
 * Mounted under /api/v1 prefix → final path: /api/v1/usage
 *
 * Response shape: the top-level fields are Claude API usage (backward compatible),
 * plus a `google` object with today's outbound CM360 API request count.
 */
router.get('/usage', requireAuth, featureFlagsMiddleware, async (req, res) => {
  const [claude, google] = await Promise.all([
    getUsageSummary(req.user!.userId),
    getGoogleUsageSummary(),
  ]);
  res.json({ ...claude, google });
});

export default router;
