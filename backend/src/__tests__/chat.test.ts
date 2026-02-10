import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';

vi.mock('../claude/kiki-service.js', () => ({
  chat: vi.fn().mockResolvedValue({
    id: 'mock-id',
    role: 'assistant',
    content: 'Mock response',
    timestamp: 1234567890,
  }),
  clearConversation: vi.fn(),
}));

let authToken: string;

describe('POST /api/chat', () => {
  beforeEach(async () => {
    const email = `chat-test-${Date.now()}@agency.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'SecurePass123', name: 'Test' });
    authToken = res.body.token;
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ conversationId: 'test-1', message: 'Hello' });

    expect(res.status).toBe(401);
  });

  it('returns Kiki response for valid chat request', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'test-1', message: 'Hello Kiki' });

    expect(res.status).toBe(200);
    expect(res.body.conversationId).toBe('test-1');
    expect(res.body.message.role).toBe('assistant');
    expect(res.body.message.content).toBe('Mock response');
  });

  it('rejects missing message field', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'test-1' });

    expect(res.status).toBe(400);
  });

  it('rejects missing conversationId field', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: 'Hello' });

    expect(res.status).toBe(400);
  });

  it('rejects empty message', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'test-1', message: '' });

    expect(res.status).toBe(400);
  });
});
