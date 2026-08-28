import { describe, it, expect, afterEach } from 'vitest';
import { shouldSkipRedis } from '../db/redis.js';

/**
 * `shouldSkipRedis()` decides whether initRedis() attaches a real client.
 *
 * The demo-mode bug this guards: initRedis() only checked NODE_ENV==='test',
 * so a DEMO_MODE run (NODE_ENV unset) still dialed localhost:6379 and spewed
 * red ECONNREFUSED errors that read as a crash. DEMO_MODE must skip Redis
 * entirely (every consumer falls back to in-memory).
 */
describe('shouldSkipRedis', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevDemo = process.env.DEMO_MODE;

  afterEach(() => {
    // Restore exactly — the backend suite runs sequentially and shares env.
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevDemo === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = prevDemo;
  });

  it('skips Redis in DEMO_MODE, even outside the test env', () => {
    delete process.env.NODE_ENV; // simulate a real `npm run dev`
    process.env.DEMO_MODE = 'true';
    expect(shouldSkipRedis()).toBe(true);
  });

  it('skips Redis under NODE_ENV=test (in-memory fallback)', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DEMO_MODE;
    expect(shouldSkipRedis()).toBe(true);
  });

  it('does NOT skip Redis in a normal non-test, non-demo run', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEMO_MODE;
    expect(shouldSkipRedis()).toBe(false);
  });
});
