/**
 * Tests for security hardening fixes from Audit #2 Batch 1 (P0).
 *
 * Covers: JWT_SECRET entropy validation (H2-7), profileId max length (H2-2).
 */

import { describe, it, expect, afterEach, vi } from 'vitest';

describe('Security Hardening — Batch 1', () => {
  describe('JWT_SECRET entropy validation (H2-7)', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
      vi.resetModules();
    });

    it('should accept JWT_SECRET >= 32 chars in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a'.repeat(32);
      // DATABASE_URL is required when NODE_ENV !== 'test' (db/index.ts check)
      process.env.DATABASE_URL = 'postgres://fake:fake@localhost:5432/fake';
      // Re-import to trigger getJwtSecret()
      // The module should load without throwing
      const { register } = await import('../auth/auth-service.js');
      expect(register).toBeDefined();
    });

    it('should accept short JWT_SECRET in non-production', async () => {
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = 'short';
      const { register } = await import('../auth/auth-service.js');
      expect(register).toBeDefined();
    });
  });

  describe('profileId max length validation (H2-2)', () => {
    it('should reject profileId longer than 50 chars', async () => {
      // Dynamically import to get the actual schemas
      const schemas = await import('../cm360/tool-input-schemas.js');

      const longProfileId = 'x'.repeat(51);

      // Test a representative schema
      const result = schemas.ListAdvertisersInputSchema.safeParse({
        profileId: longProfileId,
      });
      expect(result.success).toBe(false);
    });

    it('should accept profileId of exactly 50 chars', async () => {
      const schemas = await import('../cm360/tool-input-schemas.js');

      const profileId = 'x'.repeat(50);

      const result = schemas.ListAdvertisersInputSchema.safeParse({
        profileId,
      });
      expect(result.success).toBe(true);
    });

    it('should reject profileId longer than 50 chars in Change Log schemas', async () => {
      const schemas = await import('../cm360/tool-input-schemas.js');

      const longProfileId = 'x'.repeat(51);

      const listResult = schemas.ListChangeLogsInputSchema.safeParse({
        profileId: longProfileId,
      });
      expect(listResult.success).toBe(false);

      const getResult = schemas.GetChangeLogInputSchema.safeParse({
        profileId: longProfileId,
        changeLogId: '123',
      });
      expect(getResult.success).toBe(false);
    });
  });

  describe('searchString max length validation (H2-3)', () => {
    it('should reject searchString longer than 256 chars', async () => {
      const schemas = await import('../cm360/tool-input-schemas.js');

      const longSearch = 'x'.repeat(257);

      const result = schemas.ListAdvertisersInputSchema.safeParse({
        profileId: '123',
        searchString: longSearch,
      });
      expect(result.success).toBe(false);
    });

    it('should accept searchString of exactly 256 chars', async () => {
      const schemas = await import('../cm360/tool-input-schemas.js');

      const result = schemas.ListAdvertisersInputSchema.safeParse({
        profileId: '123',
        searchString: 'x'.repeat(256),
      });
      expect(result.success).toBe(true);
    });
  });
});
