import { db, schema } from './index.js';
import { eq, desc } from 'drizzle-orm';
import type Anthropic from '@anthropic-ai/sdk';

// Cache Claude's full conversation history (with tool_use/tool_result blocks) in memory.
// The database stores display messages; this cache stores the raw API history.
// On server restart, conversations start fresh (acceptable for MVP).
const historyCache = new Map<string, Anthropic.MessageParam[]>();

/**
 * Get conversation history for Claude API calls.
 */
export function getHistory(conversationId: string): Anthropic.MessageParam[] {
  return historyCache.get(conversationId) ?? [];
}

/**
 * Save conversation history after a Claude API call.
 */
export function saveHistory(conversationId: string, history: Anthropic.MessageParam[]): void {
  historyCache.set(conversationId, history);
}

/**
 * Save a display message to the database.
 */
export function saveMessage(
  conversationId: string,
  message: { id: string; role: 'user' | 'assistant'; content: string; timestamp: number },
  userId?: string,
): void {
  // Ensure conversation exists
  const existing = db.select().from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId))
    .get();

  if (!existing && userId) {
    const now = new Date();
    db.insert(schema.conversations).values({
      id: conversationId,
      userId,
      title: message.role === 'user' ? message.content.slice(0, 100) : null,
      createdAt: now,
      updatedAt: now,
    }).run();
  }

  db.insert(schema.messages).values({
    id: message.id,
    conversationId,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  }).run();

  // Update conversation timestamp
  if (existing) {
    db.update(schema.conversations)
      .set({ updatedAt: new Date() })
      .where(eq(schema.conversations.id, conversationId))
      .run();
  }
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
 * Get all conversations for a user, ordered by most recent.
 */
export function getConversations(userId: string): Array<{
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
    .all();
}

/**
 * Get all display messages for a conversation.
 */
export function getMessages(conversationId: string): Array<{
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
    .all();
}
