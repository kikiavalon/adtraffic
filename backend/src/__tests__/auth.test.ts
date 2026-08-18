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

describe('Auth API', () => {
  beforeEach(async () => {
    // Clear all data in correct order (dependent tables first due to FK)
    await db.delete(schema.approvalQueue);
    await db.delete(schema.auditLogs);
    await db.delete(schema.oauthTokens);
    await db.delete(schema.messages);
    await db.delete(schema.conversations);
    await db.delete(schema.users);
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and returns token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@agency.com',
          password: 'SecurePass123',
          name: 'Test User',
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('test@agency.com');
      expect(res.body.user.name).toBe('Test User');
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('rejects duplicate email', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@agency.com', password: 'SecurePass123', name: 'User 1' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@agency.com', password: 'DifferentPass456', name: 'User 2' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Registration failed');
    });

    it('rejects short password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@agency.com', password: 'short', name: 'User' });

      expect(res.status).toBe(400);
    });

    it('rejects invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'SecurePass123', name: 'User' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in with valid credentials', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'login@agency.com', password: 'SecurePass123', name: 'Login User' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'login@agency.com', password: 'SecurePass123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('login@agency.com');
    });

    it('rejects wrong password', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'wrong@agency.com', password: 'SecurePass123', name: 'User' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'wrong@agency.com', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('rejects non-existent user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@agency.com', password: 'Whatever123' });

      expect(res.status).toBe(401);
    });
  });
});
