import { describe, it, expect, vi } from 'vitest';
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

describe('DELETE /api/conversations/:id', () => {
  it('clears a conversation and returns success', async () => {
    const res = await request(app).delete('/api/conversations/test-conv-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.conversationId).toBe('test-conv-1');
  });
});
