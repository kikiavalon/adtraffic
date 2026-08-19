import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { logger } from './lib/logger.js';

// Object keys whose value is redacted wholesale, at any depth. Substrings match
// intentionally (e.g. "token" catches csrfToken/sessionToken); over-redaction in
// an error report is the safe direction.
const SENSITIVE_KEY =
  /password|secret|authorization|cookie|token|session|api[-_]?key|encryption[-_]?key|jwt|email/i;

/** Value patterns redacted inside any string, regardless of the key it sits under. */
const VALUE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [REDACTED]'],
  [/eyJ[A-Za-z0-9\-._]+/g, '[REDACTED_JWT]'],
  [/sk-ant-[A-Za-z0-9\-_]+/g, '[REDACTED_ANTHROPIC_KEY]'],
  [/ya29\.[A-Za-z0-9._-]+/g, '[REDACTED_GOOGLE_TOKEN]'], // Google OAuth access tokens
  [/gh[pousr]_[A-Za-z0-9]+/g, '[REDACTED_GITHUB_TOKEN]'],
  // AES-256-GCM ciphertext as stored: iv(24 hex) : tag(32 hex) : ciphertext(hex)
  [/\b[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+\b/gi, '[REDACTED_CIPHERTEXT]'],
  // 64-hex secret (e.g. ENCRYPTION_KEY)
  [/\b[0-9a-f]{64}\b/gi, '[REDACTED_HEX_SECRET]'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]'],
];

function scrubString(value: string): string {
  let out = value;
  for (const [pattern, replacement] of VALUE_PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

/** Recursively redact sensitive keys and secret-shaped values in place. Bounded
 * depth guards against pathological/circular structures. */
function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      record[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : scrubValue(record[key], depth + 1);
    }
    return record;
  }
  return value;
}

/** Deep-scrub an outbound Sentry event: request (headers, data, query string,
 * cookies), exception values, message, breadcrumbs, contexts, and extra. */
export function scrubSentryEvent<T extends Sentry.Event>(event: T): T {
  return scrubValue(event) as T;
}

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
      return scrubSentryEvent(event);
    },
  });

  logger.info({ environment, tracesSampleRate: isProduction ? '10%' : '100%' }, 'Sentry initialized');
}

export { Sentry };
