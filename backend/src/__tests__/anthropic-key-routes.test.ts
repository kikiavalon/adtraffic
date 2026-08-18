import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the anthropic-key-service — controllable vi.fn()s for each export.
// NoAnthropicKeyError must be a REAL class since the router imports it by name.
const mockSetKey = vi.fn();
const mockGetStatus = vi.fn();
const mockClearKey = vi.fn();
const mockVerifyKey = vi.fn();

vi.mock('../claude/anthropic-key-service.js', () => ({
  setKey: (...args: unknown[]) => mockSetKey(...args),
  getStatus: (...args: unknown[]) => mockGetStatus(...args),
  clearKey: (...args: unknown[]) => mockClearKey(...args),
  verifyKey: (...args: unknown[]) => mockVerifyKey(...args),
  NoAnthropicKeyError: class NoAnthropicKeyError extends Error {},
}));

// Mock requireAuth middleware — the Bearer token IS the userId (mirrors oauth-routes.test.ts).
vi.mock('../auth/middleware.js', () => ({
  requireAuth: vi.fn((req: { headers: { authorization?: string }; user?: { userId: string; email: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    req.user = { userId: authHeader.slice(7), email: 'test@test.com' };
    next();
  }),
}));

import anthropicKeyRouter from '../routes/anthropic-key.js';

const VALID_KEY = 'sk-ant-' + 'a'.repeat(30);

function createApp() {
  const app = express();
  app.use(express.json());
  // Mount under /api/v1 to mirror production (index.ts).
  app.use('/api/v1', anthropicKeyRouter);
  return app;
}

describe('Anthropic Key Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/settings/anthropic/status', () => {
    it('should return 401 without auth', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v1/settings/anthropic/status');
      expect(res.status).toBe(401);
    });

    it('should return connected status details', async () => {
      const status = { connected: true, last4: '1234', verifiedAt: '2026-01-01T00:00:00.000Z' };
      mockGetStatus.mockResolvedValue(status);

      const app = createApp();
      const res = await request(app)
        .get('/api/v1/settings/anthropic/status')
        .set('Authorization', 'Bearer user-123');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(status);
    });

    it('should return connected: false when not connected', async () => {
      mockGetStatus.mockResolvedValue({ connected: false });

      const app = createApp();
      const res = await request(app)
        .get('/api/v1/settings/anthropic/status')
        .set('Authorization', 'Bearer user-123');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ connected: false });
    });
  });

  describe('PUT /api/v1/settings/anthropic', () => {
    it('should verify, store, and return status on happy path (never leaking the key)', async () => {
      const status = { connected: true, last4: 'aaaa', verifiedAt: '2026-01-01T00:00:00.000Z' };
      mockVerifyKey.mockResolvedValue(true);
      mockGetStatus.mockResolvedValue(status);

      const app = createApp();
      const res = await request(app)
        .put('/api/v1/settings/anthropic')
        .set('Authorization', 'Bearer user-123')
        .send({ apiKey: VALID_KEY });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(status);
      expect(mockSetKey).toHaveBeenCalledWith('user-123', VALID_KEY);
      // The raw apiKey must NEVER appear in the response body.
      expect(JSON.stringify(res.body)).not.toContain(VALID_KEY);
    });

    it('should return 400 without verifying when the key format is bad', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/settings/anthropic')
        .set('Authorization', 'Bearer user-123')
        .send({ apiKey: 'not-a-key' });

      expect(res.status).toBe(400);
      expect(mockVerifyKey).not.toHaveBeenCalled();
    });

    it('should return 400 without storing when the key is invalid', async () => {
      mockVerifyKey.mockResolvedValue(false);

      const app = createApp();
      const res = await request(app)
        .put('/api/v1/settings/anthropic')
        .set('Authorization', 'Bearer user-123')
        .send({ apiKey: VALID_KEY });

      expect(res.status).toBe(400);
      expect(mockSetKey).not.toHaveBeenCalled();
    });

    it('should return 502 without storing when verification throws (outage)', async () => {
      mockVerifyKey.mockRejectedValue(new Error('network down'));

      const app = createApp();
      const res = await request(app)
        .put('/api/v1/settings/anthropic')
        .set('Authorization', 'Bearer user-123')
        .send({ apiKey: VALID_KEY });

      expect(res.status).toBe(502);
      expect(mockSetKey).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/v1/settings/anthropic', () => {
    it('should clear the key and return connected: false', async () => {
      mockClearKey.mockResolvedValue(undefined);

      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/settings/anthropic')
        .set('Authorization', 'Bearer user-123');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ connected: false });
      expect(mockClearKey).toHaveBeenCalledWith('user-123');
    });
  });
});
