import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Locks the guard that keeps telemetry inert until the maintainer pastes a real
// PostHog key: the shipped placeholder key must make isTelemetryConfigured() false.
describe('telemetry config guard', () => {
  const original = process.env.POSTHOG_KEY;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.POSTHOG_KEY;
    else process.env.POSTHOG_KEY = original;
    vi.resetModules();
  });

  it('is NOT configured with the shipped placeholder key (no env override)', async () => {
    delete process.env.POSTHOG_KEY;
    const { isTelemetryConfigured, POSTHOG_KEY } = await import('../telemetry/config.js');
    expect(POSTHOG_KEY).toContain('PLACEHOLDER');
    expect(isTelemetryConfigured()).toBe(false);
  });
});
