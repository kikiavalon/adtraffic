/**
 * Tests for the requireAuth middleware — token validation, header parsing, edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db, schema } from '../db/index.js';

// Mock audit-service to prevent fire-and-forget DB writes racing with test cleanup
vi.mock('../audit/audit-service.js', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  getAuditLog: vi.fn().mockResolvedValue([]),
  hashIp: vi.fn().mockReturnValue('test-hash'),
  VALID_EVENT_TYPES: ['message_sent', 'message_received', 'tool_executed', 'session_started', 'session_ended', 'button_clicked', 'tool_confirmed', 'tool_rejected', 'rate_limit_hit', 'daily_limit_reached', 'error', 'approval_requested', 'approval_granted'],
}));

let authToken: string;

beforeEach(async () => {
  await db.delete(schema.approvalQueue);
  await db.delete(schema.auditLogs);
  await db.delete(schema.oauthTokens);
  await db.delete(schema.messages);
  await db.delete(schema.conversations);
  await db.delete(schema.users);

  const email = `middleware-${Date.now()}@test.com`;
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Test' });
  authToken = res.body.token;
});

describe('requireAuth middleware', () => {
  // Use GET /api/v1/conversations as a protected endpoint to test the middleware

  it('rejects request with no Authorization header', async () => {
    const res = await request(app).get('/api/v1/conversations');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('rejects request with empty Authorization header', async () => {
    const res = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', '');
    expect(res.status).toBe(401);
  });

  it('rejects request with "Basic" scheme instead of "Bearer"', async () => {
    const res = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', `Basic ${authToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('rejects request with "Bearer" but no token', async () => {
    const res = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
    // HTTP libraries may trim trailing whitespace, so "Bearer " becomes "Bearer"
    // which doesn't match startsWith('Bearer ') — returns "Authentication required"
    expect(res.body.error).toBe('Authentication required');
  });

  it('rejects request with malformed JWT', async () => {
    const res = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', 'Bearer not.a.valid.jwt');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });

  it('rejects request with tampered JWT payload', async () => {
    // Take a valid token, modify the payload segment
    const parts = authToken.split('.');
    const tamperedPayload = Buffer.from('{"userId":"hacker","email":"hacker@evil.com"}').toString('base64url');
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const res = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('accepts request with valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('rejects request with "bearer" (lowercase)', async () => {
    const res = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', `bearer ${authToken}`);
    // "Bearer" check is case-sensitive in the middleware
    expect(res.status).toBe(401);
  });
});
