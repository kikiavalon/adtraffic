import { Router } from 'express';
import { sql } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { isRedisHealthy } from '../db/redis.js';

const router = Router();

/**
 * GET /health — Health check endpoint.
 *
 * Returns service status, uptime, version, database and Redis connectivity.
 * Returns 200 if healthy, 503 if database is unreachable.
 */
router.get('/health', async (_req, res) => {
  let dbStatus: 'ok' | 'error' = 'ok';

  try {
    await sql`SELECT 1`;
  } catch (err: unknown) {
    dbStatus = 'error';
    logger.error({ err: { message: err instanceof Error ? err.message : 'Unknown error' } }, 'Health check: database unreachable');
  }

  const redisStatus = isRedisHealthy() ? 'connected' : 'disconnected';
  const status = dbStatus === 'ok' ? (redisStatus === 'connected' ? 'ok' : 'degraded') : 'degraded';
  const statusCode = dbStatus === 'ok' ? 200 : 503;

  res.status(statusCode).json({
    status,
    service: 'adtraffic-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? 'unknown',
    checks: {
      database: dbStatus,
      redis: redisStatus,
    },
  });
});

// Dev-only endpoint to test Sentry error capture
if (process.env.NODE_ENV !== 'production') {
  router.get('/debug-sentry', () => {
    throw new Error('Sentry test error');
  });
}

export default router;
