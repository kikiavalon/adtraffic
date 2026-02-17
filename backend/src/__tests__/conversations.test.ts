import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db, schema } from '../db/index.js';

vi.mock('../claude/kiki-service.js', () => ({
  chat: vi.fn().mockResolvedValue({
    id: 'mock-assistant-id',
    role: 'assistant',
    content: 'Mock response',
    timestamp: 1234567890,
  }),
  clearConversation: vi.fn(),
}));

let authToken: string;

describe('Conversations API', () => {
  beforeEach(async () => {
    // Clear all data in correct order (messages first due to FK)
    db.delete(schema.messages).run();
    db.delete(schema.conversations).run();
    db.delete(schema.users).run();

    // Register test user with unique email
    const email = `conv-test-${Date.now()}@agency.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'SecurePass123', name: 'Test' });
    authToken = res.body.token;
  });

  describe('DELETE /api/conversations/:id', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).delete('/api/conversations/test-conv-1');
      expect(res.status).toBe(401);
    });

    it('returns 404 when conversation does not exist', async () => {
      const res = await request(app)
        .delete('/api/conversations/test-conv-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Conversation not found');
    });

    it('clears a conversation and returns success', async () => {
      // First create the conversation by sending a chat message
      await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ conversationId: 'test-conv-1', message: 'Hello Kiki' });

      const res = await request(app)
        .delete('/api/conversations/test-conv-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/conversations', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/conversations');
      expect(res.status).toBe(401);
    });

    it('returns empty list when no conversations', async () => {
      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toEqual([]);
    });

    it('returns conversations after chatting', async () => {
      // Send a chat message (triggers message persistence)
      await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ conversationId: 'test-conv-1', message: 'Hello Kiki' });

      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(1);
      expect(res.body.conversations[0].id).toBe('test-conv-1');
      expect(res.body.conversations[0].title).toBe('Hello Kiki');
    });
  });

  describe('GET /api/conversations/:id/messages', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/conversations/test-conv-1/messages');
      expect(res.status).toBe(401);
    });

    it('returns messages for a conversation', async () => {
      // Send a chat message
      await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ conversationId: 'test-conv-2', message: 'What campaigns exist?' });

      const res = await request(app)
        .get('/api/conversations/test-conv-2/messages')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.messages[0].role).toBe('user');
      expect(res.body.messages[0].content).toBe('What campaigns exist?');
      expect(res.body.messages[1].role).toBe('assistant');
      expect(res.body.messages[1].content).toBe('Mock response');
    });

    it('returns 404 for non-existent conversation', async () => {
      const res = await request(app)
        .get('/api/conversations/nonexistent/messages')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Conversation not found');
    });
  });
});
