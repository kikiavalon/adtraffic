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

describe('DELETE /api/conversations/:id', () => {
  beforeEach(async () => {
    const email = `conv-test-${Date.now()}@agency.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'SecurePass123', name: 'Test' });
    authToken = res.body.token;
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).delete('/api/conversations/test-conv-1');
    expect(res.status).toBe(401);
  });

  it('clears a conversation and returns success', async () => {
    const res = await request(app)
      .delete('/api/conversations/test-conv-1')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.conversationId).toBe('test-conv-1');
  });
});
