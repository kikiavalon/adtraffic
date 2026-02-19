import 'dotenv/config';
import { initSentry, Sentry } from './sentry.js';

// Sentry must be initialized before importing Express
initSentry();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { hostname } from 'os';
import { createHash } from 'crypto';
import healthRouter from './routes/health.js';
import metricsRouter from './routes/metrics.js';
import chatRouter from './routes/chat.js';
import conversationsRouter from './routes/conversations.js';
import authRouter from './routes/auth.js';
import usageRouter from './routes/usage.js';
import featureFlagsRouter from './routes/feature-flags.js';
import oauthRouter from './routes/oauth.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';
import { metricsCollectorMiddleware } from './middleware/metrics-collector.js';
import { logger } from './lib/logger.js';
import { sql } from './db/index.js';
import { initRedis, closeRedis, getRedis } from './db/redis.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const INSTANCE_ID = process.env.INSTANCE_ID || hostname();
const SHUTDOWN_TIMEOUT_MS = 30_000; // 30 seconds max for drain

// Trust first proxy (nginx/Docker) for correct client IP in rate limiting and logging
app.set('trust proxy', 1);

// Security headers via helmet
app.use(helmet({
  contentSecurityPolicy: false, // CSP handled by nginx for the webapp; API responses don't serve HTML
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// Observability middleware (runs before auth/body parsing for full coverage)
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(metricsCollectorMiddleware);

// Middleware
// CORS: In production, replace chrome-extension regex with specific extension ID
// and localhost with the actual production origin (e.g., https://app.adtraffic.ai).
// Current config is permissive for development. See SEC-003 in enterprise-backlog.md.
const corsOrigins: (string | RegExp)[] = [
  /^chrome-extension:\/\//,
  /^http:\/\/localhost(:\d+)?$/,
];
if (process.env.WEBAPP_URL) {
  corsOrigins.push(process.env.WEBAPP_URL);
}
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '100kb' }));

// Routes — /health and /metrics are unversioned; everything else under /api/v1
app.use(healthRouter);
app.use(metricsRouter);
app.use('/api/v1', authRouter);
app.use('/api/v1', chatRouter);
app.use('/api/v1', conversationsRouter);
app.use('/api/v1', usageRouter);
app.use('/api/v1', featureFlagsRouter);
app.use('/api/v1', oauthRouter);

// Sentry error handler (captures exceptions before our custom error handler)
Sentry.setupExpressErrorHandler(app);

// Global error handler (must be after Sentry and all routes)
app.use(errorHandler);

// Initialize Redis (no-op in test mode)
initRedis();

/**
 * Validate that external dependencies are reachable before accepting traffic.
 * Checks PostgreSQL connectivity and Redis health.
 */
async function validateExternalDependencies(): Promise<void> {
  const errors: string[] = [];

  // Check PostgreSQL connectivity
  try {
    await sql`SELECT 1`;
  } catch (err) {
    errors.push(`Database: ${err instanceof Error ? err.message : 'unreachable'}`);
  }

  // Check Redis connectivity
  try {
    const redis = getRedis();
    if (redis) {
      await redis.ping();
    }
  } catch (err) {
    errors.push(`Redis: ${err instanceof Error ? err.message : 'unreachable'}`);
  }

  // Log environment hash for cross-instance consistency verification
  const envHash = createHash('sha256')
    .update(`${process.env.JWT_SECRET ?? ''}:${process.env.ENCRYPTION_KEY ?? ''}`)
    .digest('hex')
    .slice(0, 8);
  logger.info({ instance: INSTANCE_ID, envHash }, 'Environment hash computed');

  if (errors.length > 0) {
    logger.error({ instance: INSTANCE_ID, errors }, 'Dependency check failed');
    throw new Error(`External dependencies unavailable: ${errors.join(', ')}`);
  }

  logger.info({ instance: INSTANCE_ID }, 'All external dependencies healthy');
}

// Only start server when run directly (not when imported for testing)
if (process.env.NODE_ENV !== 'test') {
  void validateExternalDependencies().then(() => {
    const server = app.listen(PORT, () => {
      const model = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
      const maxTokens = process.env.CLAUDE_MAX_TOKENS ?? '1024';
      const dailyLimit = process.env.DAILY_API_LIMIT ?? '100';
      logger.info(
        { port: PORT, model, maxTokens, dailyLimit, instance: INSTANCE_ID },
        'AdTraffic.ai backend started',
      );
    });

    const shutdown = () => {
      logger.info({ instance: INSTANCE_ID }, 'Received shutdown signal. Draining connections...');

      // 1. Stop accepting new connections
      server.close(() => {
        logger.info({ instance: INSTANCE_ID }, 'All connections drained');

        void (async () => {
          // 2. Close Redis connection
          try {
            await closeRedis();
            logger.info({ instance: INSTANCE_ID }, 'Redis disconnected');
          } catch (err) {
            logger.error({ instance: INSTANCE_ID, err: { message: err instanceof Error ? err.message : 'Unknown' } }, 'Redis disconnect error');
          }

          // 3. Close PostgreSQL connection pool
          try {
            await sql.end();
            logger.info({ instance: INSTANCE_ID }, 'Database disconnected');
          } catch (err) {
            logger.error({ instance: INSTANCE_ID, err: { message: err instanceof Error ? err.message : 'Unknown' } }, 'Database disconnect error');
          }

          process.exit(0);
        })();
      });

      // 4. Force kill after timeout — some connections may hang (e.g., SSE streams)
      setTimeout(() => {
        logger.error({ instance: INSTANCE_ID, timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Forced shutdown after timeout');
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS).unref();
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }).catch((err) => {
    logger.error({ instance: INSTANCE_ID, err: { message: err instanceof Error ? err.message : 'Unknown' } }, 'Startup failed');
    process.exit(1);
  });
}

export default app;
