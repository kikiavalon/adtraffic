import 'dotenv/config';

// Validate critical environment early — before DB modules initialize
// Using console.error intentionally — logger module may not be available yet
if (process.env.NODE_ENV !== 'test' && process.env.DEMO_MODE !== 'true' && !process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable must be set');
  process.exit(1);
}

import { initSentry, Sentry } from './sentry.js';

// Sentry must be initialized before importing Express
initSentry();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { hostname } from 'os';
import healthRouter from './routes/health.js';
import metricsRouter from './routes/metrics.js';
import chatRouter from './routes/chat.js';
import conversationsRouter from './routes/conversations.js';
import authRouter from './routes/auth.js';
import usageRouter from './routes/usage.js';
import featureFlagsRouter from './routes/feature-flags.js';
import oauthRouter from './routes/oauth.js';
import confirmationsRouter from './routes/confirmations.js';
import auditRouter from './routes/audit.js';
import sessionsRouter from './routes/sessions.js';
import uploadRouter from './routes/upload.js';
import approvalsRouter from './routes/approvals.js';
import qaRouter from './routes/qa.js';
import agentRouter from './routes/agent.js';
import anthropicKeyRouter from './routes/anthropic-key.js';
import demoFixturesRouter from './routes/demo-fixtures.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';
import { metricsCollectorMiddleware } from './middleware/metrics-collector.js';
import { logger } from './lib/logger.js';
import { sql } from './db/index.js';
import { initRedis, closeRedis, getRedis } from './db/redis.js';
import { initQaQueueEvents, closeQaQueue } from './qa/qa-queue.js';
import { maybeShowFirstBootNotice } from './telemetry/notice.js';
import { emitStartupEvent } from './telemetry/emitter.js';

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
// CORS: set CHROME_EXTENSION_ID to allow-list the companion extension in any
// environment. The any-extension wildcard is a convenience for local extension
// development ONLY and requires an explicit NODE_ENV=development — it is never
// enabled when NODE_ENV is unset, 'staging', or 'production', so a self-hosted
// instance that never sets NODE_ENV does not silently accept every extension
// origin (which, combined with credentials below, would let a hostile extension
// ride a user's session cookie).
const corsOrigins: (string | RegExp)[] = [
  /^http:\/\/localhost(:\d+)?$/,
];
if (process.env.WEBAPP_URL) {
  corsOrigins.push(process.env.WEBAPP_URL);
}
if (process.env.CHROME_EXTENSION_ID) {
  corsOrigins.push(`chrome-extension://${process.env.CHROME_EXTENSION_ID}`);
} else if (process.env.NODE_ENV === 'development') {
  corsOrigins.push(/^chrome-extension:\/\//);
}
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Allow the browser to send the httpOnly session cookie on cross-origin
  // requests (e.g. a webapp deployed on a different origin than the API). The
  // `origin` allow-list above still restricts which origins are permitted.
  credentials: true,
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
app.use('/api/v1', confirmationsRouter);
app.use('/api/v1', auditRouter);
app.use('/api/v1', sessionsRouter);
app.use('/api/v1', uploadRouter);
app.use('/api/v1', approvalsRouter);
app.use('/api/v1', qaRouter);
app.use('/api/v1', agentRouter);
app.use('/api/v1', anthropicKeyRouter);

// Demo-mode fixtures for offline click-through testing (never mounted live)
if (process.env.DEMO_MODE === 'true') {
  app.use(demoFixturesRouter);
}

// Sentry error handler (captures exceptions before our custom error handler)
Sentry.setupExpressErrorHandler(app);

// Global error handler (must be after Sentry and all routes)
app.use(errorHandler);

// Initialize Redis (no-op in test mode)
initRedis();

// Initialize Trafficking QA click-test QueueEvents listener (no-op in test/DEMO/no-Redis)
initQaQueueEvents();

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

  logger.info({ instance: INSTANCE_ID }, 'Environment validation complete');

  if (errors.length > 0) {
    logger.error({ instance: INSTANCE_ID, errors }, 'Dependency check failed');
    throw new Error(`External dependencies unavailable: ${errors.join(', ')}`);
  }

  logger.info({ instance: INSTANCE_ID }, 'All external dependencies healthy');
}

// Only start server when run directly (not when imported for testing)
if (process.env.NODE_ENV !== 'test') {
  const startServer = () => {
    const server = app.listen(PORT, () => {
      const model = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
      const maxTokens = process.env.CLAUDE_MAX_TOKENS ?? '1024';
      const dailyLimit = process.env.DAILY_API_LIMIT ?? '100';
      logger.info(
        { port: PORT, model, maxTokens, dailyLimit, instance: INSTANCE_ID, demoMode: process.env.DEMO_MODE === 'true' },
        'AdTraffic.ai backend started',
      );

      // Opt-in telemetry (both are no-ops unless the user has run `npm run telemetry`).
      maybeShowFirstBootNotice();
      emitStartupEvent();
    });

    const shutdown = () => {
      logger.info({ instance: INSTANCE_ID }, 'Received shutdown signal. Draining connections...');

      // 1. Stop accepting new connections
      server.close(() => {
        logger.info({ instance: INSTANCE_ID }, 'All connections drained');

        void (async () => {
          // 2. Close Redis connection
          try {
            await closeQaQueue();
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
  };

  if (process.env.DEMO_MODE === 'true') {
    // Demo mode: skip dependency validation, start server directly
    logger.warn({ instance: INSTANCE_ID }, 'DEMO_MODE enabled — in-memory storage, no persistence. Not suitable for production.');
    startServer();
  } else {
    void validateExternalDependencies().then(() => {
      startServer();
    }).catch((err) => {
      logger.error({ instance: INSTANCE_ID, err: { message: err instanceof Error ? err.message : 'Unknown' } }, 'Startup failed');
      process.exit(1);
    });
  }
}

export default app;
