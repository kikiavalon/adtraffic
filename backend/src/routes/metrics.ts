import { Router, type Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { metricsRegistry } from '../lib/metrics.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Rate-limit /metrics so a set METRICS_TOKEN cannot be brute-forced. 60/min per IP
// is generous for a Prometheus scraper (typically ~4/min) while capping guesses.
const metricsLimiter = createRateLimiter({ name: 'metrics', windowMs: 60_000, maxRequests: 60 });

/**
 * Authorize a /metrics request. If METRICS_TOKEN is set, require it as a bearer
 * token (constant-time compared); if it is unset the endpoint stays open — the
 * default, network-policy-protected model below. This lets an operator who cannot
 * isolate the endpoint at the network layer lock it down with a token instead
 * (Prometheus supports `bearer_token` in its scrape config).
 */
function metricsTokenAuthorized(req: Request): boolean {
  const required = process.env.METRICS_TOKEN;
  if (!required) return true;

  const header = req.headers.authorization;
  const provided = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!provided) return false;

  const providedBuf = Buffer.from(provided);
  const requiredBuf = Buffer.from(required);
  return providedBuf.length === requiredBuf.length && timingSafeEqual(providedBuf, requiredBuf);
}

/**
 * GET /metrics — Prometheus-compatible metrics endpoint.
 *
 * Returns all registered metrics in Prometheus text exposition format. The data
 * is aggregate (no per-user values). Open by default — Prometheus scrapers often
 * don't carry auth — and meant to be restricted via network policy or a reverse
 * proxy. Set METRICS_TOKEN to additionally require a bearer token.
 */
router.get('/metrics', metricsLimiter, async (req, res) => {
  if (!metricsTokenAuthorized(req)) {
    res.status(401).end();
    return;
  }

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
