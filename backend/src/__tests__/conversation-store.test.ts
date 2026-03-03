/**
 * Tests for the conversation store — Redis/in-memory history cache + database persistence.
 */

import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, schema } from '../db/index.js';
import {
  getHistory,
  saveHistory,
  clearHistory,
  getHistoryLength,
  saveMessage,
  getConversations,
  getMessages,
} from '../db/conversation-store.js';

// Create a test user before each test
let testUserId: string;

beforeEach(async () => {
  await db.delete(schema.approvalQueue);
  await db.delete(schema.auditLogs);
  await db.delete(schema.oauthTokens);
  await db.delete(schema.messages);
  await db.delete(schema.conversations);
  await db.delete(schema.users);

  const userId = randomUUID();
  await db.insert(schema.users).values({
    id: userId,
    email: `${userId}@test.com`,
    passwordHash: 'hashed',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  testUserId = userId;

  // Clear any cached history from previous tests
  await clearHistory('store-test-conv-1');
  await clearHistory('store-test-conv-2');
  await clearHistory('store-test-conv-3');
});

// ---------------------------------------------------------------------------
// In-memory history cache
// ---------------------------------------------------------------------------

describe('History cache (Redis with in-memory fallback)', () => {
  it('returns empty array for unknown conversation', async () => {
    expect(await getHistory('nonexistent-conv')).toEqual([]);
  });

  it('returns 0 length for unknown conversation', async () => {
    expect(await getHistoryLength('nonexistent-conv')).toBe(0);
  });

  it('saves and retrieves history', async () => {
    const history = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there!' },
    ];
    await saveHistory('store-test-conv-1', history);
    expect(await getHistory('store-test-conv-1')).toEqual(history);
    expect(await getHistoryLength('store-test-conv-1')).toBe(2);
  });

  it('overwrites history on re-save', async () => {
    await saveHistory('store-test-conv-1', [{ role: 'user' as const, content: 'First' }]);
    await saveHistory('store-test-conv-1', [
      { role: 'user' as const, content: 'Second' },
      { role: 'assistant' as const, content: 'Reply' },
    ]);
    expect(await getHistoryLength('store-test-conv-1')).toBe(2);
    const h = await getHistory('store-test-conv-1');
    expect(h[0]).toEqual({ role: 'user', content: 'Second' });
  });

  it('clearHistory removes cached history', async () => {
    await saveHistory('store-test-conv-1', [{ role: 'user' as const, content: 'Hello' }]);
    await clearHistory('store-test-conv-1');
    expect(await getHistory('store-test-conv-1')).toEqual([]);
    expect(await getHistoryLength('store-test-conv-1')).toBe(0);
  });

  it('handles multiple conversations independently', async () => {
    await saveHistory('store-test-conv-1', [{ role: 'user' as const, content: 'Conv 1' }]);
    await saveHistory('store-test-conv-2', [
      { role: 'user' as const, content: 'Conv 2a' },
      { role: 'assistant' as const, content: 'Conv 2b' },
    ]);

    expect(await getHistoryLength('store-test-conv-1')).toBe(1);
    expect(await getHistoryLength('store-test-conv-2')).toBe(2);

    await clearHistory('store-test-conv-1');
    expect(await getHistoryLength('store-test-conv-1')).toBe(0);
    expect(await getHistoryLength('store-test-conv-2')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Database message persistence
// ---------------------------------------------------------------------------

describe('saveMessage + getMessages', () => {
  it('saves a user message and creates the conversation', async () => {
    await saveMessage('store-test-conv-1', {
      id: 'msg-1',
      role: 'user',
      content: 'Hello Kiki',
      timestamp: 1000,
    }, testUserId);

    const messages = await getMessages('store-test-conv-1');
    expect(messages).toHaveLength(1);
    expect(messages[0]!.id).toBe('msg-1');
    expect(messages[0]!.role).toBe('user');
    expect(messages[0]!.content).toBe('Hello Kiki');
  });

  it('sets conversation title from first user message (truncated to 100 chars)', async () => {
    const longMessage = 'A'.repeat(150);
    await saveMessage('store-test-conv-1', {
      id: 'msg-1',
      role: 'user',
      content: longMessage,
      timestamp: 1000,
    }, testUserId);

    const conversations = await getConversations(testUserId);
    expect(conversations).toHaveLength(1);
    expect(conversations[0]!.title).toBe('A'.repeat(100));
  });

  it('does not set title from assistant message', async () => {
    await saveMessage('store-test-conv-1', {
      id: 'msg-1',
      role: 'assistant',
      content: 'Welcome!',
      timestamp: 1000,
    }, testUserId);

    const conversations = await getConversations(testUserId);
    expect(conversations).toHaveLength(1);
    expect(conversations[0]!.title).toBeNull();
  });

  it('preserves message order', async () => {
    await saveMessage('store-test-conv-1', { id: 'msg-1', role: 'user', content: 'First', timestamp: 1000 }, testUserId);
    await saveMessage('store-test-conv-1', { id: 'msg-2', role: 'assistant', content: 'Second', timestamp: 2000 });
    await saveMessage('store-test-conv-1', { id: 'msg-3', role: 'user', content: 'Third', timestamp: 3000 });

    const messages = await getMessages('store-test-conv-1');
    expect(messages).toHaveLength(3);
    expect(messages.map((m) => m.content)).toEqual(['First', 'Second', 'Third']);
  });

  it('returns empty array for nonexistent conversation', async () => {
    expect(await getMessages('no-such-conv')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Conversation listing
// ---------------------------------------------------------------------------

describe('getConversations', () => {
  it('returns empty array when user has no conversations', async () => {
    expect(await getConversations(testUserId)).toEqual([]);
  });

  it('returns conversations ordered by most recent', async () => {
    await saveMessage('store-test-conv-1', { id: 'msg-1', role: 'user', content: 'First', timestamp: 1000 }, testUserId);
    // Stagger updates to ensure deterministic updatedAt ordering in PostgreSQL
    await new Promise((r) => setTimeout(r, 50));
    await saveMessage('store-test-conv-2', { id: 'msg-2', role: 'user', content: 'Second', timestamp: 2000 }, testUserId);
    await new Promise((r) => setTimeout(r, 50));
    await saveMessage('store-test-conv-3', { id: 'msg-3', role: 'user', content: 'Third', timestamp: 3000 }, testUserId);

    const conversations = await getConversations(testUserId);
    expect(conversations).toHaveLength(3);
    expect(conversations.map((c) => c.id)).toEqual(['store-test-conv-3', 'store-test-conv-2', 'store-test-conv-1']);
  });

  it('does not return conversations from other users', async () => {
    const otherUserId = randomUUID();
    await db.insert(schema.users).values({
      id: otherUserId,
      email: `${otherUserId}@test.com`,
      passwordHash: 'hashed',
      name: 'Other User',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await saveMessage('store-test-conv-1', { id: 'msg-1', role: 'user', content: 'Hello', timestamp: 1000 }, testUserId);
    await saveMessage('store-test-conv-2', { id: 'msg-2', role: 'user', content: 'Hi', timestamp: 2000 }, otherUserId);

    const conversations = await getConversations(testUserId);
    expect(conversations).toHaveLength(1);
    expect(conversations[0]!.id).toBe('store-test-conv-1');
  });

  it('respects limit and offset', async () => {
    await saveMessage('store-test-conv-1', { id: 'msg-1', role: 'user', content: 'A', timestamp: 1000 }, testUserId);
    // Stagger updates to ensure deterministic updatedAt ordering in PostgreSQL
    await new Promise((r) => setTimeout(r, 50));
    await saveMessage('store-test-conv-2', { id: 'msg-2', role: 'user', content: 'B', timestamp: 2000 }, testUserId);
    await new Promise((r) => setTimeout(r, 50));
    await saveMessage('store-test-conv-3', { id: 'msg-3', role: 'user', content: 'C', timestamp: 3000 }, testUserId);

    const page1 = await getConversations(testUserId, 2, 0);
    expect(page1).toHaveLength(2);
    expect(page1.map((c) => c.id)).toEqual(['store-test-conv-3', 'store-test-conv-2']);

    const page2 = await getConversations(testUserId, 2, 2);
    expect(page2).toHaveLength(1);
    expect(page2[0]!.id).toBe('store-test-conv-1');
  });
});
