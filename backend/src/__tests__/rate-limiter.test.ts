/**
 * Tests for the createRateLimiter middleware — sliding window behavior,
 * IP tracking, 429 enforcement, window expiration, and cleanup.
 *
 * Uses skipInTest: false to actually enforce rate limits during these tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createRateLimiter } from '../middleware/rate-limiter.js';

function mockReq(ip = '127.0.0.1'): Partial<Request> {
  return { ip, socket: { remoteAddress: ip } as never };
}

function mockRes() {
  const state = { statusCode: null as number | null, body: null as unknown };
  const res: Partial<Response> = {
    status(code: number) {
      state.statusCode = code;
      return res as Response;
    },
    json(data: unknown) {
      state.body = data;
      return res as Response;
    },
  };
  return { res, state };
}

describe('createRateLimiter', () => {
  let limiter: ReturnType<typeof createRateLimiter>;

  afterEach(() => {
    if (limiter?._cleanup) {
      clearInterval(limiter._cleanup);
    }
  });

  describe('basic behavior', () => {
    beforeEach(() => {
      limiter = createRateLimiter({ name: 'test-basic', windowMs: 60_000, maxRequests: 3, skipInTest: false });
    });

    it('allows requests under the limit', () => {
      const next = vi.fn();
      limiter(mockReq() as Request, mockRes().res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows exactly maxRequests requests', () => {
      const next = vi.fn();
      for (let i = 0; i < 3; i++) {
        limiter(mockReq() as Request, mockRes().res as Response, next);
      }
      expect(next).toHaveBeenCalledTimes(3);
    });

    it('blocks request at maxRequests + 1 with 429', () => {
      const next = vi.fn();
      for (let i = 0; i < 3; i++) {
        limiter(mockReq() as Request, mockRes().res as Response, next);
      }

      const mock = mockRes();
      const next4 = vi.fn();
      limiter(mockReq() as Request, mock.res as Response, next4);

      expect(next4).not.toHaveBeenCalled();
      expect(mock.state.statusCode).toBe(429);
      expect(mock.state.body).toEqual({ error: 'Too many requests. Please try again later.' });
    });

    it('returns 429 for all subsequent requests after limit is hit', () => {
      const next = vi.fn();
      for (let i = 0; i < 3; i++) {
        limiter(mockReq() as Request, mockRes().res as Response, next);
      }

      for (let i = 0; i < 3; i++) {
        const mock = mockRes();
        limiter(mockReq() as Request, mock.res as Response, vi.fn());
        expect(mock.state.statusCode).toBe(429);
      }
    });
  });

  describe('per-IP isolation', () => {
    beforeEach(() => {
      limiter = createRateLimiter({ name: 'test-per-ip', windowMs: 60_000, maxRequests: 2, skipInTest: false });
    });

    it('tracks requests per IP independently', () => {
      const next = vi.fn();
      limiter(mockReq('10.0.0.1') as Request, mockRes().res as Response, next);
      limiter(mockReq('10.0.0.1') as Request, mockRes().res as Response, next);

      const nextB = vi.fn();
      limiter(mockReq('10.0.0.2') as Request, mockRes().res as Response, nextB);
      expect(nextB).toHaveBeenCalled();
    });

    it('blocks only the IP that exceeded the limit', () => {
      const next = vi.fn();
      limiter(mockReq('10.0.0.1') as Request, mockRes().res as Response, next);
      limiter(mockReq('10.0.0.1') as Request, mockRes().res as Response, next);

      const mockA = mockRes();
      limiter(mockReq('10.0.0.1') as Request, mockA.res as Response, vi.fn());
      expect(mockA.state.statusCode).toBe(429);

      const nextB = vi.fn();
      limiter(mockReq('10.0.0.2') as Request, mockRes().res as Response, nextB);
      expect(nextB).toHaveBeenCalled();
    });
  });

  describe('sliding window expiration', () => {
    it('allows requests again after the window expires', () => {
      vi.useFakeTimers();

      limiter = createRateLimiter({ name: 'test-sliding-1', windowMs: 1000, maxRequests: 2, skipInTest: false });

      const next = vi.fn();
      limiter(mockReq() as Request, mockRes().res as Response, next);
      limiter(mockReq() as Request, mockRes().res as Response, next);
      expect(next).toHaveBeenCalledTimes(2);

      const blocked = mockRes();
      limiter(mockReq() as Request, blocked.res as Response, vi.fn());
      expect(blocked.state.statusCode).toBe(429);

      vi.advanceTimersByTime(1001);

      const nextAfter = vi.fn();
      limiter(mockReq() as Request, mockRes().res as Response, nextAfter);
      expect(nextAfter).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('slides the window — old requests expire while new ones count', () => {
      vi.useFakeTimers();

      limiter = createRateLimiter({ name: 'test-sliding-2', windowMs: 1000, maxRequests: 2, skipInTest: false });

      const next = vi.fn();
      // t=0: first request
      limiter(mockReq() as Request, mockRes().res as Response, next);

      // t=500ms: second request
      vi.advanceTimersByTime(500);
      limiter(mockReq() as Request, mockRes().res as Response, next);

      // t=500ms: blocked (2 requests in window)
      const blocked = mockRes();
      limiter(mockReq() as Request, blocked.res as Response, vi.fn());
      expect(blocked.state.statusCode).toBe(429);

      // t=1001ms: first request has expired, only second remains
      vi.advanceTimersByTime(501);
      const nextSlide = vi.fn();
      limiter(mockReq() as Request, mockRes().res as Response, nextSlide);
      expect(nextSlide).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('store internals', () => {
    beforeEach(() => {
      limiter = createRateLimiter({ name: 'test-store', windowMs: 60_000, maxRequests: 5, skipInTest: false });
    });

    it('exposes _store Map for testing', () => {
      expect(limiter._store).toBeInstanceOf(Map);
    });

    it('stores entries keyed by IP', () => {
      const next = vi.fn();
      limiter(mockReq('192.168.1.1') as Request, mockRes().res as Response, next);
      expect(limiter._store.has('192.168.1.1')).toBe(true);
    });

    it('records timestamps in the store entry', () => {
      const next = vi.fn();
      limiter(mockReq('192.168.1.1') as Request, mockRes().res as Response, next);
      const entry = limiter._store.get('192.168.1.1');
      expect(entry).toBeDefined();
      expect(entry!.timestamps).toHaveLength(1);
      expect(typeof entry!.timestamps[0]).toBe('number');
    });

    it('starts with an empty store', () => {
      expect(limiter._store.size).toBe(0);
    });
  });

  describe('skipInTest behavior', () => {
    it('skips rate limiting when skipInTest is true (default)', () => {
      const defaultLimiter = createRateLimiter({ name: 'test-default', windowMs: 60_000, maxRequests: 1 });
      const next = vi.fn();

      for (let i = 0; i < 10; i++) {
        defaultLimiter(mockReq() as Request, mockRes().res as Response, next);
      }
      expect(next).toHaveBeenCalledTimes(10);

      clearInterval(defaultLimiter._cleanup);
    });

    it('enforces rate limiting when skipInTest is false', () => {
      const strictLimiter = createRateLimiter({ name: 'test-strict', windowMs: 60_000, maxRequests: 1, skipInTest: false });
      const next = vi.fn();

      strictLimiter(mockReq() as Request, mockRes().res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);

      const blocked = mockRes();
      strictLimiter(mockReq() as Request, blocked.res as Response, vi.fn());
      expect(blocked.state.statusCode).toBe(429);

      clearInterval(strictLimiter._cleanup);
    });
  });

  describe('IP resolution fallback', () => {
    it('falls back to socket.remoteAddress when req.ip is undefined', () => {
      limiter = createRateLimiter({ name: 'test-fallback-1', windowMs: 60_000, maxRequests: 1, skipInTest: false });
      const next = vi.fn();

      const req = { ip: undefined, socket: { remoteAddress: '10.0.0.99' } } as unknown as Request;
      limiter(req, mockRes().res as Response, next);

      expect(limiter._store.has('10.0.0.99')).toBe(true);
    });

    it('uses "unknown" when both req.ip and remoteAddress are undefined', () => {
      limiter = createRateLimiter({ name: 'test-fallback-2', windowMs: 60_000, maxRequests: 1, skipInTest: false });
      const next = vi.fn();

      const req = { ip: undefined, socket: { remoteAddress: undefined } } as unknown as Request;
      limiter(req, mockRes().res as Response, next);

      expect(limiter._store.has('unknown')).toBe(true);
    });
  });
});
