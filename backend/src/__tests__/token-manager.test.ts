import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CM360NotConnectedError } from '../cm360/errors.js';

// Mock the db module
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
  schema: {
    oauthTokens: {},
  },
}));

// Mock crypto module
vi.mock('../auth/crypto.js', () => ({
  encrypt: vi.fn((text: string) => `encrypted:${text}`),
  decrypt: vi.fn((text: string) => text.replace('encrypted:', '')),
}));

// Mock google-auth-library
const mockSetCredentials = vi.fn();
const mockOn = vi.fn();
const mockRefreshAccessToken = vi.fn();

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    setCredentials: mockSetCredentials,
    on: mockOn,
    refreshAccessToken: mockRefreshAccessToken,
    credentials: {},
  })),
}));

// Mock @googleapis/dfareporting
vi.mock('@googleapis/dfareporting', () => ({
  dfareporting: vi.fn().mockReturnValue({ userProfiles: { list: vi.fn() } }),
}));

import { db } from '../db/index.js';
import { decrypt } from '../auth/crypto.js';
import { getCM360Client, hasOAuthTokens } from '../cm360/token-manager.js';

describe('Token Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/v1/auth/google/callback';
  });

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
  });

  describe('getCM360Client', () => {
    it('should throw CM360NotConnectedError when no tokens exist for user', async () => {
      // Mock: no rows returned
      const mockFrom = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue([]) });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      await expect(getCM360Client('user-123')).rejects.toThrow(CM360NotConnectedError);
    });

    it('should decrypt tokens and create a dfareporting client', async () => {
      const now = new Date();
      const futureExpiry = new Date(now.getTime() + 3600_000); // 1 hour from now

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([{
          userId: 'user-123',
          accessToken: 'encrypted:test-access-token',
          refreshToken: 'encrypted:test-refresh-token',
          expiresAt: futureExpiry,
          scopes: 'dfatrafficking,dfareporting',
        }]),
      });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const client = await getCM360Client('user-123');

      // Verify tokens were decrypted
      expect(decrypt).toHaveBeenCalledWith('encrypted:test-access-token');
      expect(decrypt).toHaveBeenCalledWith('encrypted:test-refresh-token');

      // Verify credentials were set
      expect(mockSetCredentials).toHaveBeenCalledWith({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expiry_date: futureExpiry.getTime(),
      });

      // Verify client was created
      expect(client).toBeDefined();
    });

    it('should register a tokens event handler for refresh token persistence', async () => {
      const now = new Date();
      const futureExpiry = new Date(now.getTime() + 3600_000);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([{
          userId: 'user-123',
          accessToken: 'encrypted:test-access-token',
          refreshToken: 'encrypted:test-refresh-token',
          expiresAt: futureExpiry,
          scopes: 'dfatrafficking,dfareporting',
        }]),
      });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      await getCM360Client('user-123');

      // Verify tokens event handler was registered
      expect(mockOn).toHaveBeenCalledWith('tokens', expect.any(Function));
    });
  });

  describe('hasOAuthTokens', () => {
    it('should return true when tokens exist for user', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([{ userId: 'user-123' }]),
      });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const result = await hasOAuthTokens('user-123');
      expect(result).toBe(true);
    });

    it('should return false when no tokens exist for user', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([]),
      });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const result = await hasOAuthTokens('user-999');
      expect(result).toBe(false);
    });
  });
});
