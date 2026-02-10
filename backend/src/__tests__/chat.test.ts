import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index.js';

describe('POST /api/chat', () => {
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
});
