import { Router } from 'express';
import { getUsageSummary } from '../claude/usage-tracker.js';

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
 * Returns today's API usage stats. No auth required — it's just counters.
 */
router.get('/api/usage', (_req, res) => {
  res.json(getUsageSummary());
});

export default router;
