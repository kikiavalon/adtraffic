import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock DB module
const mockSelect = vi.fn();
const mockInsert = vi.fn();

vi.mock('../db/index.js', () => ({
  db: {
    select: () => ({ from: () => ({ where: mockSelect }) }),
    // Drizzle's .values() is awaitable directly with the postgres-js driver
    insert: () => ({ values: (values: unknown) => { mockInsert(values); return Promise.resolve(); } }),
  },
  schema: {
    oauthTokens: { id: 'id', userId: 'user_id' },
    cm360LiveAcknowledgments: { id: 'id', userId: 'user_id' },
  },
}));

// Mock requireAuth middleware — the token IS the userId in these tests.
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

// Mock google-auth-library
const mockGenerateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=true');

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: vi.fn(),
    revokeToken: vi.fn(),
  })),
}));

import oauthRouter from '../routes/oauth.js';
import { LIVE_ACK_PHRASE, LIVE_ACK_WARNING_TEXT } from '../cm360/live-acknowledgment.js';

function createApp() {
  const app = express();
  app.use(express.json());
  // Mount under /api/v1 to mirror production (index.ts)
  app.use('/api/v1', oauthRouter);
  return app;
}

const ACK_ROW = {
  id: 'ack-1',
  userId: 'user-123',
  acknowledgedPhrase: LIVE_ACK_PHRASE,
  warningText: LIVE_ACK_WARNING_TEXT,
  appVersion: '0.1.0',
  createdAt: new Date('2026-08-18T00:00:00Z'),
};

describe('Live CM360 acknowledgment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret-at-least-32-characters-long',
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3001/api/v1/auth/google/callback',
      WEBAPP_URL: 'http://localhost:5173',
      NODE_ENV: 'test',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('acknowledgment content', () => {
    it('warning text carries the key DISCLAIMER.md bullets', () => {
      expect(LIVE_ACK_WARNING_TEXT).toContain('unverified');
      expect(LIVE_ACK_WARNING_TEXT).toContain('live ad spend');
      expect(LIVE_ACK_WARNING_TEXT).toContain('non-deterministic');
      expect(LIVE_ACK_WARNING_TEXT).toContain('non-production CM360 network');
    });

    it('required phrase states the live path is unverified', () => {
      expect(LIVE_ACK_PHRASE).toBe('I understand the live CM360 path is unverified');
    });
  });

  describe('GET /api/v1/auth/google/acknowledgment', () => {
    it('returns 401 without auth', async () => {
      const res = await request(createApp()).get('/api/v1/auth/google/acknowledgment');
      expect(res.status).toBe(401);
    });

    it('returns phrase, warning text, and acknowledged: false when never acknowledged', async () => {
      mockSelect.mockReturnValue([]);

      const res = await request(createApp())
        .get('/api/v1/auth/google/acknowledgment')
        .set('Authorization', 'Bearer user-123');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        acknowledged: false,
        phrase: LIVE_ACK_PHRASE,
        warningText: LIVE_ACK_WARNING_TEXT,
      });
    });

    it('returns acknowledged: true when a prior acknowledgment exists', async () => {
      mockSelect.mockReturnValue([ACK_ROW]);

      const res = await request(createApp())
        .get('/api/v1/auth/google/acknowledgment')
        .set('Authorization', 'Bearer user-123');

      expect(res.status).toBe(200);
      expect(res.body.acknowledged).toBe(true);
    });
  });

  describe('POST /api/v1/auth/google/acknowledge', () => {
    it('returns 401 without auth', async () => {
      const res = await request(createApp())
        .post('/api/v1/auth/google/acknowledge')
        .send({ acknowledgment: LIVE_ACK_PHRASE });
      expect(res.status).toBe(401);
    });

    it('rejects a missing acknowledgment body with 400 and does not persist', async () => {
      const res = await request(createApp())
        .post('/api/v1/auth/google/acknowledge')
        .set('Authorization', 'Bearer user-123')
        .send({});

      expect(res.status).toBe(400);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('rejects a wrong phrase with 400 and does not persist', async () => {
      const res = await request(createApp())
        .post('/api/v1/auth/google/acknowledge')
        .set('Authorization', 'Bearer user-123')
        .send({ acknowledgment: 'I understand' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('exact');
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('accepts the exact phrase and persists userId, phrase, warning text, and app version', async () => {
      const res = await request(createApp())
        .post('/api/v1/auth/google/acknowledge')
        .set('Authorization', 'Bearer user-123')
        .send({ acknowledgment: LIVE_ACK_PHRASE });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ acknowledged: true });
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          acknowledgedPhrase: LIVE_ACK_PHRASE,
          warningText: LIVE_ACK_WARNING_TEXT,
          appVersion: expect.stringMatching(/.+/),
        }),
      );
    });

    it('accepts the exact phrase with surrounding whitespace', async () => {
      const res = await request(createApp())
        .post('/api/v1/auth/google/acknowledge')
        .set('Authorization', 'Bearer user-123')
        .send({ acknowledgment: `  ${LIVE_ACK_PHRASE}  ` });

      expect(res.status).toBe(200);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('rejects a case-mismatched phrase — the acknowledgment must be typed exactly', async () => {
      const res = await request(createApp())
        .post('/api/v1/auth/google/acknowledge')
        .set('Authorization', 'Bearer user-123')
        .send({ acknowledgment: LIVE_ACK_PHRASE.toUpperCase() });

      expect(res.status).toBe(400);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/auth/google/connect gate', () => {
    it('returns 428 with a clear error when the user has not acknowledged', async () => {
      mockSelect.mockReturnValue([]);

      const res = await request(createApp())
        .get('/api/v1/auth/google/connect')
        .set('Authorization', 'Bearer user-123');

      expect(res.status).toBe(428);
      expect(res.body.error).toContain('acknowledg');
      expect(mockGenerateAuthUrl).not.toHaveBeenCalled();
    });

    it('returns the Google auth URL once an acknowledgment exists', async () => {
      mockSelect.mockReturnValue([ACK_ROW]);

      const res = await request(createApp())
        .get('/api/v1/auth/google/connect')
        .set('Authorization', 'Bearer user-123');

      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
      expect(mockGenerateAuthUrl).toHaveBeenCalled();
    });

    it('still returns 503 for missing Google OAuth config, before the acknowledgment check', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      mockSelect.mockReturnValue([]);

      const res = await request(createApp())
        .get('/api/v1/auth/google/connect')
        .set('Authorization', 'Bearer user-123');

      expect(res.status).toBe(503);
    });
  });
});
