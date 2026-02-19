/**
 * Tests for the usage-tracker module — daily API limit enforcement,
 * usage recording, cost estimation, and day-boundary resets.
 *
 * Each test re-imports the module fresh to get a clean daily counter,
 * since the module uses module-level state.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger and metrics before any imports
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../lib/metrics.js', () => ({
  claudeApiRequestsTotal: { inc: vi.fn() },
  claudeApiTokensTotal: { inc: vi.fn() },
}));

// We need to re-import the module for each test to reset the internal state.
// vitest's dynamic import + resetModules handles this.
let checkLimit: typeof import('../claude/usage-tracker.js')['checkLimit'];
let recordUsage: typeof import('../claude/usage-tracker.js')['recordUsage'];
let getUsageSummary: typeof import('../claude/usage-tracker.js')['getUsageSummary'];

beforeEach(async () => {
  vi.resetModules();
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
  it('returns { allowed: true } when no requests have been made', async () => {
    const result = await checkLimit();
    expect(result).toEqual({ allowed: true });
  });

  it('returns { allowed: true } when under the limit', async () => {
    process.env.DAILY_API_LIMIT = '5';
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);
    const result = await checkLimit();
    expect(result).toEqual({ allowed: true });
  });

  it('returns { allowed: false } when at the limit', async () => {
    process.env.DAILY_API_LIMIT = '3';
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);

    const result = await checkLimit();
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.message).toContain('Daily API limit reached');
      expect(result.message).toContain('3 requests');
    }
  });

  it('returns { allowed: false } when over the limit', async () => {
    process.env.DAILY_API_LIMIT = '2';
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);

    const result = await checkLimit();
    expect(result.allowed).toBe(false);
  });

  it('uses default limit of 100 when DAILY_API_LIMIT is not set', async () => {
    // Make 99 requests — should still be allowed
    for (let i = 0; i < 99; i++) {
      await recordUsage('claude-haiku-4-5-20251001', 10, 5);
    }
    expect((await checkLimit()).allowed).toBe(true);

    // 100th request
    await recordUsage('claude-haiku-4-5-20251001', 10, 5);
    expect((await checkLimit()).allowed).toBe(false);
  });
});

describe('recordUsage', () => {
  it('increments the request count', async () => {
    const before = await getUsageSummary();
    expect(before.requests).toBe(0);

    await recordUsage('claude-haiku-4-5-20251001', 100, 50);

    const after = await getUsageSummary();
    expect(after.requests).toBe(1);
  });

  it('accumulates token counts', async () => {
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);
    await recordUsage('claude-haiku-4-5-20251001', 200, 75);

    const summary = await getUsageSummary();
    expect(summary.inputTokens).toBe(300);
    expect(summary.outputTokens).toBe(125);
    expect(summary.totalTokens).toBe(425);
  });

  it('tracks multiple API calls', async () => {
    for (let i = 0; i < 5; i++) {
      await recordUsage('claude-haiku-4-5-20251001', 100, 50);
    }
    expect((await getUsageSummary()).requests).toBe(5);
  });

  it('logs usage via structured logger', async () => {
    const { logger } = await import('../lib/logger.js');
    vi.mocked(logger.info).mockClear();
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001', inputTokens: 100, outputTokens: 50 }),
      'API usage recorded',
    );
  });
});

describe('getUsageSummary', () => {
  it('returns zero values when no usage recorded', async () => {
    const summary = await getUsageSummary();
    expect(summary.requests).toBe(0);
    expect(summary.inputTokens).toBe(0);
    expect(summary.outputTokens).toBe(0);
    expect(summary.totalTokens).toBe(0);
    expect(summary.estimatedCost).toBe('$0.0000');
  });

  it('returns today\'s date', async () => {
    const summary = await getUsageSummary();
    const today = new Date().toISOString().slice(0, 10);
    expect(summary.date).toBe(today);
  });

  it('returns configured limit', async () => {
    process.env.DAILY_API_LIMIT = '42';
    const summary = await getUsageSummary();
    expect(summary.limit).toBe(42);
  });

  it('returns default limit of 100 when not configured', async () => {
    const summary = await getUsageSummary();
    expect(summary.limit).toBe(100);
  });

  it('calculates estimated cost for known models', async () => {
    // claude-haiku-4-5: input $0.80/1M, output $4.00/1M
    await recordUsage('claude-haiku-4-5-20251001', 1_000_000, 1_000_000);

    const summary = await getUsageSummary();
    // Cost = (1M * 0.80 + 1M * 4.00) / 1M = $4.80
    expect(summary.estimatedCost).toBe('$4.8000');
  });

  it('handles unknown models gracefully (no cost contribution)', async () => {
    await recordUsage('unknown-model', 1_000_000, 1_000_000);

    const summary = await getUsageSummary();
    expect(summary.estimatedCost).toBe('$0.0000');
    expect(summary.requests).toBe(1);
    expect(summary.totalTokens).toBe(2_000_000);
  });

  it('accumulates cost across multiple calls with different models', async () => {
    // Haiku: input $0.80/1M, output $4.00/1M
    await recordUsage('claude-haiku-4-5-20251001', 100_000, 50_000);
    // Sonnet: input $3.00/1M, output $15.00/1M
    await recordUsage('claude-sonnet-4-5-20250929', 100_000, 50_000);

    const summary = await getUsageSummary();
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
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);
    expect((await getUsageSummary()).requests).toBe(2);

    // Mock the date to be tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    vi.setSystemTime(tomorrow);

    // checkLimit should trigger resetIfNewDay
    const result = await checkLimit();
    expect(result.allowed).toBe(true);

    // Summary should be reset
    const summary = await getUsageSummary();
    expect(summary.requests).toBe(0);
    expect(summary.inputTokens).toBe(0);
    expect(summary.outputTokens).toBe(0);

    vi.useRealTimers();
  });

  it('allows requests again after daily reset', async () => {
    process.env.DAILY_API_LIMIT = '2';

    // Hit the limit
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);
    await recordUsage('claude-haiku-4-5-20251001', 100, 50);
    expect((await checkLimit()).allowed).toBe(false);

    // Advance to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    vi.setSystemTime(tomorrow);

    // Should be allowed again
    expect((await checkLimit()).allowed).toBe(true);

    vi.useRealTimers();
  });
});
