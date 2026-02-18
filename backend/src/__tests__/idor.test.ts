/**
 * Cross-user IDOR (Insecure Direct Object Reference) tests.
 *
 * Validates that User A cannot access, modify, or delete User B's
 * conversations through direct ID manipulation on any endpoint.
 *
 * These tests create two separate authenticated users and verify
 * that ownership checks prevent unauthorized cross-user access.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db, schema } from '../db/index.js';

vi.mock('../claude/kiki-service.js', () => ({
  chat: vi.fn().mockImplementation(() => Promise.resolve({
    id: 'mock-assistant-id',
    role: 'assistant',
    content: 'Mock response',
    timestamp: Date.now() + 100,
  })),
  clearConversation: vi.fn(),
}));

let tokenA: string;
let tokenB: string;

describe('Cross-user IDOR protection', () => {
  beforeEach(async () => {
    await db.delete(schema.messages);
    await db.delete(schema.conversations);
    await db.delete(schema.users);

    const ts = Date.now();

    // Create User A
    const resA = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: `idor-a-${ts}@agency.com`, password: 'SecurePass123', name: 'User A' });
    tokenA = resA.body.token;

    // Create User B
    const resB = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: `idor-b-${ts}@agency.com`, password: 'SecurePass123', name: 'User B' });
    tokenB = resB.body.token;

    // User A creates a conversation
    await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ conversationId: 'userA-conv-1', message: 'Hello from User A' });
  });

  describe('GET /api/v1/conversations', () => {
    it('User B cannot see User A\'s conversations in listing', async () => {
      const res = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(0);
    });

    it('User A sees only their own conversations', async () => {
      // User B creates their own conversation
      await request(app)
        .post('/api/v1/chat')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ conversationId: 'userB-conv-1', message: 'Hello from User B' });

      const resA = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.conversations).toHaveLength(1);
      expect(resA.body.conversations[0].id).toBe('userA-conv-1');
    });
  });

  describe('GET /api/v1/conversations/:id/messages', () => {
    it('User B cannot read User A\'s messages by ID', async () => {
      const res = await request(app)
        .get('/api/v1/conversations/userA-conv-1/messages')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');
    });

    it('User A can read their own messages', async () => {
      const res = await request(app)
        .get('/api/v1/conversations/userA-conv-1/messages')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/v1/conversations/:id', () => {
    it('User B cannot delete User A\'s conversation', async () => {
      const res = await request(app)
        .delete('/api/v1/conversations/userA-conv-1')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');
    });

    it('User A\'s conversation still exists after User B\'s failed delete attempt', async () => {
      // User B tries to delete
      await request(app)
        .delete('/api/v1/conversations/userA-conv-1')
        .set('Authorization', `Bearer ${tokenB}`);

      // User A can still access it
      const res = await request(app)
        .get('/api/v1/conversations/userA-conv-1/messages')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBeGreaterThan(0);
    });

    it('User A can delete their own conversation', async () => {
      const res = await request(app)
        .delete('/api/v1/conversations/userA-conv-1')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/chat (conversation hijacking)', () => {
    it('User B cannot post to User A\'s existing conversation', async () => {
      const res = await request(app)
        .post('/api/v1/chat')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ conversationId: 'userA-conv-1', message: 'Hijacking attempt' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');
    });

    it('User A\'s conversation is unmodified after hijack attempt', async () => {
      // User B tries to inject a message
      await request(app)
        .post('/api/v1/chat')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ conversationId: 'userA-conv-1', message: 'Hijacking attempt' });

      // User A checks messages — should only see original messages
      const res = await request(app)
        .get('/api/v1/conversations/userA-conv-1/messages')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      // Should have 2 messages: original user + assistant, NOT the hijack attempt
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.messages[0].content).toBe('Hello from User A');
    });
  });
});
