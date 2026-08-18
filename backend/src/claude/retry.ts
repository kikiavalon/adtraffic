import { logger } from '../lib/logger.js';

/**
 * Retry utility with exponential backoff for Claude API calls.
 *
 * Retries on transient errors (socket hangup, timeout, 429, 5xx).
 * Does NOT retry permanent errors (auth failures, daily limit, validation).
 */

// Errors that should NOT be retried — user-facing or permanent failures
const NON_RETRYABLE_PATTERNS = [
  'daily api limit reached',
  'chat is disabled',
  'not connected',
  'token revoked',
  'invalid input',
  'validation failed',
  'invalid api key',
];

// Errors that indicate transient network/infrastructure issues
const RETRYABLE_PATTERNS = [
  'socket hang up',
  'econnreset',
  'econnrefused',
  'etimedout',
  'the operation was aborted',
  'fetch failed',
  'network',
];

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};

/**
 * Determines whether an error is transient and worth retrying.
 *
 * Returns true for: socket errors, timeouts, HTTP 429, HTTP 5xx
 * Returns false for: auth errors (401/403), daily limit, validation, unknown errors
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // Check non-retryable patterns first — these are permanent failures
  for (const pattern of NON_RETRYABLE_PATTERNS) {
    if (message.includes(pattern)) return false;
  }

  // Check HTTP status codes (Anthropic SDK errors have a .status property)
  const status = (error as { status?: number }).status;
  if (status !== undefined) {
    // 429 (rate limit) and 5xx (server errors) are retryable
    if (status === 429 || status >= 500) return true;
    // 4xx client errors (401, 403, 400, etc.) are not retryable
    if (status >= 400) return false;
  }

  // Check retryable message patterns for network-level failures
  for (const pattern of RETRYABLE_PATTERNS) {
    if (message.includes(pattern)) return true;
  }

  return false;
}

/**
 * Execute a function with exponential backoff retry on transient errors.
 *
 * @param fn - Async function to execute (and potentially retry)
 * @param options - Retry configuration (maxRetries, delays, abort signal)
 * @returns The result of fn() on success
 * @throws The last error if all retries are exhausted, or immediately for non-retryable errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Bail immediately if the caller's abort signal has fired
      if (opts.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if: signal aborted, error is permanent, or we've used all retries
      if (opts.signal?.aborted || !isRetryableError(error) || attempt >= opts.maxRetries) {
        throw lastError;
      }

      // Exponential backoff with jitter: baseDelay * 2^attempt + random(0-500ms)
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt) + Math.random() * 500,
        opts.maxDelayMs ?? 5000,
      );

      logger.warn(
        {
          attempt: attempt + 1,
          maxRetries: opts.maxRetries,
          delayMs: Math.round(delay),
          error: lastError.message,
        },
        'Retrying after transient error',
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // TypeScript needs this — the loop always either returns or throws
  throw lastError!;
}
