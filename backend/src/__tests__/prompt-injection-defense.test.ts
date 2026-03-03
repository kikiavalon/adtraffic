/**
 * Prompt injection defense tests.
 *
 * Validates:
 * - System prompt doesn't contain leakable secrets
 * - API input validation rejects injection-patterned payloads
 * - Message length limits prevent prompt stuffing attacks
 * - System prompt guardrails are structurally present
 * - getSystemPrompt() template injection is safe
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { KIKI_SYSTEM_PROMPT, getSystemPrompt } from '../claude/system-prompt.js';
import { db, schema } from '../db/index.js';

vi.mock('../claude/kiki-service.js', () => ({
  chat: vi.fn().mockImplementation(() => Promise.resolve({
    id: 'mock-id',
    role: 'assistant',
    content: 'Mock response',
    timestamp: Date.now(),
  })),
  clearConversation: vi.fn(),
}));

vi.mock('../claude/usage-tracker.js', () => ({
  checkLimit: () => ({ allowed: true }),
  recordUsage: () => {},
  getUsageSummary: () => ({ date: '2026-02-18', requests: 0, limit: 100, inputTokens: 0, outputTokens: 0, estimatedCost: '$0.00' }),
}));

// Mock audit-service to prevent fire-and-forget DB writes racing with test cleanup
vi.mock('../audit/audit-service.js', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  getAuditLog: vi.fn().mockResolvedValue([]),
  hashIp: vi.fn().mockReturnValue('test-hash'),
  VALID_EVENT_TYPES: ['message_sent', 'message_received', 'tool_executed', 'session_started', 'session_ended', 'button_clicked', 'tool_confirmed', 'tool_rejected', 'rate_limit_hit', 'daily_limit_reached', 'error', 'approval_requested', 'approval_granted'],
}));

describe('System prompt — no leakable secrets', () => {
  it('does not contain API keys', () => {
    expect(KIKI_SYSTEM_PROMPT).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(KIKI_SYSTEM_PROMPT).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(KIKI_SYSTEM_PROMPT).not.toMatch(/GOOGLE_CLIENT_SECRET/);
  });

  it('does not contain JWT secrets', () => {
    expect(KIKI_SYSTEM_PROMPT).not.toContain('JWT_SECRET');
    expect(KIKI_SYSTEM_PROMPT).not.toMatch(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/); // JWT pattern
  });

  it('does not contain database credentials', () => {
    expect(KIKI_SYSTEM_PROMPT).not.toContain('DATABASE_URL');
    expect(KIKI_SYSTEM_PROMPT).not.toMatch(/postgres:\/\//);
    expect(KIKI_SYSTEM_PROMPT).not.toMatch(/password\s*[:=]\s*['"][^'"]+['"]/i);
  });

  it('does not contain internal file paths', () => {
    expect(KIKI_SYSTEM_PROMPT).not.toMatch(/\/Users\//);
    expect(KIKI_SYSTEM_PROMPT).not.toMatch(/\/home\//);
    expect(KIKI_SYSTEM_PROMPT).not.toMatch(/node_modules/);
  });

  it('does not contain environment variable values (only placeholders)', () => {
    expect(KIKI_SYSTEM_PROMPT).not.toMatch(/process\.env\./);
  });
});

describe('System prompt — guardrail integrity', () => {
  it('contains write operation confirmation requirement', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/NEVER.*write.*without/i);
    expect(KIKI_SYSTEM_PROMPT).toMatch(/confirm/i);
    expect(KIKI_SYSTEM_PROMPT).toMatch(/preview/i);
  });

  it('contains data fabrication prohibition', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/NEVER.*fabricat/i);
  });

  it('contains honesty requirement', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/honest/i);
    expect(KIKI_SYSTEM_PROMPT).toMatch(/can.*t do something.*say so/i);
  });

  it('scopes Kiki to CM360 domain only', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/CM360|Campaign Manager 360/);
    expect(KIKI_SYSTEM_PROMPT).toMatch(/trafficking/i);
  });

  it('requires tool usage for real data (prevents hallucination)', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/don.*t guess/i);
    expect(KIKI_SYSTEM_PROMPT).toMatch(/tool/i);
  });
});

describe('getSystemPrompt() — template injection safety', () => {
  it('replaces account name placeholder', () => {
    const prompt = getSystemPrompt('Test Agency', '12345');
    expect(prompt).toContain('Test Agency');
    expect(prompt).toContain('12345');
    expect(prompt).not.toContain('{{ACCOUNT_NAME}}');
    expect(prompt).not.toContain('{{ACCOUNT_ID}}');
  });

  it('handles special characters in account name without breaking', () => {
    const prompt = getSystemPrompt('Agency "O\'Brien" & Sons <script>', '999');
    expect(prompt).toContain('Agency "O\'Brien" & Sons <script>');
    // The prompt should still be a valid string (not crash)
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('handles empty account name gracefully', () => {
    const prompt = getSystemPrompt('', '');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('uses defaults when called with no arguments', () => {
    const prompt = getSystemPrompt();
    expect(prompt).toContain('Demo Agency');
    expect(prompt).toContain('67890');
  });
});

describe('API input validation — injection defense', () => {
  let token: string;

  beforeAll(async () => {
    await db.delete(schema.approvalQueue);
    await db.delete(schema.auditLogs);
    await db.delete(schema.oauthTokens);
    await db.delete(schema.messages);
    await db.delete(schema.conversations);
    await db.delete(schema.users);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'injection-test@agency.com', password: 'SecurePass123', name: 'Tester' });
    token = res.body.token;
  });

  it('rejects messages exceeding 10000 character limit', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversationId: 'injection-test',
        message: 'x'.repeat(10001),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('rejects empty messages', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversationId: 'injection-test',
        message: '',
      });

    expect(res.status).toBe(400);
  });

  it('rejects conversationId exceeding 200 characters', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversationId: 'x'.repeat(201),
        message: 'Hello',
      });

    expect(res.status).toBe(400);
  });

  it('rejects non-string message types', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversationId: 'injection-test',
        message: 12345,
      });

    expect(res.status).toBe(400);
  });

  it('rejects missing conversationId', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'Hello',
      });

    expect(res.status).toBe(400);
  });

  it('strips unknown fields from request body', async () => {
    // Should succeed (unknown fields stripped by Zod, not rejected)
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversationId: 'injection-test',
        message: 'Hello',
        maliciousField: 'DROP TABLE users;',
      });

    // Should succeed — Zod strips extra fields
    expect(res.status).toBe(200);
  });
});

describe('Auth input validation — injection defense', () => {
  it('rejects email exceeding max length', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'x'.repeat(300) + '@test.com',
        password: 'SecurePass123',
        name: 'Test',
      });

    expect(res.status).toBe(400);
  });

  it('rejects password exceeding max length', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test-maxpw@agency.com',
        password: 'x'.repeat(200),
        name: 'Test',
      });

    expect(res.status).toBe(400);
  });

  it('rejects name exceeding max length', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test-maxname@agency.com',
        password: 'SecurePass123',
        name: 'x'.repeat(300),
      });

    expect(res.status).toBe(400);
  });

  it('rejects SQL injection in email field', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: "admin'--",
        password: 'password',
      });

    // Zod rejects invalid email format before it reaches the DB — 400 not 500
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input');
  });

  it('rejects SQL injection in password field', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@agency.com',
        password: "' OR '1'='1",
      });

    expect(res.status).toBe(401);
  });
});
