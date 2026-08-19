import type { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { getRedis, isRedisHealthy } from '../db/redis.js';
import { logAuditEvent } from '../audit/audit-service.js';
import { logger } from '../lib/logger.js';

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterOptions {
  /** Unique name for this limiter — used as Redis key namespace */
  name: string;
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /**
   * If true, the limiter becomes a no-op when NODE_ENV=test.
   * This prevents rate limiting from interfering with integration tests
   * that make many requests against the same app instance.
   * The rate limiter itself should be tested in dedicated unit tests.
   * Defaults to true.
   */
  skipInTest?: boolean;
  /**
   * Derive the rate-limit bucket key from the request. Defaults to the client
   * IP. On authenticated routes, pass `(req) => req.user?.userId ?? req.ip` to
   * limit per user instead of per shared IP.
   */
  key?: (req: Request) => string;
}

/**
 * Creates a sliding window rate limiter middleware.
 * Uses Redis sorted sets when available, falls back to in-memory Map.
 *
 * Redis key pattern: ratelimit:{name}:{ip}
 * Each request is stored as a sorted set member with score = timestamp.
 * Expired members are pruned on each check.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { name, windowMs, maxRequests, skipInTest = true, key: keyFn } = options;
  const isTest = process.env.NODE_ENV === 'test';
  const windowSeconds = Math.ceil(windowMs / 1000);

  // In-memory fallback store
  const store = new Map<string, RateLimitEntry>();

  // Clean up stale entries every 60 seconds to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 60_000);

  // Allow the cleanup interval to not prevent Node.js from exiting
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  async function middleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    // In test environments, skip rate limiting to avoid interference with
    // integration tests. Rate limiter behavior is tested in dedicated unit tests.
    if (skipInTest && isTest) {
      next();
      return;
    }

    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const rateKey = keyFn ? keyFn(req) : ip;
    const now = Date.now();

    // Try Redis first
    if (isRedisHealthy()) {
      try {
        const redis = getRedis()!;
        const key = `ratelimit:${name}:${rateKey}`;
        const windowStart = now - windowMs;

        // Pipeline: prune expired + count + add + set TTL
        const pipeline = redis.pipeline();
        pipeline.zremrangebyscore(key, 0, windowStart);
        pipeline.zcard(key);
        const results = await pipeline.exec();

        if (!results) {
          throw new Error('Redis pipeline returned null');
        }

        const count = results[1]?.[1] as number;

        if (count >= maxRequests) {
          logger.warn({ ip, path: req.path, limiterName: name }, 'Rate limit exceeded');
          // Audit: rate limited (fire-and-forget)
          void logAuditEvent({
            userId: req.user?.userId ?? 'anonymous',
            eventType: 'rate_limited',
            metadata: { limiterName: name, endpoint: req.path, method: req.method },
            ipAddress: ip,
          });
          res.status(429).json({ error: 'Too many requests. Please try again later.' });
          return;
        }

        // Add this request with a unique member to avoid collisions
        const member = `${now}-${randomBytes(4).toString('hex')}`;
        await redis.pipeline()
          .zadd(key, now, member)
          .expire(key, windowSeconds)
          .exec();

        next();
        return;
      } catch {
        // Redis error — fall through to in-memory
      }
    }

    // In-memory fallback
    let entry = store.get(rateKey);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(rateKey, entry);
    }

    // Remove timestamps outside the current sliding window
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

    if (entry.timestamps.length >= maxRequests) {
      logger.warn({ ip, path: req.path, limiterName: name }, 'Rate limit exceeded');
      // Audit: rate limited (fire-and-forget)
      void logAuditEvent({
        userId: req.user?.userId ?? 'anonymous',
        eventType: 'rate_limited',
        metadata: { limiterName: name, endpoint: req.path, method: req.method },
        ipAddress: ip,
      });
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }

    // Record this request
    entry.timestamps.push(now);
    next();
  }

  // Expose internals for testing
  middleware._store = store;
  middleware._cleanup = cleanupInterval;

  return middleware;
}
