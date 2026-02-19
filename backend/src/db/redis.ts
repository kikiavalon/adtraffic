import { Redis } from 'ioredis';
import { logger } from '../lib/logger.js';

let redis: Redis | null = null;
let healthy = false;

/**
 * Initialize the Redis client.
 * No-op if NODE_ENV=test (tests use in-memory fallback).
 * Safe to call multiple times — subsequent calls are ignored.
 */
export function initRedis(): void {
  if (process.env.NODE_ENV === 'test') return;
  if (redis) return;

  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

  redis = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 10) {
        logger.error('[redis] Max reconnection attempts reached, giving up');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 200, 5000);
      logger.info({ delay, attempt: times }, '[redis] Reconnecting');
      return delay;
    },
  });

  redis.on('connect', () => {
    healthy = true;
    logger.info('[redis] Connected');
  });

  redis.on('ready', () => {
    healthy = true;
  });

  redis.on('error', (err: Error) => {
    healthy = false;
    logger.error({ err: { message: err.message } }, '[redis] Connection error');
  });

  redis.on('close', () => {
    healthy = false;
    logger.info('[redis] Connection closed');
  });
}

/**
 * Get the Redis client instance. Returns null if not initialized or in test mode.
 */
export function getRedis(): Redis | null {
  return redis;
}

/**
 * Check if the Redis client is connected and healthy.
 */
export function isRedisHealthy(): boolean {
  return healthy && redis !== null && redis.status === 'ready';
}

/**
 * Gracefully close the Redis connection.
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
    } catch {
      // Ignore errors during shutdown — connection may already be closed
    }
    redis = null;
    healthy = false;
  }
}
