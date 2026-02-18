/**
 * Tests for the usage-tracker module — daily API limit enforcement,
 * usage recording, cost estimation, and day-boundary resets.
 *
 * Each test re-imports the module fresh to get a clean daily counter,
 * since the module uses module-level state.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We need to re-import the module for each test to reset the internal state.
// vitest's dynamic import + resetModules handles this.
let checkLimit: typeof import('../claude/usage-tracker.js')['checkLimit'];
let recordUsage: typeof import('../claude/usage-tracker.js')['recordUsage'];
let getUsageSummary: typeof import('../claude/usage-tracker.js')['getUsageSummary'];

beforeEach(async () => {
  vi.resetModules();
  // Suppress console.log from usage tracker
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const mod = await import('../claude/usage-tracker.js');
  checkLimit = mod.checkLimit;
  recordUsage = mod.recordUsage;
  getUsageSummary = mod.getUsageSummary;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.DAILY_API_LIMIT;
});

describe('checkLimit', () => {
  it('returns { allowed: true } when no requests have been made', () => {
    const result = checkLimit();
    expect(result).toEqual({ allowed: true });
  });

  it('returns { allowed: true } when under the limit', () => {
    process.env.DAILY_API_LIMIT = '5';
    recordUsage('claude-haiku-4-5-20251001', 100, 50);
    recordUsage('claude-haiku-4-5-20251001', 100, 50);
    const result = checkLimit();
    expect(result).toEqual({ allowed: true });
  });

  it('returns { allowed: false } when at the limit', () => {
    process.env.DAILY_API_LIMIT = '3';
    recordUsage('claude-haiku-4-5-20251001', 100, 50);
    recordUsage('claude-haiku-4-5-20251001', 100, 50);
    recordUsage('claude-haiku-4-5-20251001', 100, 50);

    const result = checkLimit();
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.message).toContain('Daily API limit reached');
      expect(result.message).toContain('3 requests');
    }
  });

  it('returns { allowed: false } when over the limit', () => {
    process.env.DAILY_API_LIMIT = '2';
    recordUsage('claude-haiku-4-5-20251001', 100, 50);
    recordUsage('claude-haiku-4-5-20251001', 100, 50);
    recordUsage('claude-haiku-4-5-20251001', 100, 50);

    const result = checkLimit();
    expect(result.allowed).toBe(false);
  });

  it('uses default limit of 100 when DAILY_API_LIMIT is not set', () => {
    // Make 99 requests — should still be allowed
    for (let i = 0; i < 99; i++) {
      recordUsage('claude-haiku-4-5-20251001', 10, 5);
    }
    expect(checkLimit().allowed).toBe(true);

    // 100th request
    recordUsage('claude-haiku-4-5-20251001', 10, 5);
    expect(checkLimit().allowed).toBe(false);
  });
});

describe('recordUsage', () => {
  it('increments the request count', () => {
    const before = getUsageSummary();
    expect(before.requests).toBe(0);

    recordUsage('claude-haiku-4-5-20251001', 100, 50);

    const after = getUsageSummary();
    expect(after.requests).toBe(1);
  });

  it('accumulates token counts', () => {
    recordUsage('claude-haiku-4-5-20251001', 100, 50);
    recordUsage('claude-haiku-4-5-20251001', 200, 75);

    const summary = getUsageSummary();
    expect(summary.inputTokens).toBe(300);
    expect(summary.outputTokens).toBe(125);
    expect(summary.totalTokens).toBe(425);
  });

  it('tracks multiple API calls', () => {
    for (let i = 0; i < 5; i++) {
      recordUsage('claude-haiku-4-5-20251001', 100, 50);
    }
    expect(getUsageSummary().requests).toBe(5);
  });

  it('logs usage to console', () => {
    const logSpy = vi.spyOn(console, 'log');
    recordUsage('claude-haiku-4-5-20251001', 100, 50);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[usage]'));
  });
});

describe('getUsageSummary', () => {
  it('returns zero values when no usage recorded', () => {
    const summary = getUsageSummary();
    expect(summary.requests).toBe(0);
    expect(summary.inputTokens).toBe(0);
    expect(summary.outputTokens).toBe(0);
    expect(summary.totalTokens).toBe(0);
    expect(summary.estimatedCost).toBe('$0.0000');
  });

  it('returns today\'s date', () => {
    const summary = getUsageSummary();
    const today = new Date().toISOString().slice(0, 10);
    expect(summary.date).toBe(today);
  });

  it('returns configured limit', () => {
    process.env.DAILY_API_LIMIT = '42';
    const summary = getUsageSummary();
    expect(summary.limit).toBe(42);
  });

  it('returns default limit of 100 when not configured', () => {
    const summary = getUsageSummary();
    expect(summary.limit).toBe(100);
  });

  it('calculates estimated cost for known models', () => {
    // claude-haiku-4-5: input $0.80/1M, output $4.00/1M
    recordUsage('claude-haiku-4-5-20251001', 1_000_000, 1_000_000);

    const summary = getUsageSummary();
    // Cost = (1M * 0.80 + 1M * 4.00) / 1M = $4.80
    expect(summary.estimatedCost).toBe('$4.8000');
  });

  it('handles unknown models gracefully (no cost contribution)', () => {
    recordUsage('unknown-model', 1_000_000, 1_000_000);

    const summary = getUsageSummary();
    expect(summary.estimatedCost).toBe('$0.0000');
    expect(summary.requests).toBe(1);
    expect(summary.totalTokens).toBe(2_000_000);
  });

  it('accumulates cost across multiple calls with different models', () => {
    // Haiku: input $0.80/1M, output $4.00/1M
    recordUsage('claude-haiku-4-5-20251001', 100_000, 50_000);
    // Sonnet: input $3.00/1M, output $15.00/1M
    recordUsage('claude-sonnet-4-5-20250929', 100_000, 50_000);

    const summary = getUsageSummary();
    // Haiku cost: (100k * 0.80 + 50k * 4.00) / 1M = 0.08 + 0.20 = 0.28
    // Sonnet cost: (100k * 3.00 + 50k * 15.00) / 1M = 0.30 + 0.75 = 1.05
    // Total: 1.33
    expect(summary.estimatedCost).toBe('$1.3300');
  });
});

describe('daily reset', () => {
  it('resets counters when the date changes', async () => {
    process.env.DAILY_API_LIMIT = '5';

    // Record some usage "today"
    recordUsage('claude-haiku-4-5-20251001', 100, 50);
    recordUsage('claude-haiku-4-5-20251001', 100, 50);
    expect(getUsageSummary().requests).toBe(2);

    // Mock the date to be tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    vi.setSystemTime(tomorrow);

    // checkLimit should trigger resetIfNewDay
    const result = checkLimit();
    expect(result.allowed).toBe(true);

    // Summary should be reset
    const summary = getUsageSummary();
    expect(summary.requests).toBe(0);
    expect(summary.inputTokens).toBe(0);
    expect(summary.outputTokens).toBe(0);

    vi.useRealTimers();
  });

  it('allows requests again after daily reset', async () => {
    process.env.DAILY_API_LIMIT = '2';

    // Hit the limit
    recordUsage('claude-haiku-4-5-20251001', 100, 50);
    recordUsage('claude-haiku-4-5-20251001', 100, 50);
    expect(checkLimit().allowed).toBe(false);

    // Advance to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    vi.setSystemTime(tomorrow);

    // Should be allowed again
    expect(checkLimit().allowed).toBe(true);

    vi.useRealTimers();
  });
});
