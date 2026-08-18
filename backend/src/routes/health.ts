import { Router } from 'express';
import { hostname } from 'os';
import { sql } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { isRedisHealthy } from '../db/redis.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';

const router = Router();

const healthLimiter = createRateLimiter({ name: 'health', windowMs: 60_000, maxRequests: 100 });

const INSTANCE_ID = process.env.INSTANCE_ID || hostname();

/**
 * GET /health/live
 * Liveness probe — is the process alive?
 * Used by Docker HEALTHCHECK for restart decisions.
 */
router.get('/health/live', (_req, res) => {
  res.json({
    status: 'ok',
    instance: INSTANCE_ID,
  });
});

/**
 * GET /health/ready
 * Readiness probe — can this instance serve traffic?
 * Used by load balancer routing decisions.
 * Returns 503 if external dependencies (PostgreSQL, Redis) are unavailable.
 */
router.get('/health/ready', healthLimiter, async (_req, res) => {
  const checks: Record<string, boolean> = {
    database: false,
    redis: false,
  };

  // Check PostgreSQL connectivity
  try {
    await sql`SELECT 1`;
    checks.database = true;
  } catch {
    /* not ready */
  }

  // Check Redis connectivity
  checks.redis = isRedisHealthy();

  // Database is required; Redis is optional (degraded but functional)
  const allHealthy = checks.database;
  const status = allHealthy ? (checks.redis ? 'ready' : 'degraded') : 'not_ready';

  res.status(allHealthy ? 200 : 503).json({
    status,
    instance: INSTANCE_ID,
    checks,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health — Health check endpoint.
 *
 * Returns service status, uptime, version, database and Redis connectivity.
 * Returns 200 if healthy, 503 if database is unreachable.
 */
router.get('/health', healthLimiter, async (_req, res) => {
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
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    status,
    service: 'adtraffic-backend',
    // Omit detailed instance/version/uptime in production to reduce information disclosure
    ...(isProduction ? {} : {
      instance: INSTANCE_ID,
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? 'unknown',
    }),
    timestamp: new Date().toISOString(),
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
