import { db, schema } from './index.js';
import { eq, desc, asc } from 'drizzle-orm';
import type Anthropic from '@anthropic-ai/sdk';
import { getRedis, isRedisHealthy } from './redis.js';

// ---------------------------------------------------------------------------
// Conversation History Cache (Redis with in-memory fallback)
// ---------------------------------------------------------------------------
// Stores Claude's full conversation history (with tool_use/tool_result blocks).
// The database stores display messages; this cache stores the raw API history.
//
// Redis key: history:{conversationId}
// Value: JSON-serialized Anthropic.MessageParam[]
// TTL: configurable via HISTORY_CACHE_TTL_SECONDS (default 24h)
//
// Falls back to in-memory Map when Redis is unavailable.
// ---------------------------------------------------------------------------

/** In-memory fallback cache. */
const historyCache = new Map<string, Anthropic.MessageParam[]>();

/** Maximum conversations in the in-memory fallback cache. */
const MAX_CACHE_SIZE = 100;

/** TTL for Redis history cache entries (seconds). */
function getHistoryTTL(): number {
  return parseInt(process.env.HISTORY_CACHE_TTL_SECONDS ?? '86400', 10);
}

/**
 * Evict the oldest in-memory cache entry if the cache exceeds MAX_CACHE_SIZE.
 * Maps maintain insertion order, so the first key is the oldest.
 */
function evictIfNeeded(): void {
  if (historyCache.size > MAX_CACHE_SIZE) {
    const oldestKey = historyCache.keys().next().value;
    if (oldestKey !== undefined) {
      historyCache.delete(oldestKey);
    }
  }
}

/**
 * Get conversation history for Claude API calls.
 * Returns the cached message array, or an empty array if not found.
 */
export async function getHistory(conversationId: string): Promise<Anthropic.MessageParam[]> {
  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      const raw = await redis.get(`history:${conversationId}`);
      if (raw) {
        return JSON.parse(raw) as Anthropic.MessageParam[];
      }
      return [];
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  let history = historyCache.get(conversationId);
  if (!history) {
    history = [];
    historyCache.set(conversationId, history);
    evictIfNeeded();
  }
  return history;
}

/**
 * Save conversation history after a Claude API call.
 */
export async function saveHistory(conversationId: string, history: Anthropic.MessageParam[]): Promise<void> {
  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      const ttl = getHistoryTTL();
      await redis.set(`history:${conversationId}`, JSON.stringify(history), 'EX', ttl);
      return;
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  historyCache.set(conversationId, history);
  evictIfNeeded();
}

/**
 * Clear a conversation's history (both cache and database).
 */
export async function clearHistory(conversationId: string): Promise<void> {
  // Always clear in-memory cache
  historyCache.delete(conversationId);

  // Clear Redis if available
  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      await redis.del(`history:${conversationId}`);
    } catch {
      // Non-critical — continue with DB cleanup
    }
  }

  // Messages cascade-delete when conversation is deleted
  await db.delete(schema.conversations)
    .where(eq(schema.conversations.id, conversationId));
}

/**
 * Get the number of history entries for a conversation.
 */
export async function getHistoryLength(conversationId: string): Promise<number> {
  if (isRedisHealthy()) {
    try {
      const redis = getRedis()!;
      const raw = await redis.get(`history:${conversationId}`);
      if (raw) {
        return (JSON.parse(raw) as Anthropic.MessageParam[]).length;
      }
      return 0;
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  return historyCache.get(conversationId)?.length ?? 0;
}

// ---------------------------------------------------------------------------
// Database Operations (PostgreSQL via Drizzle ORM)
// ---------------------------------------------------------------------------

/**
 * Save a display message to the database.
 */
export async function saveMessage(
  conversationId: string,
  message: { id: string; role: 'user' | 'assistant'; content: string; timestamp: number },
  userId?: string,
): Promise<void> {
  // Ensure conversation exists — use INSERT OR IGNORE to handle concurrent inserts safely
  if (userId) {
    await db.insert(schema.conversations).values({
      id: conversationId,
      userId,
      title: message.role === 'user' ? message.content.slice(0, 100) : null,
    }).onConflictDoNothing();
  }

  await db.insert(schema.messages).values({
    id: message.id,
    conversationId,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  });

  // Update conversation timestamp
  await db.update(schema.conversations)
    .set({ updatedAt: new Date() })
    .where(eq(schema.conversations.id, conversationId));
}

/**
 * Get a single conversation by ID.
 */
export async function getConversation(conversationId: string): Promise<{
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
} | undefined> {
  const result = await db.select({
    id: schema.conversations.id,
    userId: schema.conversations.userId,
    title: schema.conversations.title,
    createdAt: schema.conversations.createdAt,
    updatedAt: schema.conversations.updatedAt,
  })
    .from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId));
  return result[0];
}

/**
 * Get conversations for a user, ordered by most recent, with pagination.
 */
export async function getConversations(userId: string, limit = 50, offset = 0): Promise<Array<{
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}>> {
  return db.select({
    id: schema.conversations.id,
    title: schema.conversations.title,
    createdAt: schema.conversations.createdAt,
    updatedAt: schema.conversations.updatedAt,
  })
    .from(schema.conversations)
    .where(eq(schema.conversations.userId, userId))
    .orderBy(desc(schema.conversations.updatedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get display messages for a conversation, ordered by timestamp, with pagination.
 */
export async function getMessages(conversationId: string, limit = 100, offset = 0): Promise<Array<{
  id: string;
  role: string;
  content: string;
  timestamp: number;
}>> {
  return db.select({
    id: schema.messages.id,
    role: schema.messages.role,
    content: schema.messages.content,
    timestamp: schema.messages.timestamp,
  })
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(asc(schema.messages.timestamp))
    .limit(limit)
    .offset(offset);
}
