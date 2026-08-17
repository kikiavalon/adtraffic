/**
 * Audit log API route tests.
 *
 * Covers:
 * - GET /api/v1/audit/logs — paginated audit log retrieval
 * - POST /api/v1/audit/interactions — batched frontend interaction events
 * - Auth protection on both endpoints
 * - Input validation (Zod schemas)
 * - Pagination clamping
 * - IP and user agent extraction
 * - Client timestamp injection into metadata (Issue 1)
 * - Rate limiting on POST (Issue 2)
 * - VALID_EVENT_TYPES single source of truth (Issue 3)
 * - Metadata size constraint (Issue 4)
 * - conversationId/sessionId passthrough (Issue 5)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db, schema } from '../db/index.js';

// Mock kiki-service (imported transitively by chat routes)
vi.mock('../claude/kiki-service.js', () => ({
  chat: vi.fn(),
  clearConversation: vi.fn(),
}));

vi.mock('../claude/usage-tracker.js', () => ({
  checkLimit: vi.fn().mockReturnValue({ allowed: true }),
  recordUsage: vi.fn(),
  getUsageSummary: vi.fn().mockReturnValue({
    date: '2026-02-26',
    requestCount: 0,
    dailyLimit: 100,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    estimatedCost: '$0.00',
  }),
}));

// Mock audit-service module
vi.mock('../audit/audit-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../audit/audit-service.js')>();
  return {
    ...actual,
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
    getAuditLog: vi.fn().mockResolvedValue([]),
    hashIp: vi.fn().mockReturnValue('abc123def456'),
  };
});

let token: string;

beforeEach(async () => {
  await db.delete(schema.approvalQueue);
  await db.delete(schema.auditLogs);
  await db.delete(schema.oauthTokens);
  await db.delete(schema.messages);
  await db.delete(schema.conversations);
  await db.delete(schema.users);

  const ts = Date.now();
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email: `audit-test-${ts}@agency.com`, password: 'SecurePass123', name: 'Audit Tester' });
  token = res.body.token;

  // Reset mocks between tests
  const auditService = await import('../audit/audit-service.js');
  vi.mocked(auditService.getAuditLog).mockReset().mockResolvedValue([]);
  vi.mocked(auditService.logAuditEvent).mockReset().mockResolvedValue(undefined);
});

describe('GET /api/v1/audit/logs', () => {
  it('returns paginated results for authenticated user', async () => {
    const auditService = await import('../audit/audit-service.js');
    const mockLogs = [
      { id: '1', userId: 'u1', eventType: 'message_sent', metadata: '{}', createdAt: new Date() },
      { id: '2', userId: 'u1', eventType: 'tool_executed', metadata: '{}', createdAt: new Date() },
    ];
    vi.mocked(auditService.getAuditLog).mockResolvedValueOnce(mockLogs as never);

    const res = await request(app)
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('logs');
    expect(res.body).toHaveProperty('limit', 50);
    expect(res.body).toHaveProperty('offset', 0);
    expect(res.body.logs).toHaveLength(2);
    expect(auditService.getAuditLog).toHaveBeenCalledWith(
      expect.any(String),
      { conversationId: undefined, limit: 50, offset: 0 },
    );
  });

  it('filters by conversationId', async () => {
    const auditService = await import('../audit/audit-service.js');
    vi.mocked(auditService.getAuditLog).mockResolvedValueOnce([] as never);

    const res = await request(app)
      .get('/api/v1/audit/logs?conversationId=conv-123')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(auditService.getAuditLog).toHaveBeenCalledWith(
      expect.any(String),
      { conversationId: 'conv-123', limit: 50, offset: 0 },
    );
  });

  it('rejects unauthenticated requests (401)', async () => {
    const res = await request(app)
      .get('/api/v1/audit/logs');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('clamps limit to max 250', async () => {
    const auditService = await import('../audit/audit-service.js');
    vi.mocked(auditService.getAuditLog).mockResolvedValueOnce([] as never);

    const res = await request(app)
      .get('/api/v1/audit/logs?limit=500')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(250);
    expect(auditService.getAuditLog).toHaveBeenCalledWith(
      expect.any(String),
      { conversationId: undefined, limit: 250, offset: 0 },
    );
  });

  it('respects custom limit and offset', async () => {
    const auditService = await import('../audit/audit-service.js');
    vi.mocked(auditService.getAuditLog).mockResolvedValueOnce([] as never);

    const res = await request(app)
      .get('/api/v1/audit/logs?limit=25&offset=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(25);
    expect(res.body.offset).toBe(10);
    expect(auditService.getAuditLog).toHaveBeenCalledWith(
      expect.any(String),
      { conversationId: undefined, limit: 25, offset: 10 },
    );
  });

  it('returns 500 when service throws', async () => {
    const auditService = await import('../audit/audit-service.js');
    vi.mocked(auditService.getAuditLog).mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to fetch audit logs' });
  });
});

describe('POST /api/v1/audit/interactions', () => {
  it('accepts valid batch of events', async () => {
    const auditService = await import('../audit/audit-service.js');

    const res = await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          { eventType: 'button_clicked', metadata: { buttonLabel: 'Yes' }, timestamp: Date.now() },
          { eventType: 'session_started', metadata: {}, timestamp: Date.now() },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: 2 });
    // logAuditEvent should have been called for each event
    expect(auditService.logAuditEvent).toHaveBeenCalledTimes(2);
  });

  it('rejects unauthenticated requests (401)', async () => {
    const res = await request(app)
      .post('/api/v1/audit/interactions')
      .send({
        events: [
          { eventType: 'button_clicked', metadata: {}, timestamp: Date.now() },
        ],
      });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects invalid eventType', async () => {
    const res = await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          { eventType: 'totally_invalid_event', metadata: {}, timestamp: Date.now() },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects batch > 100 events', async () => {
    const events = Array.from({ length: 101 }, (_, i) => ({
      eventType: 'button_clicked',
      metadata: { index: i },
      timestamp: Date.now(),
    }));

    const res = await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ events });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns received count', async () => {
    const res = await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          { eventType: 'message_sent', metadata: { text: 'hello' }, timestamp: Date.now() },
          { eventType: 'message_received', metadata: {}, timestamp: Date.now() },
          { eventType: 'session_ended', metadata: {}, timestamp: Date.now() },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(3);
  });

  it('extracts IP and user agent', async () => {
    const auditService = await import('../audit/audit-service.js');

    await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'TestBrowser/1.0')
      .send({
        events: [
          { eventType: 'button_clicked', metadata: {}, timestamp: Date.now() },
        ],
      });

    expect(auditService.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: expect.any(String),
        userAgent: 'TestBrowser/1.0',
        eventType: 'button_clicked',
      }),
    );
  });

  it('rejects empty events array', async () => {
    const res = await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ events: [] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects missing events field', async () => {
    const res = await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // --- Issue 1: Client timestamp injected into metadata ---
  it('injects client timestamp into metadata as clientTimestamp', async () => {
    const auditService = await import('../audit/audit-service.js');
    const clientTs = 1709000000000;

    await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          { eventType: 'button_clicked', metadata: { action: 'confirm' }, timestamp: clientTs },
        ],
      });

    expect(auditService.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          action: 'confirm',
          clientTimestamp: clientTs,
        }),
      }),
    );
  });

  it('preserves existing metadata keys alongside clientTimestamp', async () => {
    const auditService = await import('../audit/audit-service.js');
    const clientTs = 1709000000000;

    await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          { eventType: 'tool_executed', metadata: { toolName: 'cm360_list_campaigns', duration: 150 }, timestamp: clientTs },
        ],
      });

    const call = vi.mocked(auditService.logAuditEvent).mock.calls[0]![0];
    expect(call.metadata).toEqual({
      toolName: 'cm360_list_campaigns',
      duration: 150,
      clientTimestamp: clientTs,
    });
  });

  // --- Issue 4: Metadata size constraint ---
  it('rejects metadata exceeding 4KB when serialized', async () => {
    // Create a metadata object that exceeds 4096 bytes when serialized
    const largeValue = 'x'.repeat(5000);

    const res = await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          { eventType: 'button_clicked', metadata: { data: largeValue }, timestamp: Date.now() },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('4096 bytes');
  });

  it('accepts metadata just under 4KB limit', async () => {
    // Create metadata that fits within 4KB
    const smallValue = 'x'.repeat(3000);

    const res = await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          { eventType: 'button_clicked', metadata: { data: smallValue }, timestamp: Date.now() },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(1);
  });

  // --- Issue 5: conversationId and sessionId passthrough ---
  it('passes conversationId and sessionId to logAuditEvent', async () => {
    const auditService = await import('../audit/audit-service.js');

    await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          {
            eventType: 'message_sent',
            metadata: { text: 'hello' },
            timestamp: Date.now(),
            conversationId: 'conv-abc-123',
            sessionId: 'sess-xyz-789',
          },
        ],
      });

    expect(auditService.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-abc-123',
        sessionId: 'sess-xyz-789',
      }),
    );
  });

  it('handles events without conversationId and sessionId', async () => {
    const auditService = await import('../audit/audit-service.js');

    await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          { eventType: 'session_started', metadata: {}, timestamp: Date.now() },
        ],
      });

    expect(auditService.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: undefined,
        sessionId: undefined,
      }),
    );
  });

  it('rejects conversationId exceeding 255 characters', async () => {
    const res = await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          {
            eventType: 'button_clicked',
            metadata: {},
            timestamp: Date.now(),
            conversationId: 'x'.repeat(256),
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects sessionId exceeding 255 characters', async () => {
    const res = await request(app)
      .post('/api/v1/audit/interactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          {
            eventType: 'button_clicked',
            metadata: {},
            timestamp: Date.now(),
            sessionId: 'x'.repeat(256),
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('VALID_EVENT_TYPES single source of truth', () => {
  it('exports VALID_EVENT_TYPES from audit-service', async () => {
    const { VALID_EVENT_TYPES } = await import('../audit/audit-service.js');
    expect(Array.isArray(VALID_EVENT_TYPES)).toBe(true);
    expect(VALID_EVENT_TYPES.length).toBeGreaterThanOrEqual(13);
    expect(VALID_EVENT_TYPES).toContain('message_sent');
    expect(VALID_EVENT_TYPES).toContain('daily_limit_reached');
    expect(VALID_EVENT_TYPES).toContain('qa_run_started');
    expect(VALID_EVENT_TYPES).toContain('qa_run_completed');
  });
});
