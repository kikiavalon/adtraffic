import { describe, it, expect, afterEach } from 'vitest';
import { getJwtSecret } from '../auth/auth-service.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalJwtSecret = process.env.JWT_SECRET;
const originalDemoMode = process.env.DEMO_MODE;

function setEnv(
  nodeEnv: string | undefined,
  jwtSecret: string | undefined,
  demoMode: string | undefined = undefined,
): void {
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  if (jwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = jwtSecret;
  if (demoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = demoMode;
}

afterEach(() => {
  setEnv(originalNodeEnv, originalJwtSecret, originalDemoMode);
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

  it('allows the fallback for a DEMO_MODE demo with no NODE_ENV or secret', () => {
    // The documented quick start — `DEMO_MODE=true npm run dev` — sets neither
    // NODE_ENV nor JWT_SECRET. A throwaway, in-memory demo must still boot.
    setEnv(undefined, undefined, 'true');
    expect(getJwtSecret()).toBe('dev-secret-change-in-production');
  });

  it('still refuses the fallback in production even when DEMO_MODE is true', () => {
    // Demo mode must never weaken production's guarantee that tokens are not
    // signed with the public fallback secret.
    setEnv('production', undefined, 'true');
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET must be set/);
  });

  it('only accepts the exact string "true" for DEMO_MODE', () => {
    for (const demoMode of ['false', '1', 'TRUE', '']) {
      setEnv(undefined, undefined, demoMode);
      expect(() => getJwtSecret()).toThrow(/JWT_SECRET must be set/);
    }
  });
});
