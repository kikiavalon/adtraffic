import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db, schema } from '../db/index.js';

vi.mock('../claude/kiki-service.js', () => ({
  chat: vi.fn().mockImplementation(() => Promise.resolve({
    id: 'mock-assistant-id',
    role: 'assistant',
    content: 'Mock response',
    timestamp: Date.now() + 100, // Ensure assistant timestamp is after user's Date.now()
  })),
  clearConversation: vi.fn(),
}));

// Mock audit-service to prevent fire-and-forget DB writes racing with test cleanup
vi.mock('../audit/audit-service.js', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  getAuditLog: vi.fn().mockResolvedValue([]),
  hashIp: vi.fn().mockReturnValue('test-hash'),
  VALID_EVENT_TYPES: ['message_sent', 'message_received', 'tool_executed', 'session_started', 'session_ended', 'button_clicked', 'tool_confirmed', 'tool_rejected', 'rate_limit_hit', 'daily_limit_reached', 'error', 'approval_requested', 'approval_granted'],
}));

let authToken: string;

describe('Conversations API', () => {
  beforeEach(async () => {
    // Clear all data in correct order (dependent tables first due to FK)
    await db.delete(schema.approvalQueue);
    await db.delete(schema.auditLogs);
    await db.delete(schema.oauthTokens);
    await db.delete(schema.messages);
    await db.delete(schema.conversations);
    await db.delete(schema.users);

    // Register test user with unique email
    const email = `conv-test-${Date.now()}@agency.com`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'SecurePass123', name: 'Test' });
    authToken = res.body.token;
  });

  describe('DELETE /api/v1/conversations/:id', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).delete('/api/v1/conversations/test-conv-1');
      expect(res.status).toBe(401);
    });

    it('returns 404 when conversation does not exist', async () => {
      const res = await request(app)
        .delete('/api/v1/conversations/test-conv-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Conversation not found');
    });

    it('clears a conversation and returns success', async () => {
      // First create the conversation by sending a chat message
      await request(app)
        .post('/api/v1/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ conversationId: 'test-conv-1', message: 'Hello Kiki' });

      const res = await request(app)
        .delete('/api/v1/conversations/test-conv-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/conversations', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/conversations');
      expect(res.status).toBe(401);
    });

    it('returns empty list when no conversations', async () => {
      const res = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toEqual([]);
    });

    it('returns conversations after chatting', async () => {
      // Send a chat message (triggers message persistence)
      await request(app)
        .post('/api/v1/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ conversationId: 'test-conv-1', message: 'Hello Kiki' });

      const res = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(1);
      expect(res.body.conversations[0].id).toBe('test-conv-1');
      expect(res.body.conversations[0].title).toBe('Hello Kiki');
    });
  });

  describe('GET /api/v1/conversations/:id/messages', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/conversations/test-conv-1/messages');
      expect(res.status).toBe(401);
    });

    it('returns messages for a conversation', async () => {
      // Send a chat message
      await request(app)
        .post('/api/v1/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ conversationId: 'test-conv-2', message: 'What campaigns exist?' });

      const res = await request(app)
        .get('/api/v1/conversations/test-conv-2/messages')
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
        .get('/api/v1/conversations/nonexistent/messages')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Conversation not found');
    });
  });
});
