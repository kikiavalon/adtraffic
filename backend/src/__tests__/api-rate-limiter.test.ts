import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkCM360RateLimit, recordCM360Request, resetCM360RateLimiter } from '../cm360/api-rate-limiter.js';

describe('CM360 API Rate Limiter', () => {
  beforeEach(() => {
    resetCM360RateLimiter();
  });

  it('should allow requests within the limit', () => {
    const result = checkCM360RateLimit('user1');
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBeUndefined();
  });

  it('should track requests per user independently', () => {
    // Record 90 requests for user1
    for (let i = 0; i < 90; i++) {
      recordCM360Request('user1');
    }
    // user1 should still be allowed (under 95 threshold)
    expect(checkCM360RateLimit('user1').allowed).toBe(true);

    // user2 should have a fresh window
    expect(checkCM360RateLimit('user2').allowed).toBe(true);
  });

  it('should block requests at the threshold (95 of 100)', () => {
    for (let i = 0; i < 95; i++) {
      recordCM360Request('user1');
    }
    const result = checkCM360RateLimit('user1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(100_000);
  });

  it('should return retryAfterMs based on oldest request in window', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    for (let i = 0; i < 95; i++) {
      recordCM360Request('user1');
    }

    // Move time forward 50 seconds
    vi.spyOn(Date, 'now').mockReturnValue(now + 50_000);

    const result = checkCM360RateLimit('user1');
    expect(result.allowed).toBe(false);
    // Oldest request was at `now`, window is 100s, so retry after ~50s
    expect(result.retryAfterMs).toBeLessThanOrEqual(50_001);
    expect(result.retryAfterMs).toBeGreaterThan(49_000);

    vi.restoreAllMocks();
  });

  it('should allow requests after the window expires', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    for (let i = 0; i < 95; i++) {
      recordCM360Request('user1');
    }

    // Move time forward past the window
    vi.spyOn(Date, 'now').mockReturnValue(now + 101_000);

    const result = checkCM360RateLimit('user1');
    expect(result.allowed).toBe(true);

    vi.restoreAllMocks();
  });

  it('should not count expired requests toward the limit', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    // Record 50 requests at time T
    for (let i = 0; i < 50; i++) {
      recordCM360Request('user1');
    }

    // Move to T+80s — first 50 still in window
    vi.spyOn(Date, 'now').mockReturnValue(now + 80_000);

    // Record 44 more — total in window = 94 (under 95)
    for (let i = 0; i < 44; i++) {
      recordCM360Request('user1');
    }

    expect(checkCM360RateLimit('user1').allowed).toBe(true);

    // Move to T+101s — first 50 expired, only 44 remain
    vi.spyOn(Date, 'now').mockReturnValue(now + 101_000);
    expect(checkCM360RateLimit('user1').allowed).toBe(true);

    vi.restoreAllMocks();
  });

  it('should handle rapid successive checks correctly', () => {
    for (let i = 0; i < 94; i++) {
      recordCM360Request('user1');
    }

    // 94 recorded — check should be allowed
    expect(checkCM360RateLimit('user1').allowed).toBe(true);

    // Record one more → 95 total
    recordCM360Request('user1');

    // Now should be blocked
    expect(checkCM360RateLimit('user1').allowed).toBe(false);
  });
});
