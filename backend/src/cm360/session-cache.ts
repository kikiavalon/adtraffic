/**
 * Session-scoped CM360 data cache.
 *
 * Caches CM360 entity data (advertisers, campaigns, placements, etc.)
 * during a user's active session to reduce redundant API calls.
 *
 * Uses Redis when available with automatic TTL expiry.
 * Falls back to an in-memory Map when Redis is unavailable (including tests).
 *
 * NOT the same as the conversation history cache in conversation-store.ts.
 * This caches CM360 API response data only, scoped per user and entity type.
 */

import { getRedis, isRedisHealthy } from '../db/redis.js';
import { logger } from '../lib/logger.js';

const SESSION_CACHE_TTL = parseInt(process.env.SESSION_CACHE_TTL_SECONDS ?? '3600', 10); // 1 hour default
const CACHE_PREFIX = 'session-cache';

/** In-memory fallback for when Redis is unavailable */
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();

/**
 * Build a namespaced cache key.
 * Pattern: session-cache:{userId}:{entityType} or session-cache:{userId}:{entityType}:{filter}
 */
function cacheKey(userId: string, entityType: string, filter?: string): string {
  return `${CACHE_PREFIX}:${userId}:${entityType}${filter ? `:${filter}` : ''}`;
}

/**
 * Retrieve cached data for a user's entity type, optionally with a filter.
 * Returns null on cache miss or expired entry.
 */
export async function getCached<T>(userId: string, entityType: string, filter?: string): Promise<T | null> {
  const key = cacheKey(userId, entityType, filter);

  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      const data = await redis.get(key);
      if (data !== null) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch (err) {
      logger.error({ err, key }, '[session-cache] Redis get failed, falling through to memory');
    }
  }

  // In-memory fallback
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T;
  }
  // Clean up expired entry
  if (entry) {
    memoryCache.delete(key);
  }
  return null;
}

/**
 * Store data in the session cache for a user's entity type.
 * Automatically expires after SESSION_CACHE_TTL seconds.
 */
export async function setCached(userId: string, entityType: string, data: unknown, filter?: string): Promise<void> {
  const key = cacheKey(userId, entityType, filter);

  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      await redis.set(key, JSON.stringify(data), 'EX', SESSION_CACHE_TTL);
      return;
    } catch (err) {
      logger.error({ err, key }, '[session-cache] Redis set failed, falling through to memory');
    }
  }

  // In-memory fallback
  memoryCache.set(key, { data, expiresAt: Date.now() + SESSION_CACHE_TTL * 1000 });
}

/**
 * Invalidate all cache entries for a specific entity type for a user.
 * Called after write operations that modify the entity (create, update, delete).
 *
 * Deletes both the exact key and any filtered sub-keys.
 * Example: invalidateEntity('user-1', 'campaigns') deletes:
 *   - session-cache:user-1:campaigns
 *   - session-cache:user-1:campaigns:advertiserId=adv1
 *   - etc.
 */
export async function invalidateEntity(userId: string, entityType: string): Promise<void> {
  const pattern = `${CACHE_PREFIX}:${userId}:${entityType}`;

  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      const keys = await scanKeys(redis, `${pattern}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      logger.error({ err, pattern }, '[session-cache] Redis invalidateEntity failed, cleaning memory fallback');
    }
  }

  // Always clean memory fallback too (belt and suspenders)
  for (const key of memoryCache.keys()) {
    if (key.startsWith(pattern)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Clear all cache entries for a user. Called on session end or explicit cache clear.
 */
export async function clearSessionCache(userId: string): Promise<void> {
  const pattern = `${CACHE_PREFIX}:${userId}:`;

  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      const keys = await scanKeys(redis, `${pattern}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      logger.error({ err, userId }, '[session-cache] Redis clearSessionCache failed, cleaning memory fallback');
    }
  }

  // Always clean memory fallback too
  for (const key of memoryCache.keys()) {
    if (key.startsWith(pattern)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Collect all keys matching a pattern via Redis SCAN (non-blocking cursor iteration).
 * Uses scanStream to avoid blocking Redis with KEYS command.
 */
function scanKeys(redis: NonNullable<ReturnType<typeof getRedis>>, match: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const keys: string[] = [];
    const stream = redis.scanStream({ match, count: 100 });
    stream.on('data', (batch: string[]) => {
      keys.push(...batch);
    });
    stream.on('end', () => {
      resolve(keys);
    });
    stream.on('error', (err: Error) => {
      reject(err);
    });
  });
}

/**
 * Expose the in-memory cache Map for testing purposes only.
 * @internal
 */
export function _getMemoryCache(): Map<string, { data: unknown; expiresAt: number }> {
  return memoryCache;
}
