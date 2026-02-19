/**
 * Per-user CM360 API rate limiter.
 *
 * Google CM360 allows 100 queries per 100 seconds per user.
 * This module tracks outbound requests to Google's API (NOT incoming HTTP requests).
 * The HTTP rate limiter in middleware/rate-limiter.ts is separate.
 *
 * We trigger at 95 requests (5-request safety buffer) to avoid hitting Google's hard limit.
 */

const WINDOW_MS = 100_000; // 100-second sliding window
const MAX_REQUESTS = 95;   // Leave 5-request buffer below Google's 100 limit

/** Per-user timestamp arrays tracking when each request was made. */
const userWindows = new Map<string, number[]>();

/**
 * Check whether a user is allowed to make another CM360 API call.
 * Call this BEFORE each outbound CM360 request.
 */
export function checkCM360RateLimit(userId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const window = userWindows.get(userId) ?? [];

  // Remove timestamps outside the sliding window
  const recent = window.filter(ts => now - ts < WINDOW_MS);
  userWindows.set(userId, recent);

  if (recent.length >= MAX_REQUESTS) {
    // Calculate how long until the oldest request expires from the window
    const oldestInWindow = recent[0]!;
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  return { allowed: true };
}

/**
 * Record that a CM360 API request was made for this user.
 * Call this AFTER each successful outbound CM360 request.
 */
export function recordCM360Request(userId: string): void {
  const now = Date.now();
  const window = userWindows.get(userId) ?? [];
  window.push(now);
  userWindows.set(userId, window);
}

/** Reset all rate limit state. Used in tests. */
export function resetCM360RateLimiter(): void {
  userWindows.clear();
}
