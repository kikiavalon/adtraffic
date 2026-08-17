import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock DB module
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

vi.mock('../db/index.js', () => ({
  db: {
    select: () => ({ from: () => ({ where: mockSelect }) }),
    update: () => ({ set: () => ({ where: () => ({ run: mockUpdate }) }) }),
    insert: () => ({ values: () => ({ run: mockInsert }) }),
    // Drizzle's .where() is awaitable directly (no .run() needed with postgres-js driver)
    delete: () => ({ where: (...args: unknown[]) => { mockDelete(...args); return Promise.resolve(); } }),
  },
  schema: {
    oauthTokens: {
      id: 'id',
      userId: 'user_id',
    },
  },
}));

// Mock crypto module
vi.mock('../auth/crypto.js', () => ({
  encrypt: vi.fn((text: string) => `encrypted:${text}`),
  decrypt: vi.fn((text: string) => text.replace('encrypted:', '')),
}));

// Mock requireAuth middleware — avoids dependency on JWT_SECRET captured at module load time.
// When a request has Authorization header starting with "Bearer ", it extracts the userId
// from the token (which is just the raw userId in these tests) and attaches it to req.user.
vi.mock('../auth/middleware.js', () => ({
  requireAuth: vi.fn((req: { headers: { authorization?: string }; user?: { userId: string; email: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    // In tests, the token IS the userId
    req.user = { userId: authHeader.slice(7), email: 'test@test.com' };
    next();
  }),
}));

// Mock google-auth-library
const mockGenerateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=true');
const mockGetToken = vi.fn();
const mockRevokeToken = vi.fn();

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: mockGetToken,
    revokeToken: mockRevokeToken,
  })),
}));

import oauthRouter from '../routes/oauth.js';

// Clearly-fake mock tokens — must never resemble real credentials
const MOCK_ACCESS_TOKEN = 'mock-access-token-not-real';
const MOCK_REFRESH_TOKEN = 'mock-refresh-token-not-real';

function createApp() {
  const app = express();
  app.use(express.json());
  // Mount under /api/v1 to mirror production (index.ts) — the router paths
  // must resolve at /api/v1/auth/google/*, which is what the webapp calls.
  app.use('/api/v1', oauthRouter);
  return app;
}

/** Generate a "token" for tests — just the userId, since requireAuth is mocked. */
function generateTestToken(userId: string): string {
  return userId;
}

describe('OAuth Routes', () => {
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

  describe('GET /api/v1/auth/google/connect', () => {
    it('should return 401 without auth', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v1/auth/google/connect');
      expect(res.status).toBe(401);
    });

    it('should return auth URL with valid JWT', async () => {
      const app = createApp();
      const token = generateTestToken('user-123');

      const res = await request(app)
        .get('/api/v1/auth/google/connect')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
      expect(typeof res.body.url).toBe('string');
    });

    it('should return 503 when Google OAuth is not configured', async () => {
      delete process.env.GOOGLE_CLIENT_ID;

      const app = createApp();
      const token = generateTestToken('user-123');

      const res = await request(app)
        .get('/api/v1/auth/google/connect')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(503);
      expect(res.body.error).toContain('not configured');
    });

    it('should include state parameter in generated URL', async () => {
      const app = createApp();
      const token = generateTestToken('user-123');

      await request(app)
        .get('/api/v1/auth/google/connect')
        .set('Authorization', `Bearer ${token}`);

      // Verify generateAuthUrl was called with a state parameter
      expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: 'offline',
          prompt: 'consent',
          state: expect.stringContaining('.'), // payload.signature format
        }),
      );
    });
  });

  describe('GET /api/v1/auth/google/callback', () => {
    it('should redirect on user denial (error param)', async () => {
      const app = createApp();

      const res = await request(app)
        .get('/api/v1/auth/google/callback?error=access_denied');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('cm360=denied');
    });

    it('should return 400 when code or state is missing', async () => {
      const app = createApp();

      const res = await request(app)
        .get('/api/v1/auth/google/callback?code=test');

      expect(res.status).toBe(400);
    });

    it('should return 403 when state is tampered', async () => {
      const app = createApp();

      const res = await request(app)
        .get('/api/v1/auth/google/callback?code=test&state=tampered.payload');

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('tampered');
    });
  });

  describe('GET /api/v1/auth/google/status', () => {
    it('should return 401 without auth', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v1/auth/google/status');
      expect(res.status).toBe(401);
    });

    it('should return connected: false when no tokens exist', async () => {
      mockSelect.mockReturnValue([]);
      const app = createApp();
      const token = generateTestToken('user-123');

      const res = await request(app)
        .get('/api/v1/auth/google/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ connected: false });
    });

    it('should return connected: true with token details', async () => {
      mockSelect.mockReturnValue([{
        userId: 'user-123',
        scopes: 'dfatrafficking dfareporting',
        expiresAt: new Date('2026-03-01T00:00:00Z'),
      }]);
      const app = createApp();
      const token = generateTestToken('user-123');

      const res = await request(app)
        .get('/api/v1/auth/google/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
      expect(res.body.scopes).toEqual(['dfatrafficking', 'dfareporting']);
      expect(res.body.expiresAt).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/google/disconnect', () => {
    it('should return 401 without auth', async () => {
      const app = createApp();
      const res = await request(app).post('/api/v1/auth/google/disconnect');
      expect(res.status).toBe(401);
    });

    it('should return disconnected: true when no tokens exist', async () => {
      mockSelect.mockReturnValue([]);
      const app = createApp();
      const token = generateTestToken('user-123');

      const res = await request(app)
        .post('/api/v1/auth/google/disconnect')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ disconnected: true });
    });

    it('should revoke and delete tokens when they exist', async () => {
      mockSelect.mockReturnValue([{
        userId: 'user-123',
        accessToken: `encrypted:${MOCK_ACCESS_TOKEN}`,
        refreshToken: `encrypted:${MOCK_REFRESH_TOKEN}`,
      }]);
      mockRevokeToken.mockResolvedValue(undefined);

      const app = createApp();
      const token = generateTestToken('user-123');

      const res = await request(app)
        .post('/api/v1/auth/google/disconnect')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ disconnected: true });
      expect(mockRevokeToken).toHaveBeenCalledWith(MOCK_ACCESS_TOKEN);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should still delete tokens even if Google revocation fails', async () => {
      mockSelect.mockReturnValue([{
        userId: 'user-123',
        accessToken: `encrypted:${MOCK_ACCESS_TOKEN}`,
        refreshToken: `encrypted:${MOCK_REFRESH_TOKEN}`,
      }]);
      mockRevokeToken.mockRejectedValue(new Error('Network error'));

      const app = createApp();
      const token = generateTestToken('user-123');

      const res = await request(app)
        .post('/api/v1/auth/google/disconnect')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ disconnected: true });
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
