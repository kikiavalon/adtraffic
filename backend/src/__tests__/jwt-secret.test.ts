import { describe, it, expect, afterEach } from 'vitest';
import { getJwtSecret } from '../auth/auth-service.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalJwtSecret = process.env.JWT_SECRET;

function setEnv(nodeEnv: string | undefined, jwtSecret: string | undefined): void {
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  if (jwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = jwtSecret;
}

afterEach(() => {
  setEnv(originalNodeEnv, originalJwtSecret);
});

describe('getJwtSecret', () => {
  it('returns an explicitly set secret regardless of NODE_ENV', () => {
    setEnv('staging', 'a-real-32-plus-character-secret-value');
    expect(getJwtSecret()).toBe('a-real-32-plus-character-secret-value');
  });

  it('throws when unset outside development/test (unset, staging, production, misspelled)', () => {
    for (const nodeEnv of [undefined, 'staging', 'production', 'Production']) {
      setEnv(nodeEnv, undefined);
      expect(() => getJwtSecret()).toThrow(/JWT_SECRET must be set/);
    }
  });

  it('allows the development fallback only for explicit development or test', () => {
    setEnv('development', undefined);
    expect(getJwtSecret()).toBe('dev-secret-change-in-production');
    setEnv('test', undefined);
    expect(getJwtSecret()).toBe('dev-secret-change-in-production');
  });
});
