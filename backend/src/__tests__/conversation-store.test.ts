/**
 * Tests for the conversation store — in-memory history cache + database persistence.
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

describe('History cache (in-memory)', () => {
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
    saveHistory('store-test-conv-1', history);
    expect(await getHistory('store-test-conv-1')).toEqual(history);
    expect(await getHistoryLength('store-test-conv-1')).toBe(2);
  });

  it('overwrites history on re-save', async () => {
    saveHistory('store-test-conv-1', [{ role: 'user' as const, content: 'First' }]);
    saveHistory('store-test-conv-1', [
      { role: 'user' as const, content: 'Second' },
      { role: 'assistant' as const, content: 'Reply' },
    ]);
    expect(await getHistoryLength('store-test-conv-1')).toBe(2);
    expect((await getHistory('store-test-conv-1'))[0]).toEqual({ role: 'user', content: 'Second' });
  });

  it('clearHistory removes cached history', async () => {
    saveHistory('store-test-conv-1', [{ role: 'user' as const, content: 'Hello' }]);
    await clearHistory('store-test-conv-1');
    expect(await getHistory('store-test-conv-1')).toEqual([]);
    expect(await getHistoryLength('store-test-conv-1')).toBe(0);
  });

  it('handles multiple conversations independently', async () => {
    saveHistory('store-test-conv-1', [{ role: 'user' as const, content: 'Conv 1' }]);
    saveHistory('store-test-conv-2', [
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
    await saveMessage('store-test-conv-1', { id: 'a1', role: 'user', content: 'Older', timestamp: 1000 }, testUserId);
    // Ensure different updatedAt timestamps
    await new Promise((r) => setTimeout(r, 1100));
    await saveMessage('store-test-conv-2', { id: 'a2', role: 'user', content: 'Newer', timestamp: 2000 }, testUserId);

    const convs = await getConversations(testUserId);
    expect(convs).toHaveLength(2);
    // Most recent first
    expect(convs[0]!.id).toBe('store-test-conv-2');
    expect(convs[1]!.id).toBe('store-test-conv-1');
  });

  it('does not return conversations from other users', async () => {
    const otherUserId = randomUUID();
    await db.insert(schema.users).values({
      id: otherUserId,
      email: 'other@test.com',
      passwordHash: 'hashed',
      name: 'Other',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await saveMessage('store-test-conv-1', { id: 'a1', role: 'user', content: 'Mine', timestamp: 1000 }, testUserId);
    await saveMessage('store-test-conv-2', { id: 'a2', role: 'user', content: 'Theirs', timestamp: 2000 }, otherUserId);

    const myConvs = await getConversations(testUserId);
    expect(myConvs).toHaveLength(1);
    expect(myConvs[0]!.id).toBe('store-test-conv-1');

    const theirConvs = await getConversations(otherUserId);
    expect(theirConvs).toHaveLength(1);
    expect(theirConvs[0]!.id).toBe('store-test-conv-2');
  });
});

// ---------------------------------------------------------------------------
// clearHistory (DB + cache)
// ---------------------------------------------------------------------------

describe('clearHistory', () => {
  it('removes conversation and cascades to messages', async () => {
    await saveMessage('store-test-conv-1', { id: 'msg-1', role: 'user', content: 'Hello', timestamp: 1000 }, testUserId);
    await saveMessage('store-test-conv-1', { id: 'msg-2', role: 'assistant', content: 'Hi', timestamp: 2000 });

    await clearHistory('store-test-conv-1');

    expect(await getConversations(testUserId)).toEqual([]);
    expect(await getMessages('store-test-conv-1')).toEqual([]);
  });

  it('does not throw on clearing nonexistent conversation', async () => {
    await expect(clearHistory('no-such-conv')).resolves.not.toThrow();
  });
});
