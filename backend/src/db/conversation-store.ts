import { db, schema } from './index.js';
import { eq, desc, asc } from 'drizzle-orm';
import type Anthropic from '@anthropic-ai/sdk';

// Cache Claude's full conversation history (with tool_use/tool_result blocks) in memory.
// The database stores display messages; this cache stores the raw API history.
// On server restart, conversations start fresh (acceptable for MVP).
const historyCache = new Map<string, Anthropic.MessageParam[]>();

/** Maximum number of conversations to keep in the in-memory history cache. */
const MAX_CACHE_SIZE = 100;

/**
 * Evict the oldest cache entry if the cache exceeds MAX_CACHE_SIZE.
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
 * If the conversation is not in cache, initializes an empty array in the cache
 * so that callers' mutations (push) are automatically reflected.
 */
export function getHistory(conversationId: string): Anthropic.MessageParam[] {
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
export function saveHistory(conversationId: string, history: Anthropic.MessageParam[]): void {
  historyCache.set(conversationId, history);
  evictIfNeeded();
}

/**
 * Save a display message to the database.
 */
export function saveMessage(
  conversationId: string,
  message: { id: string; role: 'user' | 'assistant'; content: string; timestamp: number },
  userId?: string,
): void {
  // Ensure conversation exists — use INSERT OR IGNORE to handle concurrent inserts safely
  if (userId) {
    const now = new Date();
    db.insert(schema.conversations).values({
      id: conversationId,
      userId,
      title: message.role === 'user' ? message.content.slice(0, 100) : null,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing().run();
  }

  db.insert(schema.messages).values({
    id: message.id,
    conversationId,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  }).run();

  // Update conversation timestamp
  db.update(schema.conversations)
    .set({ updatedAt: new Date() })
    .where(eq(schema.conversations.id, conversationId))
    .run();
}

/**
 * Clear a conversation's history (both cache and database).
 */
export function clearHistory(conversationId: string): void {
  historyCache.delete(conversationId);
  // Messages cascade-delete when conversation is deleted
  db.delete(schema.conversations)
    .where(eq(schema.conversations.id, conversationId))
    .run();
}

/**
 * Get the number of history entries for a conversation.
 */
export function getHistoryLength(conversationId: string): number {
  return historyCache.get(conversationId)?.length ?? 0;
}

/**
 * Get a single conversation by ID.
 */
export function getConversation(conversationId: string): {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
} | undefined {
  return db.select({
    id: schema.conversations.id,
    userId: schema.conversations.userId,
    title: schema.conversations.title,
    createdAt: schema.conversations.createdAt,
    updatedAt: schema.conversations.updatedAt,
  })
    .from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId))
    .get();
}

/**
 * Get conversations for a user, ordered by most recent, with pagination.
 */
export function getConversations(userId: string, limit = 50, offset = 0): Array<{
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}> {
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
    .offset(offset)
    .all();
}

/**
 * Get display messages for a conversation, ordered by timestamp, with pagination.
 */
export function getMessages(conversationId: string, limit = 100, offset = 0): Array<{
  id: string;
  role: string;
  content: string;
  timestamp: number;
}> {
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
    .offset(offset)
    .all();
}
