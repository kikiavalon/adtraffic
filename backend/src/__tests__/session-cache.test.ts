/**
 * Tests for the session-scoped CM360 data cache.
 *
 * Covers:
 * - Store and retrieve data per user
 * - User isolation
 * - TTL expiry (via fake timers)
 * - Entity-level invalidation
 * - Full session clear
 * - Redis path (mocked)
 * - In-memory fallback when Redis is unavailable
 * - Filtered cache keys
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock redis module before importing session-cache
vi.mock('../db/redis.js', () => ({
  getRedis: vi.fn(),
  isRedisHealthy: vi.fn(),
}));

vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getRedis, isRedisHealthy } from '../db/redis.js';
import {
  getCached,
  setCached,
  invalidateEntity,
  clearSessionCache,
  _getMemoryCache,
} from '../cm360/session-cache.js';

const mockedIsRedisHealthy = vi.mocked(isRedisHealthy);
const mockedGetRedis = vi.mocked(getRedis);

describe('session-cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default: Redis not available (in-memory fallback)
    mockedIsRedisHealthy.mockReturnValue(false);
    mockedGetRedis.mockReturnValue(null);
    // Clear in-memory cache between tests
    _getMemoryCache().clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('in-memory fallback (Redis unavailable)', () => {
    it('stores and retrieves CM360 data for a session', async () => {
      const userId = 'user-1';
      const advertisers = [{ id: '1', name: 'Apex Motors' }, { id: '2', name: 'Luminance Beauty' }];

      await setCached(userId, 'advertisers', advertisers);
      const result = await getCached<typeof advertisers>(userId, 'advertisers');

      expect(result).toEqual(advertisers);
    });

    it('returns null for cache miss', async () => {
      const result = await getCached('user-1', 'campaigns');
      expect(result).toBeNull();
    });

    it('isolates data between users', async () => {
      const advertisersA = [{ id: '1', name: 'User A Advertiser' }];
      const advertisersB = [{ id: '2', name: 'User B Advertiser' }];

      await setCached('user-a', 'advertisers', advertisersA);
      await setCached('user-b', 'advertisers', advertisersB);

      const resultA = await getCached('user-a', 'advertisers');
      const resultB = await getCached('user-b', 'advertisers');

      expect(resultA).toEqual(advertisersA);
      expect(resultB).toEqual(advertisersB);
    });

    it('expires data after TTL', async () => {
      await setCached('user-1', 'campaigns', [{ id: 'c1', name: 'Campaign 1' }]);

      // Data should exist before TTL
      const beforeExpiry = await getCached('user-1', 'campaigns');
      expect(beforeExpiry).not.toBeNull();

      // Advance time past the default 1-hour TTL
      vi.advanceTimersByTime(3600 * 1000 + 1);

      const afterExpiry = await getCached('user-1', 'campaigns');
      expect(afterExpiry).toBeNull();
    });

    it('does not expire data before TTL', async () => {
      await setCached('user-1', 'campaigns', [{ id: 'c1' }]);

      // Advance time to just before TTL expires
      vi.advanceTimersByTime(3600 * 1000 - 1000);

      const result = await getCached('user-1', 'campaigns');
      expect(result).not.toBeNull();
    });

    it('caches campaign list per advertiser using filter key', async () => {
      const campaignsAdv1 = [{ id: 'c1', name: 'Campaign for Adv1' }];
      const campaignsAdv2 = [{ id: 'c2', name: 'Campaign for Adv2' }];

      await setCached('user-1', 'campaigns', campaignsAdv1, 'advertiserId=adv1');
      await setCached('user-1', 'campaigns', campaignsAdv2, 'advertiserId=adv2');

      const result1 = await getCached('user-1', 'campaigns', 'advertiserId=adv1');
      const result2 = await getCached('user-1', 'campaigns', 'advertiserId=adv2');

      expect(result1).toEqual(campaignsAdv1);
      expect(result2).toEqual(campaignsAdv2);
    });

    it('invalidates specific entity types on write', async () => {
      await setCached('user-1', 'campaigns', [{ id: 'c1' }]);
      await setCached('user-1', 'campaigns', [{ id: 'c2' }], 'advertiserId=adv1');
      await setCached('user-1', 'placements', [{ id: 'p1' }]);

      // Invalidate campaigns (should remove all campaigns entries)
      await invalidateEntity('user-1', 'campaigns');

      const campaigns = await getCached('user-1', 'campaigns');
      const filteredCampaigns = await getCached('user-1', 'campaigns', 'advertiserId=adv1');
      const placements = await getCached('user-1', 'placements');

      expect(campaigns).toBeNull();
      expect(filteredCampaigns).toBeNull();
      // Placements should be untouched
      expect(placements).toEqual([{ id: 'p1' }]);
    });

    it('clears all cached data on session end', async () => {
      await setCached('user-1', 'advertisers', [{ id: 'a1' }]);
      await setCached('user-1', 'campaigns', [{ id: 'c1' }]);
      await setCached('user-1', 'placements', [{ id: 'p1' }]);
      await setCached('user-2', 'advertisers', [{ id: 'a2' }]);

      await clearSessionCache('user-1');

      // User 1 data should be gone
      expect(await getCached('user-1', 'advertisers')).toBeNull();
      expect(await getCached('user-1', 'campaigns')).toBeNull();
      expect(await getCached('user-1', 'placements')).toBeNull();

      // User 2 data should be untouched
      expect(await getCached('user-2', 'advertisers')).toEqual([{ id: 'a2' }]);
    });

    it('expired entries are cleaned up on read', async () => {
      await setCached('user-1', 'campaigns', [{ id: 'c1' }]);

      // Advance past TTL
      vi.advanceTimersByTime(3600 * 1000 + 1);

      // Read triggers cleanup
      await getCached('user-1', 'campaigns');

      // Entry should be removed from the map
      const cache = _getMemoryCache();
      let found = false;
      for (const key of cache.keys()) {
        if (key.includes('user-1') && key.includes('campaigns')) {
          found = true;
        }
      }
      expect(found).toBe(false);
    });
  });

  describe('Redis path (mocked)', () => {
    let mockRedis: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      del: ReturnType<typeof vi.fn>;
      scanStream: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockRedis = {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
        scanStream: vi.fn(),
      };
      mockedIsRedisHealthy.mockReturnValue(true);
      mockedGetRedis.mockReturnValue(mockRedis as never);
    });

    it('stores data in Redis with EX TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await setCached('user-1', 'advertisers', [{ id: 'a1' }]);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'session-cache:user-1:advertisers',
        JSON.stringify([{ id: 'a1' }]),
        'EX',
        3600,
      );
    });

    it('retrieves data from Redis', async () => {
      const data = [{ id: 'a1', name: 'Apex' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(data));

      const result = await getCached('user-1', 'advertisers');
      expect(result).toEqual(data);
      expect(mockRedis.get).toHaveBeenCalledWith('session-cache:user-1:advertisers');
    });

    it('returns null on Redis cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getCached('user-1', 'campaigns');
      expect(result).toBeNull();
    });

    it('uses filter in Redis cache key', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await setCached('user-1', 'campaigns', [{ id: 'c1' }], 'advertiserId=adv1');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'session-cache:user-1:campaigns:advertiserId=adv1',
        expect.any(String),
        'EX',
        3600,
      );
    });

    it('invalidates entity type keys via scanStream', async () => {
      const mockStream = createMockScanStream([
        ['session-cache:user-1:campaigns', 'session-cache:user-1:campaigns:advertiserId=adv1'],
      ]);
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.del.mockResolvedValue(2);

      await invalidateEntity('user-1', 'campaigns');

      expect(mockRedis.scanStream).toHaveBeenCalledWith({
        match: 'session-cache:user-1:campaigns*',
        count: 100,
      });
      expect(mockRedis.del).toHaveBeenCalledWith(
        'session-cache:user-1:campaigns',
        'session-cache:user-1:campaigns:advertiserId=adv1',
      );
    });

    it('skips del when scanStream finds no keys', async () => {
      const mockStream = createMockScanStream([]);
      mockRedis.scanStream.mockReturnValue(mockStream);

      await invalidateEntity('user-1', 'campaigns');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('clears all user keys via scanStream', async () => {
      const mockStream = createMockScanStream([
        ['session-cache:user-1:advertisers', 'session-cache:user-1:campaigns'],
      ]);
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.del.mockResolvedValue(2);

      await clearSessionCache('user-1');

      expect(mockRedis.scanStream).toHaveBeenCalledWith({
        match: 'session-cache:user-1:*',
        count: 100,
      });
      expect(mockRedis.del).toHaveBeenCalledWith(
        'session-cache:user-1:advertisers',
        'session-cache:user-1:campaigns',
      );
    });

    it('falls back to memory when Redis get throws', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection lost'));

      // Should fall through to memory cache, which has nothing
      const result = await getCached('user-1', 'advertisers');
      expect(result).toBeNull();
    });

    it('falls back to memory when Redis set throws', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis connection lost'));

      // Should fall through to memory cache
      await setCached('user-1', 'advertisers', [{ id: 'a1' }]);

      // Data should be in memory fallback
      const cache = _getMemoryCache();
      let found = false;
      for (const key of cache.keys()) {
        if (key.includes('user-1') && key.includes('advertisers')) {
          found = true;
        }
      }
      expect(found).toBe(true);
    });

    it('falls back to memory on invalidateEntity Redis error', async () => {
      mockRedis.scanStream.mockImplementation(() => {
        throw new Error('Redis connection lost');
      });

      // Pre-populate memory cache
      mockedIsRedisHealthy.mockReturnValue(false);
      await setCached('user-1', 'campaigns', [{ id: 'c1' }]);
      await setCached('user-1', 'campaigns', [{ id: 'c2' }], 'advertiserId=adv1');
      mockedIsRedisHealthy.mockReturnValue(true);

      await invalidateEntity('user-1', 'campaigns');

      // Memory fallback should also have been cleaned
      mockedIsRedisHealthy.mockReturnValue(false);
      expect(await getCached('user-1', 'campaigns')).toBeNull();
      expect(await getCached('user-1', 'campaigns', 'advertiserId=adv1')).toBeNull();
    });

    it('falls back to memory on clearSessionCache Redis error', async () => {
      mockRedis.scanStream.mockImplementation(() => {
        throw new Error('Redis connection lost');
      });

      // Pre-populate memory cache
      mockedIsRedisHealthy.mockReturnValue(false);
      await setCached('user-1', 'advertisers', [{ id: 'a1' }]);
      await setCached('user-1', 'campaigns', [{ id: 'c1' }]);
      mockedIsRedisHealthy.mockReturnValue(true);

      await clearSessionCache('user-1');

      // Memory fallback should also have been cleaned
      mockedIsRedisHealthy.mockReturnValue(false);
      expect(await getCached('user-1', 'advertisers')).toBeNull();
      expect(await getCached('user-1', 'campaigns')).toBeNull();
    });
  });
});

/**
 * Helper: creates a mock scanStream that emits batches of keys then ends.
 */
function createMockScanStream(batches: string[][]) {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const stream = {
    on(event: string, cb: (...args: unknown[]) => void) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
      // Emit data/end asynchronously to simulate stream behavior
      if (event === 'end') {
        queueMicrotask(() => {
          for (const batch of batches) {
            for (const dataCb of (listeners['data'] ?? [])) {
              dataCb(batch);
            }
          }
          for (const endCb of (listeners['end'] ?? [])) {
            endCb();
          }
        });
      }
      return stream;
    },
  };
  return stream;
}
