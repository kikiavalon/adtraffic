/**
 * API usage tracker with Redis persistence and in-memory fallback.
 * Tracks requests, tokens, and enforces a configurable daily request limit.
 *
 * Redis keys (auto-expire after 48h):
 *   usage:{date}:requests      — counter (INCRBY)
 *   usage:{date}:inputTokens   — counter (INCRBY)
 *   usage:{date}:outputTokens  — counter (INCRBY)
 *   usage:{date}:entries       — list of JSON-encoded UsageEntry objects (RPUSH)
 *
 * Falls back to in-memory state when Redis is unavailable.
 */

import { logger } from '../lib/logger.js';
import { claudeApiRequestsTotal, claudeApiTokensTotal } from '../lib/metrics.js';
import { getRedis, isRedisHealthy } from '../db/redis.js';
import { logAuditEvent } from '../audit/audit-service.js';

export type LimitCheck = { allowed: true } | { allowed: false; message: string };

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

/** Maximum entries to keep in in-memory fallback to prevent unbounded growth. */
const MAX_FALLBACK_ENTRIES = 10_000;

/** TTL for Redis usage keys: 48 hours. */
const USAGE_TTL_SECONDS = 172_800;

function getDailyLimit(): number {
  return parseInt(process.env.DAILY_API_LIMIT ?? '100', 10);
}

// --- In-memory fallback state ---

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
    logger.info(
      { previousRequests: dailyUsage.requests, previousTokens: dailyUsage.inputTokens + dailyUsage.outputTokens },
      'New day — resetting usage counters',
    );
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
 *
 * @param dailyLimit - Optional per-user limit from feature flags. Falls back to env/default.
 * @param userId - Optional userId for audit logging when the limit is reached.
 */
export async function checkLimit(dailyLimit?: number, userId?: string): Promise<LimitCheck> {
  const limit = dailyLimit ?? getDailyLimit();
  const date = todayKey();

  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      const requests = parseInt(await redis.get(`usage:${date}:requests`) ?? '0', 10);
      if (requests >= limit) {
        // Audit: daily limit reached (fire-and-forget)
        if (userId) {
          void logAuditEvent({
            userId,
            eventType: 'daily_limit_reached',
            metadata: { dailyLimit: limit, currentRequests: requests },
          });
        }
        return {
          allowed: false,
          message: `Daily API limit reached (${limit} requests). Reset tomorrow or increase DAILY_API_LIMIT in .env.`,
        };
      }
      return { allowed: true };
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  resetIfNewDay();
  if (dailyUsage.requests >= limit) {
    // Audit: daily limit reached (fire-and-forget)
    if (userId) {
      void logAuditEvent({
        userId,
        eventType: 'daily_limit_reached',
        metadata: { dailyLimit: limit, currentRequests: dailyUsage.requests },
      });
    }
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
export async function recordUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const date = todayKey();
  const entry: UsageEntry = {
    timestamp: Date.now(),
    model,
    inputTokens,
    outputTokens,
  };

  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      const pipeline = redis.pipeline();
      pipeline.incrby(`usage:${date}:requests`, 1);
      pipeline.incrby(`usage:${date}:inputTokens`, inputTokens);
      pipeline.incrby(`usage:${date}:outputTokens`, outputTokens);
      pipeline.rpush(`usage:${date}:entries`, JSON.stringify(entry));
      // Set TTL on all keys (idempotent — resets TTL on each write)
      pipeline.expire(`usage:${date}:requests`, USAGE_TTL_SECONDS);
      pipeline.expire(`usage:${date}:inputTokens`, USAGE_TTL_SECONDS);
      pipeline.expire(`usage:${date}:outputTokens`, USAGE_TTL_SECONDS);
      pipeline.expire(`usage:${date}:entries`, USAGE_TTL_SECONDS);
      await pipeline.exec();

      // Log (read back counters for display)
      const requests = parseInt(await redis.get(`usage:${date}:requests`) ?? '0', 10);
      const totalInput = parseInt(await redis.get(`usage:${date}:inputTokens`) ?? '0', 10);
      const totalOutput = parseInt(await redis.get(`usage:${date}:outputTokens`) ?? '0', 10);
      logUsage(model, inputTokens, outputTokens, requests, totalInput, totalOutput);

      // Record Prometheus metrics
      claudeApiRequestsTotal.inc({ model, status: 'success' });
      claudeApiTokensTotal.inc({ model, type: 'input' }, inputTokens);
      claudeApiTokensTotal.inc({ model, type: 'output' }, outputTokens);
      return;
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  resetIfNewDay();
  dailyUsage.requests++;
  dailyUsage.inputTokens += inputTokens;
  dailyUsage.outputTokens += outputTokens;
  if (dailyUsage.entries.length < MAX_FALLBACK_ENTRIES) {
    dailyUsage.entries.push(entry);
  }

  logUsage(model, inputTokens, outputTokens, dailyUsage.requests, dailyUsage.inputTokens, dailyUsage.outputTokens);

  // Record Prometheus metrics
  claudeApiRequestsTotal.inc({ model, status: 'success' });
  claudeApiTokensTotal.inc({ model, type: 'input' }, inputTokens);
  claudeApiTokensTotal.inc({ model, type: 'output' }, outputTokens);
}

function logUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  totalRequests: number,
  totalInput: number,
  totalOutput: number,
): void {
  const pricing = MODEL_PRICING[model];
  const costStr = pricing
    ? `~$${((inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000).toFixed(4)}`
    : 'unknown';

  const totalCostStr = pricing
    ? `~$${((totalInput * pricing.input + totalOutput * pricing.output) / 1_000_000).toFixed(4)}`
    : 'unknown';

  const limit = getDailyLimit();

  logger.info(
    {
      model,
      inputTokens,
      outputTokens,
      cost: costStr,
      dailyRequests: totalRequests,
      dailyLimit: limit,
      dailyTotalTokens: totalInput + totalOutput,
      dailyTotalCost: totalCostStr,
    },
    'API usage recorded',
  );
}

/**
 * Get current daily usage summary (for the /api/usage endpoint).
 */
export async function getUsageSummary(): Promise<{
  date: string;
  requests: number;
  limit: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: string;
}> {
  const date = todayKey();
  const limit = getDailyLimit();

  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      const pipeline = redis.pipeline();
      pipeline.get(`usage:${date}:requests`);
      pipeline.get(`usage:${date}:inputTokens`);
      pipeline.get(`usage:${date}:outputTokens`);
      pipeline.lrange(`usage:${date}:entries`, 0, -1);
      const results = await pipeline.exec();

      if (!results) throw new Error('Redis pipeline returned null');

      const requests = parseInt((results[0]?.[1] as string | null) ?? '0', 10);
      const inputTokens = parseInt((results[1]?.[1] as string | null) ?? '0', 10);
      const outputTokens = parseInt((results[2]?.[1] as string | null) ?? '0', 10);
      const rawEntries = (results[3]?.[1] as string[] | null) ?? [];

      let estimatedCost = 0;
      for (const raw of rawEntries) {
        try {
          const e = JSON.parse(raw) as UsageEntry;
          const pricing = MODEL_PRICING[e.model];
          if (pricing) {
            estimatedCost += (e.inputTokens * pricing.input + e.outputTokens * pricing.output) / 1_000_000;
          }
        } catch {
          // Skip malformed entries
        }
      }

      return {
        date,
        requests,
        limit,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCost: `$${estimatedCost.toFixed(4)}`,
      };
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  resetIfNewDay();

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
