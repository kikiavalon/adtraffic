/**
 * Tests for the httpOnly session-cookie auth path: cookies set on register/login,
 * accepted by the middleware, surfaced by /auth/me, and cleared by /auth/logout.
 * The Bearer-token path is kept for API clients and must still work.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db, schema } from '../db/index.js';

vi.mock('../audit/audit-service.js', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  getAuditLog: vi.fn().mockResolvedValue([]),
  hashIp: vi.fn().mockReturnValue('test-hash'),
  VALID_EVENT_TYPES: ['message_sent', 'message_received', 'tool_executed', 'session_started', 'session_ended', 'button_clicked', 'tool_confirmed', 'tool_rejected', 'rate_limit_hit', 'daily_limit_reached', 'error', 'approval_requested', 'approval_granted'],
}));

const AUTH_COOKIE = 'adtraffic_token';

function setCookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return (raw ?? []).join('; ');
}

function extractAuthCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = (raw ?? []).find((c) => c.startsWith(`${AUTH_COOKIE}=`));
  if (!cookie) throw new Error('no auth cookie set');
  return cookie.split(';')[0]!; // "adtraffic_token=<jwt>"
}

describe('Cookie-based auth', () => {
  beforeEach(async () => {
    await db.delete(schema.approvalQueue);
    await db.delete(schema.auditLogs);
    await db.delete(schema.oauthTokens);
    await db.delete(schema.messages);
    await db.delete(schema.conversations);
    await db.delete(schema.users);
  });

  function registerUser(email: string) {
    return request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'SecurePass123', name: 'Cookie User' });
  }

  it('sets an httpOnly, SameSite=Lax session cookie on register', async () => {
    const res = await registerUser('cookie-reg@test.com');
    expect(res.status).toBe(201);
    const header = setCookieHeader(res);
    expect(header).toContain(`${AUTH_COOKIE}=`);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
  });

  it('sets the session cookie on login', async () => {
    await registerUser('cookie-login@test.com');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'cookie-login@test.com', password: 'SecurePass123' });
    expect(res.status).toBe(200);
    expect(() => extractAuthCookie(res)).not.toThrow();
  });

  it('authenticates a protected route via the cookie alone (no Bearer header)', async () => {
    const reg = await registerUser('cookie-protected@test.com');
    const cookie = extractAuthCookie(reg);
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  it('GET /auth/me returns the current user when authenticated via cookie', async () => {
    const reg = await registerUser('cookie-me@test.com');
    const cookie = extractAuthCookie(reg);
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('cookie-me@test.com');
    expect(res.body.user.name).toBe('Cookie User');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('GET /auth/me returns 401 without a session', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed cookie value with 401, not a 500', async () => {
    // A lone percent would throw in decodeURIComponent if not guarded.
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `${AUTH_COOKIE}=%`);
    expect(res.status).toBe(401);
  });

  it('POST /auth/logout clears the session cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    const header = setCookieHeader(res);
    expect(header).toContain(`${AUTH_COOKIE}=`);
    // clearCookie sets an already-expired cookie.
    expect(header).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
  });

  it('still accepts a Bearer token (backward compatible)', async () => {
    const reg = await registerUser('cookie-bearer@test.com');
    const token = reg.body.token as string;
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('cookie-bearer@test.com');
  });
});
