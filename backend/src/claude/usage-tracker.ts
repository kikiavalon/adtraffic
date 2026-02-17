/**
 * Simple in-memory API usage tracker for cost monitoring during development.
 * Tracks requests, tokens, and enforces a configurable daily request limit.
 *
 * Resets daily. Not persisted — restarts clear the counters.
 */

interface UsageEntry {
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

interface DailyUsage {
  date: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  entries: UsageEntry[];
}

// Approximate pricing per 1M tokens (as of Feb 2026)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
};

let dailyUsage: DailyUsage = {
  date: todayKey(),
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  entries: [],
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetIfNewDay(): void {
  const today = todayKey();
  if (dailyUsage.date !== today) {
    console.log(`[usage-tracker] New day — resetting counters (previous: ${dailyUsage.requests} requests, ${dailyUsage.inputTokens + dailyUsage.outputTokens} tokens)`);
    dailyUsage = {
      date: today,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      entries: [],
    };
  }
}

/**
 * Check if we've hit the daily request limit.
 * Returns { allowed: true } or { allowed: false, message: string }.
 */
export function checkLimit(): { allowed: boolean; message?: string } {
  resetIfNewDay();
  const limit = parseInt(process.env.DAILY_API_LIMIT ?? '100', 10);
  if (dailyUsage.requests >= limit) {
    return {
      allowed: false,
      message: `Daily API limit reached (${limit} requests). Reset tomorrow or increase DAILY_API_LIMIT in .env.`,
    };
  }
  return { allowed: true };
}

/**
 * Record a completed API call's token usage.
 */
export function recordUsage(model: string, inputTokens: number, outputTokens: number): void {
  resetIfNewDay();
  const entry: UsageEntry = {
    timestamp: Date.now(),
    model,
    inputTokens,
    outputTokens,
  };
  dailyUsage.requests++;
  dailyUsage.inputTokens += inputTokens;
  dailyUsage.outputTokens += outputTokens;
  dailyUsage.entries.push(entry);

  const pricing = MODEL_PRICING[model];
  const costStr = pricing
    ? `~$${((inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000).toFixed(4)}`
    : 'unknown';

  const totalCostStr = pricing
    ? `~$${((dailyUsage.inputTokens * pricing.input + dailyUsage.outputTokens * pricing.output) / 1_000_000).toFixed(4)}`
    : 'unknown';

  const limit = parseInt(process.env.DAILY_API_LIMIT ?? '100', 10);

  console.log(
    `[usage] ${model} | in: ${inputTokens} out: ${outputTokens} | cost: ${costStr} | daily: ${dailyUsage.requests}/${limit} reqs, ${dailyUsage.inputTokens + dailyUsage.outputTokens} tokens, ${totalCostStr} total`,
  );
}

/**
 * Get current daily usage summary (for a /api/usage endpoint or logging).
 */
export function getUsageSummary(): {
  date: string;
  requests: number;
  limit: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: string;
} {
  resetIfNewDay();
  const limit = parseInt(process.env.DAILY_API_LIMIT ?? '100', 10);

  // Estimate cost using the most common model in today's entries
  let estimatedCost = 0;
  for (const entry of dailyUsage.entries) {
    const pricing = MODEL_PRICING[entry.model];
    if (pricing) {
      estimatedCost += (entry.inputTokens * pricing.input + entry.outputTokens * pricing.output) / 1_000_000;
    }
  }

  return {
    date: dailyUsage.date,
    requests: dailyUsage.requests,
    limit,
    inputTokens: dailyUsage.inputTokens,
    outputTokens: dailyUsage.outputTokens,
    totalTokens: dailyUsage.inputTokens + dailyUsage.outputTokens,
    estimatedCost: `$${estimatedCost.toFixed(4)}`,
  };
}
