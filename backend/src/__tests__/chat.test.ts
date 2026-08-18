import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

vi.mock('../claude/kiki-service.js', () => ({
  chat: vi.fn().mockResolvedValue({
    id: 'mock-id',
    role: 'assistant',
    content: 'Mock response',
    timestamp: 1234567890,
  }),
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

describe('POST /api/v1/chat', () => {
  beforeEach(async () => {
    // Atomic cleanup — TRUNCATE CASCADE handles FK ordering automatically
    // and prevents race conditions from fire-and-forget DB writes
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);

    const email = `chat-test-${Date.now()}@agency.com`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'SecurePass123', name: 'Test' });
    authToken = res.body.token;
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ conversationId: 'test-1', message: 'Hello' });

    expect(res.status).toBe(401);
  });

  it('returns Kiki response for valid chat request', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'test-1', message: 'Hello Kiki' });

    expect(res.status).toBe(200);
    expect(res.body.conversationId).toBe('test-1');
    expect(res.body.message.role).toBe('assistant');
    expect(res.body.message.content).toBe('Mock response');
  });

  it('rejects missing message field', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'test-1' });

    expect(res.status).toBe(400);
  });

  it('rejects missing conversationId field', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: 'Hello' });

    expect(res.status).toBe(400);
  });

  it('rejects empty message', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'test-1', message: '' });

    expect(res.status).toBe(400);
  });
});
