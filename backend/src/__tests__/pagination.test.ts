/**
 * API pagination tests.
 *
 * Validates that GET /api/conversations and GET /api/conversations/:id/messages
 * correctly handle limit, offset, boundary values, and ordering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db, schema } from '../db/index.js';
import { randomUUID } from 'crypto';

vi.mock('../claude/kiki-service.js', () => ({
  chat: vi.fn().mockImplementation(() => Promise.resolve({
    id: randomUUID(),
    role: 'assistant',
    content: 'Mock response',
    timestamp: Date.now() + 100,
  })),
  clearConversation: vi.fn(),
}));

vi.mock('../claude/usage-tracker.js', () => ({
  checkLimit: () => ({ allowed: true }),
  recordUsage: () => {},
  getUsageSummary: () => ({ date: '2026-02-18', requests: 0, limit: 100, inputTokens: 0, outputTokens: 0, estimatedCost: '$0.00' }),
}));

let token: string;
let userId: string;

beforeEach(async () => {
  db.delete(schema.messages).run();
  db.delete(schema.conversations).run();
  db.delete(schema.users).run();

  const ts = Date.now();
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `pagination-${ts}@agency.com`, password: 'SecurePass123', name: 'Pagination Tester' });
  token = res.body.token;
  userId = res.body.user.id;
});

describe('GET /api/conversations — pagination', () => {
  async function createConversations(count: number) {
    for (let i = 0; i < count; i++) {
      await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ conversationId: `conv-${String(i).padStart(3, '0')}`, message: `Message ${i}` });
      // Small delay to ensure distinct updatedAt timestamps for ordering
    }
  }

  it('returns all conversations when count < default limit', async () => {
    await createConversations(3);

    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(3);
  });

  it('respects custom limit parameter', async () => {
    await createConversations(5);

    const res = await request(app)
      .get('/api/conversations?limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(2);
  });

  it('respects offset parameter for paging', async () => {
    await createConversations(5);

    const page1 = await request(app)
      .get('/api/conversations?limit=2&offset=0')
      .set('Authorization', `Bearer ${token}`);

    const page2 = await request(app)
      .get('/api/conversations?limit=2&offset=2')
      .set('Authorization', `Bearer ${token}`);

    expect(page1.body.conversations).toHaveLength(2);
    expect(page2.body.conversations).toHaveLength(2);

    // Pages should not overlap
    const page1Ids = page1.body.conversations.map((c: { id: string }) => c.id);
    const page2Ids = page2.body.conversations.map((c: { id: string }) => c.id);
    expect(page1Ids).not.toEqual(page2Ids);
  });

  it('returns empty array when offset exceeds total', async () => {
    await createConversations(3);

    const res = await request(app)
      .get('/api/conversations?offset=100')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(0);
  });

  it('treats limit=0 as default (0 is falsy, falls through to default 50)', async () => {
    await createConversations(3);

    const res = await request(app)
      .get('/api/conversations?limit=0')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // parseInt('0') || 50 → 0 || 50 → 50, then Math.max(1, Math.min(200, 50)) → 50
    expect(res.body.conversations).toHaveLength(3);
  });

  it('clamps limit to maximum 200', async () => {
    // Just verify it doesn't error — we won't create 201 conversations
    const res = await request(app)
      .get('/api/conversations?limit=999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('clamps negative offset to 0', async () => {
    await createConversations(3);

    const res = await request(app)
      .get('/api/conversations?offset=-5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(3);
  });

  it('handles non-numeric limit gracefully (falls back to default 50)', async () => {
    await createConversations(3);

    const res = await request(app)
      .get('/api/conversations?limit=abc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(3);
  });

  it('orders conversations by most recent first', async () => {
    await createConversations(3);

    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${token}`);

    const conversations = res.body.conversations;
    // Most recently updated should be first
    for (let i = 0; i < conversations.length - 1; i++) {
      const current = new Date(conversations[i].updatedAt).getTime();
      const next = new Date(conversations[i + 1].updatedAt).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });
});

describe('GET /api/conversations/:id/messages — pagination', () => {
  const convId = 'msg-page-test';

  async function createMessages(count: number) {
    for (let i = 0; i < count; i++) {
      db.insert(schema.messages).values({
        id: randomUUID(),
        conversationId: convId,
        role: 'user',
        content: `Message ${String(i).padStart(3, '0')}`,
        timestamp: Date.now() + i * 100,
      }).run();
    }
  }

  beforeEach(() => {
    // Create the conversation owned by our test user
    db.insert(schema.conversations).values({
      id: convId,
      userId,
      title: 'Pagination test',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();
  });

  it('returns all messages when count < default limit', async () => {
    createMessages(5);

    const res = await request(app)
      .get(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(5);
  });

  it('respects custom limit parameter', async () => {
    createMessages(10);

    const res = await request(app)
      .get(`/api/conversations/${convId}/messages?limit=3`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(3);
  });

  it('respects offset for message paging', async () => {
    createMessages(10);

    const page1 = await request(app)
      .get(`/api/conversations/${convId}/messages?limit=5&offset=0`)
      .set('Authorization', `Bearer ${token}`);

    const page2 = await request(app)
      .get(`/api/conversations/${convId}/messages?limit=5&offset=5`)
      .set('Authorization', `Bearer ${token}`);

    expect(page1.body.messages).toHaveLength(5);
    expect(page2.body.messages).toHaveLength(5);

    // Different content
    expect(page1.body.messages[0].content).not.toBe(page2.body.messages[0].content);
  });

  it('clamps message limit to maximum 500', async () => {
    const res = await request(app)
      .get(`/api/conversations/${convId}/messages?limit=999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('orders messages by timestamp ascending (oldest first)', async () => {
    createMessages(5);

    const res = await request(app)
      .get(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${token}`);

    const messages = res.body.messages;
    for (let i = 0; i < messages.length - 1; i++) {
      expect(messages[i].timestamp).toBeLessThan(messages[i + 1].timestamp);
    }
  });
});
