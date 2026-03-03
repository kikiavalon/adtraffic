import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock requireAuth middleware — inject test user
vi.mock('../auth/middleware.js', () => ({
  requireAuth: (req: { user?: { userId: string; email: string } }, _res: unknown, next: () => void) => {
    req.user = { userId: 'test-user-id', email: 'test@example.com' };
    next();
  },
}));

// Mock session cache
const mockClearSessionCache = vi.fn().mockResolvedValue(undefined);
vi.mock('../cm360/session-cache.js', () => ({
  clearSessionCache: (...args: unknown[]) => mockClearSessionCache(...args),
}));

// Mock audit service
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('../audit/audit-service.js', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
  VALID_EVENT_TYPES: ['session_started', 'session_ended'],
}));

// Mock DB (required by index.ts)
vi.mock('../db/index.js', () => ({
  db: {},
  schema: {},
  sql: { end: vi.fn() },
}));

// Mock Redis (required by index.ts)
vi.mock('../db/redis.js', () => ({
  initRedis: vi.fn(),
  closeRedis: vi.fn(),
  getRedis: vi.fn(),
  isRedisHealthy: vi.fn().mockReturnValue(false),
}));

// Mock Sentry (required by index.ts)
vi.mock('../sentry.js', () => ({
  initSentry: vi.fn(),
  Sentry: {
    setupExpressErrorHandler: vi.fn(),
  },
}));

// Mock usage tracker (required by chat route)
vi.mock('../claude/usage-tracker.js', () => ({
  checkDailyLimit: vi.fn().mockReturnValue({ allowed: true }),
  recordUsage: vi.fn(),
  getUsageSummary: vi.fn().mockReturnValue({
    requestsToday: 0,
    dailyLimit: 100,
    remaining: 100,
    estimatedCostToday: '$0.00',
  }),
}));

import app from '../index.js';

describe('Session lifecycle API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/sessions/start', () => {
    it('returns 200 with status started and cacheTtlSeconds', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/start')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('started');
      expect(typeof res.body.cacheTtlSeconds).toBe('number');
      expect(res.body.cacheTtlSeconds).toBeGreaterThan(0);
    });

    it('clears stale cache for the user', async () => {
      await request(app)
        .post('/api/v1/sessions/start')
        .send();

      expect(mockClearSessionCache).toHaveBeenCalledWith('test-user-id');
    });

    it('logs session_started audit event', async () => {
      await request(app)
        .post('/api/v1/sessions/start')
        .send();

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-id',
          eventType: 'session_started',
        }),
      );
    });

    it('returns 500 when clearSessionCache fails', async () => {
      mockClearSessionCache.mockRejectedValueOnce(new Error('Redis connection lost'));

      const res = await request(app)
        .post('/api/v1/sessions/start')
        .send();

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to start session');
    });
  });

  describe('DELETE /api/v1/sessions/end', () => {
    it('returns 200 with status ended', async () => {
      const res = await request(app)
        .delete('/api/v1/sessions/end')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ended');
    });

    it('clears session cache for the user', async () => {
      await request(app)
        .delete('/api/v1/sessions/end')
        .send();

      expect(mockClearSessionCache).toHaveBeenCalledWith('test-user-id');
    });

    it('logs session_ended audit event', async () => {
      await request(app)
        .delete('/api/v1/sessions/end')
        .send();

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-id',
          eventType: 'session_ended',
        }),
      );
    });

    it('returns 500 when clearSessionCache fails', async () => {
      mockClearSessionCache.mockRejectedValueOnce(new Error('Redis connection lost'));

      const res = await request(app)
        .delete('/api/v1/sessions/end')
        .send();

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to end session');
    });
  });

  describe('GET /api/v1/sessions/status', () => {
    it('returns 200 with active status and cacheTtlSeconds', async () => {
      const res = await request(app)
        .get('/api/v1/sessions/status')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(true);
      expect(typeof res.body.cacheTtlSeconds).toBe('number');
      expect(res.body.cacheTtlSeconds).toBeGreaterThan(0);
    });
  });
});
