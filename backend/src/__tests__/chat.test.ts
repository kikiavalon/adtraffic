import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';

// Mock the kiki-service module so we don't call the real Claude API
vi.mock('../claude/kiki-service.js', () => ({
  chat: vi.fn().mockResolvedValue({
    id: 'mock-id',
    role: 'assistant',
    content: "I'm Kiki! Mock response for testing.",
    timestamp: 1234567890,
  }),
}));

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a response for valid message', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({
        conversationId: 'test-conv-1',
        message: 'Show me all Toyota campaigns',
      });

    expect(res.status).toBe(200);
    expect(res.body.conversationId).toBe('test-conv-1');
    expect(res.body.message.role).toBe('assistant');
    expect(res.body.message.content).toContain('Kiki');
    expect(res.body.message.id).toBeDefined();
    expect(res.body.message.timestamp).toBeDefined();
  });

  it('rejects empty message', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({
        conversationId: 'test-conv-1',
        message: '',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('rejects missing conversationId', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({
        message: 'Hello',
      });

    expect(res.status).toBe(400);
  });

  it('accepts message with file attachment', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({
        conversationId: 'test-conv-1',
        message: 'Parse this IO',
        attachment: {
          name: 'ESPN_IO.pdf',
          type: 'application/pdf',
          data: 'base64data',
          sizeBytes: 1024,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.message.role).toBe('assistant');
  });

  it('returns 500 when Claude API fails', async () => {
    const { chat } = await import('../claude/kiki-service.js');
    const mockChat = vi.mocked(chat);
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));

    const res = await request(app)
      .post('/api/chat')
      .send({
        conversationId: 'test-conv-1',
        message: 'Hello',
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to get response from Kiki');
  });
});
