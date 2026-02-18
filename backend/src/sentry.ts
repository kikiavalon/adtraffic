import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { logger } from './lib/logger.js';

/**
 * Initialize Sentry error reporting.
 * Gracefully disabled when SENTRY_DSN is not set — logs a warning and returns.
 * Must be called BEFORE creating the Express app.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry disabled (SENTRY_DSN not set)');
    return;
  }

  const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
  const isProduction = environment === 'production';

  Sentry.init({
    dsn,
    environment,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    profilesSampleRate: isProduction ? 0.1 : 1.0,
    beforeSend(event) {
      // Redact sensitive data from error reports
      if (event.request) {
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
        if (event.request.data && typeof event.request.data === 'object') {
          const data = event.request.data as Record<string, unknown>;
          if ('password' in data) {
            data['password'] = '[REDACTED]';
          }
        }
      }
      return event;
    },
  });

  logger.info({ environment, tracesSampleRate: isProduction ? '10%' : '100%' }, 'Sentry initialized');
}

export { Sentry };
