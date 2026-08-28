import { Redis } from 'ioredis';
import { logger } from '../lib/logger.js';

let redis: Redis | null = null;
let healthy = false;

/** Redact credentials from Redis URL for safe logging */
function redactRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = '***';
    return parsed.toString();
  } catch {
    return '[invalid-url]';
  }
}

/**
 * Whether initRedis() should attach a real Redis client.
 *
 * Skipped when:
 *  - NODE_ENV=test — the suite uses the in-memory fallback.
 *  - DEMO_MODE=true — the zero-dependency demo runs with no external services;
 *    every Redis consumer already falls back to in-memory (isRedisHealthy() is
 *    false). Without this, a demo on a machine with no Redis dialed
 *    localhost:6379 and logged red ECONNREFUSED errors that read as a crash.
 */
export function shouldSkipRedis(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.DEMO_MODE === 'true';
}

/**
 * Initialize the Redis client.
 * No-op under NODE_ENV=test and DEMO_MODE (both use the in-memory fallback).
 * Safe to call multiple times — subsequent calls are ignored.
 */
export function initRedis(): void {
  if (shouldSkipRedis()) {
    // A calm, single notice in demo mode — never silence after scary errors.
    if (process.env.DEMO_MODE === 'true') {
      logger.info('Redis skipped (DEMO_MODE) — using in-memory cache');
    }
    return;
  }
  if (redis) return;

  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

  // In production, require authenticated Redis URL
  if (process.env.NODE_ENV === 'production' && url && !url.includes('@')) {
    logger.warn({ url: redactRedisUrl(url) }, 'REDIS_URL has no credentials — Redis should use requirepass in production');
  }

  redis = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 3) {
        logger.error({ attempt: times }, 'Redis max retries exceeded — giving up');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 1000, 5000);
      logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnecting...');
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
