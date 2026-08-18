import { Router } from 'express';
import { metricsRegistry } from '../lib/metrics.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * GET /metrics — Prometheus-compatible metrics endpoint.
 *
 * Returns all registered metrics in Prometheus text exposition format.
 * Unauthenticated by design — Prometheus scrapers typically don't carry auth tokens.
 * In production, restrict access via network policy or reverse proxy rules.
 */
router.get('/metrics', async (_req, res) => {
  try {
    const metrics = await metricsRegistry.metrics();
    res.set('Content-Type', metricsRegistry.contentType);
    res.send(metrics);
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to collect metrics');
    res.status(500).end();
  }
});

export default router;
