/**
 * API usage tracker with Redis persistence and in-memory fallback.
 * Tracks requests, tokens, and enforces a configurable daily request limit.
 *
 * Counters are keyed PER USER so that one user's traffic cannot exhaust another
 * user's daily allowance, and so the per-user limit resolved from feature flags
 * is compared against that same user's count (auto-expire after 48h):
 *   usage:{userId}:{date}:requests      — counter (INCRBY)
 *   usage:{userId}:{date}:inputTokens   — counter (INCRBY)
 *   usage:{userId}:{date}:outputTokens  — counter (INCRBY)
 *   usage:{userId}:{date}:entries       — list of JSON-encoded UsageEntry objects (RPUSH)
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

/** Maximum entries to keep per user in the in-memory fallback to prevent unbounded growth. */
const MAX_FALLBACK_ENTRIES = 10_000;

/** TTL for Redis usage keys: 48 hours. */
const USAGE_TTL_SECONDS = 172_800;

/** Bucket used when a caller has no authenticated user id (should not happen on the chat path). */
const ANONYMOUS_BUCKET = 'anonymous';

function getDailyLimit(): number {
  return parseInt(process.env.DAILY_API_LIMIT ?? '100', 10);
}

function bucket(userId?: string): string {
  return userId && userId.length > 0 ? userId : ANONYMOUS_BUCKET;
}

function usageKey(userId: string, date: string, field: string): string {
  return `usage:${userId}:${date}:${field}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// --- In-memory fallback state, keyed per user ---

const dailyUsageByUser = new Map<string, DailyUsage>();

/** Return the caller's in-memory usage for today, resetting it at the day boundary. */
function getUserUsage(userId: string): DailyUsage {
  const today = todayKey();
  const existing = dailyUsageByUser.get(userId);
  if (!existing || existing.date !== today) {
    if (existing) {
      logger.info(
        { userId, previousRequests: existing.requests, previousTokens: existing.inputTokens + existing.outputTokens },
        'New day — resetting usage counters',
      );
    }
    const fresh: DailyUsage = { date: today, requests: 0, inputTokens: 0, outputTokens: 0, entries: [] };
    dailyUsageByUser.set(userId, fresh);
    return fresh;
  }
  return existing;
}

/**
 * Check if the user has hit their daily request limit.
 * Returns { allowed: true } or { allowed: false, message: string }.
 *
 * @param dailyLimit - Optional per-user limit from feature flags. Falls back to env/default.
 * @param userId - The user whose per-user counter and limit are being checked.
 */
export async function checkLimit(dailyLimit?: number, userId?: string): Promise<LimitCheck> {
  const limit = dailyLimit ?? getDailyLimit();
  const uid = bucket(userId);
  const date = todayKey();

  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      const requests = parseInt(await redis.get(usageKey(uid, date, 'requests')) ?? '0', 10);
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
  const usage = getUserUsage(uid);
  if (usage.requests >= limit) {
    // Audit: daily limit reached (fire-and-forget)
    if (userId) {
      void logAuditEvent({
        userId,
        eventType: 'daily_limit_reached',
        metadata: { dailyLimit: limit, currentRequests: usage.requests },
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
 * Record a completed API call's token usage against the calling user's counters.
 */
export async function recordUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  userId?: string,
): Promise<void> {
  const uid = bucket(userId);
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
      pipeline.incrby(usageKey(uid, date, 'requests'), 1);
      pipeline.incrby(usageKey(uid, date, 'inputTokens'), inputTokens);
      pipeline.incrby(usageKey(uid, date, 'outputTokens'), outputTokens);
      pipeline.rpush(usageKey(uid, date, 'entries'), JSON.stringify(entry));
      // Set TTL on all keys (idempotent — resets TTL on each write)
      pipeline.expire(usageKey(uid, date, 'requests'), USAGE_TTL_SECONDS);
      pipeline.expire(usageKey(uid, date, 'inputTokens'), USAGE_TTL_SECONDS);
      pipeline.expire(usageKey(uid, date, 'outputTokens'), USAGE_TTL_SECONDS);
      pipeline.expire(usageKey(uid, date, 'entries'), USAGE_TTL_SECONDS);
      await pipeline.exec();

      // Log (read back counters for display)
      const requests = parseInt(await redis.get(usageKey(uid, date, 'requests')) ?? '0', 10);
      const totalInput = parseInt(await redis.get(usageKey(uid, date, 'inputTokens')) ?? '0', 10);
      const totalOutput = parseInt(await redis.get(usageKey(uid, date, 'outputTokens')) ?? '0', 10);
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
  const usage = getUserUsage(uid);
  usage.requests++;
  usage.inputTokens += inputTokens;
  usage.outputTokens += outputTokens;
  if (usage.entries.length < MAX_FALLBACK_ENTRIES) {
    usage.entries.push(entry);
  }

  logUsage(model, inputTokens, outputTokens, usage.requests, usage.inputTokens, usage.outputTokens);

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
 * Get the calling user's daily usage summary (for the /api/usage endpoint).
 */
export async function getUsageSummary(userId?: string): Promise<{
  date: string;
  requests: number;
  limit: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: string;
}> {
  const uid = bucket(userId);
  const date = todayKey();
  const limit = getDailyLimit();

  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      const pipeline = redis.pipeline();
      pipeline.get(usageKey(uid, date, 'requests'));
      pipeline.get(usageKey(uid, date, 'inputTokens'));
      pipeline.get(usageKey(uid, date, 'outputTokens'));
      pipeline.lrange(usageKey(uid, date, 'entries'), 0, -1);
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
  const usage = getUserUsage(uid);

  let estimatedCost = 0;
  for (const entry of usage.entries) {
    const pricing = MODEL_PRICING[entry.model];
    if (pricing) {
      estimatedCost += (entry.inputTokens * pricing.input + entry.outputTokens * pricing.output) / 1_000_000;
    }
  }

  return {
    date: usage.date,
    requests: usage.requests,
    limit,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.inputTokens + usage.outputTokens,
    estimatedCost: `$${estimatedCost.toFixed(4)}`,
  };
}
