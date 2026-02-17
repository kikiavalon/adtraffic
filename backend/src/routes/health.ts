import { Router } from 'express';
import { getUsageSummary } from '../claude/usage-tracker.js';
import { requireAuth } from '../auth/middleware.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'adtraffic-backend',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/usage
 * Returns today's API usage stats. Auth required to prevent exposure of usage data.
 */
router.get('/api/usage', requireAuth, (_req, res) => {
  res.json(getUsageSummary());
});

export default router;
