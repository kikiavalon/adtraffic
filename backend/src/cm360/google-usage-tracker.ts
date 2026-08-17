/**
 * Daily Google CM360 API usage tracker with Redis persistence and in-memory fallback.
 *
 * Counts outbound calls to Google's CM360 API so the Settings page can show
 * "Google CM360 API" usage alongside Claude API usage. This is a daily counter
 * for display — the 100-queries-per-100-seconds enforcement lives in
 * api-rate-limiter.ts and is unaffected by this module.
 *
 * Redis keys (auto-expire after 48h):
 *   usage:google:{date}:requests — counter (INCRBY)
 *
 * Falls back to in-memory state when Redis is unavailable.
 */

import { getRedis, isRedisHealthy } from '../db/redis.js';

/** TTL for Redis usage keys: 48 hours (matches the Claude usage tracker). */
const USAGE_TTL_SECONDS = 172_800;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// --- In-memory fallback state ---

let fallback = { date: todayKey(), requests: 0 };

function resetIfNewDay(): void {
  const today = todayKey();
  if (fallback.date !== today) {
    fallback = { date: today, requests: 0 };
  }
}

/**
 * Record one outbound CM360 API request.
 * Call after each real (non-mock) CM360 API call.
 */
export async function recordGoogleApiRequest(): Promise<void> {
  const date = todayKey();

  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      const pipeline = redis.pipeline();
      pipeline.incrby(`usage:google:${date}:requests`, 1);
      pipeline.expire(`usage:google:${date}:requests`, USAGE_TTL_SECONDS);
      await pipeline.exec();
      return;
    } catch {
      // Fall through to in-memory
    }
  }

  resetIfNewDay();
  fallback.requests++;
}

/**
 * Get today's Google CM360 API usage (for the /api/v1/usage endpoint).
 */
export async function getGoogleUsageSummary(): Promise<{ date: string; requests: number }> {
  const date = todayKey();

  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      const requests = parseInt(await redis.get(`usage:google:${date}:requests`) ?? '0', 10);
      return { date, requests };
    } catch {
      // Fall through to in-memory
    }
  }

  resetIfNewDay();
  return { date: fallback.date, requests: fallback.requests };
}

/** Reset in-memory state. Used in tests. */
export function resetGoogleUsageTracker(): void {
  fallback = { date: todayKey(), requests: 0 };
}
