/**
 * The encryption-key gate must match the JWT-secret gate: outside an explicit
 * development/test run, an unset ENCRYPTION_KEY fails closed rather than silently
 * deriving the AES key from JWT_SECRET (which would reuse one secret for signing
 * AND encrypting stored OAuth/API credentials).
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { encrypt, decrypt } from '../auth/crypto.js';

describe('encryption key gate parity', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws in a non-dev/test env when ENCRYPTION_KEY is unset (no JWT-secret fallback)', () => {
    vi.stubEnv('NODE_ENV', 'staging');
    vi.stubEnv('ENCRYPTION_KEY', ''); // unset
    vi.stubEnv('JWT_SECRET', 'signing-secret-not-for-encryption-0123456789');
    expect(() => encrypt('secret')).toThrow(/ENCRYPTION_KEY must be set/i);
  });

  it('also throws when NODE_ENV is unset and ENCRYPTION_KEY is missing', () => {
    vi.stubEnv('NODE_ENV', '');
    vi.stubEnv('ENCRYPTION_KEY', '');
    vi.stubEnv('JWT_SECRET', 'signing-secret-not-for-encryption-0123456789');
    expect(() => encrypt('secret')).toThrow(/ENCRYPTION_KEY must be set/i);
  });

  it('derives from JWT_SECRET in test/development only (round-trips, does not throw)', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENCRYPTION_KEY', '');
    vi.stubEnv('JWT_SECRET', 'signing-secret-not-for-encryption-0123456789');
    const ciphertext = encrypt('hello');
    expect(decrypt(ciphertext)).toBe('hello');
  });

  it('uses an explicit ENCRYPTION_KEY regardless of environment', () => {
    vi.stubEnv('NODE_ENV', 'staging');
    vi.stubEnv('ENCRYPTION_KEY', 'a'.repeat(64));
    const ciphertext = encrypt('hello');
    expect(decrypt(ciphertext)).toBe('hello');
  });
});
