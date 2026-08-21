import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Structured JSON logger for the AdTraffic.ai backend.
 *
 * - Production: JSON output at 'info' level
 * - Development: Pretty-printed at 'debug' level
 * - Test: Silent (no output)
 *
 * Sensitive fields (authorization headers, passwords, tokens, secrets)
 * are automatically redacted from log output.
 */
export const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug')),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.access_token',
      '*.refresh_token',
      '*.secret',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
  base: { service: 'adtraffic-backend' },
  ...(isTest
    ? {}
    : !isProduction
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
});

/**
 * Create a child logger with additional bindings (e.g., requestId, module).
 */
export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}
