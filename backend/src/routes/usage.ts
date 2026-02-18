import { Router } from 'express';
import { getUsageSummary } from '../claude/usage-tracker.js';
import { requireAuth } from '../auth/middleware.js';

const router = Router();

/**
 * GET /usage
 * Returns today's API usage stats. Auth required to prevent exposure of usage data.
 * Mounted under /api/v1 prefix → final path: /api/v1/usage
 */
router.get('/usage', requireAuth, (_req, res) => {
  res.json(getUsageSummary());
});

export default router;
