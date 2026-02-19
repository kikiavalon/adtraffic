import 'dotenv/config';
import { initSentry, Sentry } from './sentry.js';

// Sentry must be initialized before importing Express
initSentry();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import { initRedis, closeRedis } from './db/redis.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

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
app.use(cors({
  origin: [
    /^chrome-extension:\/\//,
    /^http:\/\/localhost(:\d+)?$/,
  ],
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

// Only start server when run directly (not when imported for testing)
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    const model = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
    const maxTokens = process.env.CLAUDE_MAX_TOKENS ?? '1024';
    const dailyLimit = process.env.DAILY_API_LIMIT ?? '100';
    logger.info(
      { port: PORT, model, maxTokens, dailyLimit },
      'AdTraffic.ai backend started',
    );
  });

  const shutdown = () => {
    logger.info('Shutting down gracefully...');
    server.close(() => {
      void (async () => {
        await closeRedis();
        await sql.end();
        process.exit(0);
      })();
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default app;
