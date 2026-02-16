/**
 * Tests for the conversation store — in-memory history cache + database persistence.
 */

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

beforeEach(() => {
  db.delete(schema.messages).run();
  db.delete(schema.conversations).run();
  db.delete(schema.users).run();

  const userId = `test-user-${Date.now()}`;
  db.insert(schema.users).values({
    id: userId,
    email: `${userId}@test.com`,
    passwordHash: 'hashed',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).run();
  testUserId = userId;

  // Clear any cached history from previous tests
  clearHistory('store-test-conv-1');
  clearHistory('store-test-conv-2');
  clearHistory('store-test-conv-3');
});

// ---------------------------------------------------------------------------
// In-memory history cache
// ---------------------------------------------------------------------------

describe('History cache (in-memory)', () => {
  it('returns empty array for unknown conversation', () => {
    expect(getHistory('nonexistent-conv')).toEqual([]);
  });

  it('returns 0 length for unknown conversation', () => {
    expect(getHistoryLength('nonexistent-conv')).toBe(0);
  });

  it('saves and retrieves history', () => {
    const history = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there!' },
    ];
    saveHistory('store-test-conv-1', history);
    expect(getHistory('store-test-conv-1')).toEqual(history);
    expect(getHistoryLength('store-test-conv-1')).toBe(2);
  });

  it('overwrites history on re-save', () => {
    saveHistory('store-test-conv-1', [{ role: 'user' as const, content: 'First' }]);
    saveHistory('store-test-conv-1', [
      { role: 'user' as const, content: 'Second' },
      { role: 'assistant' as const, content: 'Reply' },
    ]);
    expect(getHistoryLength('store-test-conv-1')).toBe(2);
    expect(getHistory('store-test-conv-1')[0]).toEqual({ role: 'user', content: 'Second' });
  });

  it('clearHistory removes cached history', () => {
    saveHistory('store-test-conv-1', [{ role: 'user' as const, content: 'Hello' }]);
    clearHistory('store-test-conv-1');
    expect(getHistory('store-test-conv-1')).toEqual([]);
    expect(getHistoryLength('store-test-conv-1')).toBe(0);
  });

  it('handles multiple conversations independently', () => {
    saveHistory('store-test-conv-1', [{ role: 'user' as const, content: 'Conv 1' }]);
    saveHistory('store-test-conv-2', [
      { role: 'user' as const, content: 'Conv 2a' },
      { role: 'assistant' as const, content: 'Conv 2b' },
    ]);

    expect(getHistoryLength('store-test-conv-1')).toBe(1);
    expect(getHistoryLength('store-test-conv-2')).toBe(2);

    clearHistory('store-test-conv-1');
    expect(getHistoryLength('store-test-conv-1')).toBe(0);
    expect(getHistoryLength('store-test-conv-2')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Database message persistence
// ---------------------------------------------------------------------------

describe('saveMessage + getMessages', () => {
  it('saves a user message and creates the conversation', () => {
    saveMessage('store-test-conv-1', {
      id: 'msg-1',
      role: 'user',
      content: 'Hello Kiki',
      timestamp: 1000,
    }, testUserId);

    const messages = getMessages('store-test-conv-1');
    expect(messages).toHaveLength(1);
    expect(messages[0]!.id).toBe('msg-1');
    expect(messages[0]!.role).toBe('user');
    expect(messages[0]!.content).toBe('Hello Kiki');
  });

  it('sets conversation title from first user message (truncated to 100 chars)', () => {
    const longMessage = 'A'.repeat(150);
    saveMessage('store-test-conv-1', {
      id: 'msg-1',
      role: 'user',
      content: longMessage,
      timestamp: 1000,
    }, testUserId);

    const conversations = getConversations(testUserId);
    expect(conversations).toHaveLength(1);
    expect(conversations[0]!.title).toBe('A'.repeat(100));
  });

  it('does not set title from assistant message', () => {
    saveMessage('store-test-conv-1', {
      id: 'msg-1',
      role: 'assistant',
      content: 'Welcome!',
      timestamp: 1000,
    }, testUserId);

    const conversations = getConversations(testUserId);
    expect(conversations).toHaveLength(1);
    expect(conversations[0]!.title).toBeNull();
  });

  it('preserves message order', () => {
    saveMessage('store-test-conv-1', { id: 'msg-1', role: 'user', content: 'First', timestamp: 1000 }, testUserId);
    saveMessage('store-test-conv-1', { id: 'msg-2', role: 'assistant', content: 'Second', timestamp: 2000 });
    saveMessage('store-test-conv-1', { id: 'msg-3', role: 'user', content: 'Third', timestamp: 3000 });

    const messages = getMessages('store-test-conv-1');
    expect(messages).toHaveLength(3);
    expect(messages.map((m) => m.content)).toEqual(['First', 'Second', 'Third']);
  });

  it('returns empty array for nonexistent conversation', () => {
    expect(getMessages('no-such-conv')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Conversation listing
// ---------------------------------------------------------------------------

describe('getConversations', () => {
  it('returns empty array when user has no conversations', () => {
    expect(getConversations(testUserId)).toEqual([]);
  });

  it('returns conversations ordered by most recent', async () => {
    saveMessage('store-test-conv-1', { id: 'a1', role: 'user', content: 'Older', timestamp: 1000 }, testUserId);
    // Ensure different updatedAt timestamps (SQLite has second-level precision)
    await new Promise((r) => setTimeout(r, 1100));
    saveMessage('store-test-conv-2', { id: 'a2', role: 'user', content: 'Newer', timestamp: 2000 }, testUserId);

    const convs = getConversations(testUserId);
    expect(convs).toHaveLength(2);
    // Most recent first
    expect(convs[0]!.id).toBe('store-test-conv-2');
    expect(convs[1]!.id).toBe('store-test-conv-1');
  });

  it('does not return conversations from other users', () => {
    const otherUserId = 'other-user';
    db.insert(schema.users).values({
      id: otherUserId,
      email: 'other@test.com',
      passwordHash: 'hashed',
      name: 'Other',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    saveMessage('store-test-conv-1', { id: 'a1', role: 'user', content: 'Mine', timestamp: 1000 }, testUserId);
    saveMessage('store-test-conv-2', { id: 'a2', role: 'user', content: 'Theirs', timestamp: 2000 }, otherUserId);

    const myConvs = getConversations(testUserId);
    expect(myConvs).toHaveLength(1);
    expect(myConvs[0]!.id).toBe('store-test-conv-1');

    const theirConvs = getConversations(otherUserId);
    expect(theirConvs).toHaveLength(1);
    expect(theirConvs[0]!.id).toBe('store-test-conv-2');
  });
});

// ---------------------------------------------------------------------------
// clearHistory (DB + cache)
// ---------------------------------------------------------------------------

describe('clearHistory', () => {
  it('removes conversation and cascades to messages', () => {
    saveMessage('store-test-conv-1', { id: 'msg-1', role: 'user', content: 'Hello', timestamp: 1000 }, testUserId);
    saveMessage('store-test-conv-1', { id: 'msg-2', role: 'assistant', content: 'Hi', timestamp: 2000 });

    clearHistory('store-test-conv-1');

    expect(getConversations(testUserId)).toEqual([]);
    expect(getMessages('store-test-conv-1')).toEqual([]);
  });

  it('does not throw on clearing nonexistent conversation', () => {
    expect(() => clearHistory('no-such-conv')).not.toThrow();
  });
});
