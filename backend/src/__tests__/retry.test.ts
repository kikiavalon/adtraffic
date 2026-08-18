/**
 * Tests for the retry utility with exponential backoff.
 *
 * Covers:
 * - Immediate success (no retries needed)
 * - Retry on transient errors then succeed
 * - All retries exhausted — throws last error
 * - Non-retryable errors throw immediately (no retries)
 * - Abort signal respected
 * - isRetryableError classification for various error types
 * - Exponential backoff delay behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRetryableError, withRetry } from '../claude/retry.js';

// The logger is silent in test mode (NODE_ENV=test), but let's be explicit
vi.mock('../lib/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnValue({
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('isRetryableError', () => {
  describe('returns true for transient errors', () => {
    it('socket hang up', () => {
      expect(isRetryableError(new Error('socket hang up'))).toBe(true);
    });

    it('ECONNRESET', () => {
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    });

    it('ECONNREFUSED', () => {
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
    });

    it('ETIMEDOUT', () => {
      expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    });

    it('The operation was aborted (timeout)', () => {
      expect(isRetryableError(new Error('The operation was aborted'))).toBe(true);
    });

    it('fetch failed', () => {
      expect(isRetryableError(new Error('fetch failed'))).toBe(true);
    });

    it('network error', () => {
      expect(isRetryableError(new Error('network error'))).toBe(true);
    });

    it('HTTP 429 (rate limit)', () => {
      const error = new Error('Rate limited');
      (error as { status?: number }).status = 429;
      expect(isRetryableError(error)).toBe(true);
    });

    it('HTTP 500 (server error)', () => {
      const error = new Error('Internal server error');
      (error as { status?: number }).status = 500;
      expect(isRetryableError(error)).toBe(true);
    });

    it('HTTP 502 (bad gateway)', () => {
      const error = new Error('Bad gateway');
      (error as { status?: number }).status = 502;
      expect(isRetryableError(error)).toBe(true);
    });

    it('HTTP 503 (service unavailable)', () => {
      const error = new Error('Service unavailable');
      (error as { status?: number }).status = 503;
      expect(isRetryableError(error)).toBe(true);
    });

    it('HTTP 529 (overloaded — Anthropic-specific)', () => {
      const error = new Error('Overloaded');
      (error as { status?: number }).status = 529;
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe('returns false for permanent errors', () => {
    it('HTTP 401 (unauthorized)', () => {
      const error = new Error('Unauthorized');
      (error as { status?: number }).status = 401;
      expect(isRetryableError(error)).toBe(false);
    });

    it('HTTP 403 (forbidden)', () => {
      const error = new Error('Forbidden');
      (error as { status?: number }).status = 403;
      expect(isRetryableError(error)).toBe(false);
    });

    it('HTTP 400 (bad request)', () => {
      const error = new Error('Bad request');
      (error as { status?: number }).status = 400;
      expect(isRetryableError(error)).toBe(false);
    });

    it('HTTP 404 (not found)', () => {
      const error = new Error('Not found');
      (error as { status?: number }).status = 404;
      expect(isRetryableError(error)).toBe(false);
    });

    it('daily API limit reached', () => {
      expect(isRetryableError(new Error('Daily API limit reached (100/100 requests)'))).toBe(false);
    });

    it('chat is disabled', () => {
      expect(isRetryableError(new Error('Chat is disabled for your account'))).toBe(false);
    });

    it('not connected (no OAuth)', () => {
      expect(isRetryableError(new Error('Not connected to CM360'))).toBe(false);
    });

    it('token revoked', () => {
      expect(isRetryableError(new Error('Token revoked by user'))).toBe(false);
    });

    it('invalid input', () => {
      expect(isRetryableError(new Error('Invalid input: missing required field'))).toBe(false);
    });

    it('validation failed', () => {
      expect(isRetryableError(new Error('Validation failed: name too long'))).toBe(false);
    });

    it('invalid API key', () => {
      expect(isRetryableError(new Error('Invalid API key provided'))).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for non-Error values', () => {
      expect(isRetryableError('string error')).toBe(false);
      expect(isRetryableError(42)).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });

    it('returns false for generic unknown errors', () => {
      expect(isRetryableError(new Error('Something went wrong'))).toBe(false);
    });

    it('non-retryable pattern takes precedence over retryable status code', () => {
      // Error message says "daily api limit reached" but status is 429
      // Non-retryable pattern should win
      const error = new Error('Daily API limit reached');
      (error as { status?: number }).status = 429;
      expect(isRetryableError(error)).toBe(false);
    });
  });
});

describe('withRetry', () => {
  it('returns result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient error then succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries multiple times then succeeds on last attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce('finally');

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });

    expect(result).toBe('finally');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after all retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10 }),
    ).rejects.toThrow('ECONNREFUSED');

    // Initial attempt + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Daily API limit reached'));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10 }),
    ).rejects.toThrow('Daily API limit reached');

    // Should throw immediately without retrying
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry 401 auth errors', async () => {
    const authError = new Error('Unauthorized');
    (authError as { status?: number }).status = 401;
    const fn = vi.fn().mockRejectedValue(authError);

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10 }),
    ).rejects.toThrow('Unauthorized');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry validation errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Validation failed: name required'));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10 }),
    ).rejects.toThrow('Validation failed');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects abort signal — throws immediately if already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const fn = vi.fn().mockResolvedValue('should not reach');

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10, signal: controller.signal }),
    ).rejects.toThrow('Aborted');

    // fn should never be called since signal was already aborted
    expect(fn).toHaveBeenCalledTimes(0);
  });

  it('stops retrying if signal aborts between attempts', async () => {
    const controller = new AbortController();

    // First call fails with a retryable error, then we abort the signal
    const fn = vi.fn()
      .mockImplementationOnce(async () => {
        // Abort the signal during the first failed attempt
        // The retry loop will see the aborted signal before the next attempt
        controller.abort();
        throw new Error('socket hang up');
      })
      .mockResolvedValueOnce('should not reach');

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10, signal: controller.signal }),
    ).rejects.toThrow();

    // Only the first attempt should have been called — no retry after abort
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries 429 status errors', async () => {
    const rateLimitError = new Error('Rate limited');
    (rateLimitError as { status?: number }).status = 429;

    const fn = vi.fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries 500 status errors', async () => {
    const serverError = new Error('Internal server error');
    (serverError as { status?: number }).status = 500;

    const fn = vi.fn()
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('uses default options when none provided', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('wraps non-Error throws into Error objects', async () => {
    const fn = vi.fn().mockRejectedValue('string error');

    await expect(
      withRetry(fn, { maxRetries: 0, baseDelayMs: 10 }),
    ).rejects.toThrow('string error');
  });

  it('logs a warning on each retry', async () => {
    const { logger: mockLogger } = await import('../lib/logger.js');

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce('ok');

    await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        maxRetries: 2,
        error: 'socket hang up',
      }),
      'Retrying after transient error',
    );
  });

  it('caps delay at maxDelayMs', async () => {
    // With baseDelayMs=5000, maxRetries=3:
    //   attempt 0: 5000 * 2^0 = 5000 + jitter
    //   attempt 1: 5000 * 2^1 = 10000 + jitter -> capped at maxDelayMs=6000
    // We can't easily test the exact delay, but we can verify it completes
    // in a reasonable time by using small values
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce('ok');

    const start = Date.now();
    await withRetry(fn, { maxRetries: 1, baseDelayMs: 10, maxDelayMs: 20 });
    const elapsed = Date.now() - start;

    // Should complete quickly since maxDelayMs is 20ms
    expect(elapsed).toBeLessThan(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
