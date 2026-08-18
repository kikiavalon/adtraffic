import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { chat, chatStream } from '../claude/kiki-service.js';
import { NoAnthropicKeyError } from '../claude/anthropic-key-service.js';

vi.mock('../claude/kiki-service.js', () => ({
  chat: vi.fn(),
  chatStream: vi.fn(),
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

describe('POST /api/v1/chat — no Anthropic key', () => {
  beforeEach(async () => {
    // Atomic cleanup — TRUNCATE CASCADE handles FK ordering automatically
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);

    vi.mocked(chat).mockReset();
    vi.mocked(chatStream).mockReset();

    const email = `chat-no-key-${Date.now()}@agency.com`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'SecurePass123', name: 'Test' });
    authToken = res.body.token;
  });

  it('returns 428 with no_anthropic_key code when chat throws NoAnthropicKeyError', async () => {
    vi.mocked(chat).mockRejectedValueOnce(new NoAnthropicKeyError());

    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'no-key-1', message: 'Hello Kiki' });

    expect(res.status).toBe(428);
    expect(res.body.code).toBe('no_anthropic_key');
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it('emits an SSE error event with no_anthropic_key code when chatStream throws NoAnthropicKeyError', async () => {
    vi.mocked(chatStream).mockRejectedValueOnce(new NoAnthropicKeyError());

    const res = await request(app)
      .post('/api/v1/chat/stream')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'no-key-2', message: 'Hello Kiki' });

    // SSE handshake already returned HTTP 200 before chatStream ran
    expect(res.status).toBe(200);
    expect(res.text).toContain('event: error');
    expect(res.text).toContain('"code":"no_anthropic_key"');
  });

  it('still returns 200 on the happy path when chat resolves a normal message', async () => {
    vi.mocked(chat).mockResolvedValueOnce({
      id: 'mock-id',
      role: 'assistant',
      content: 'Mock response',
      timestamp: 1234567890,
    });

    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'happy-1', message: 'Hello Kiki' });

    expect(res.status).toBe(200);
    expect(res.body.message.role).toBe('assistant');
    expect(res.body.message.content).toBe('Mock response');
  });
});
