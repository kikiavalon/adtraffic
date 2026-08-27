import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The real PostHog *project* key ships in the repo (write-only, safe to commit),
// so a downloaded copy actually reports. These lock that the shipped key is real
// (not the old placeholder) and that an env override can still disable it.
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

  it('ships a real (non-placeholder) key so downloads report by default', async () => {
    delete process.env.POSTHOG_KEY;
    const { isTelemetryConfigured, POSTHOG_KEY } = await import('../telemetry/config.js');
    expect(POSTHOG_KEY.startsWith('phc_')).toBe(true);
    expect(POSTHOG_KEY).not.toContain('PLACEHOLDER');
    expect(isTelemetryConfigured()).toBe(true);
  });

  it('can be disabled by setting POSTHOG_KEY to empty', async () => {
    process.env.POSTHOG_KEY = '';
    const { isTelemetryConfigured } = await import('../telemetry/config.js');
    expect(isTelemetryConfigured()).toBe(false);
  });

  it('treats a PLACEHOLDER override as not configured', async () => {
    process.env.POSTHOG_KEY = 'phc_PLACEHOLDER_REPLACE_ME';
    const { isTelemetryConfigured } = await import('../telemetry/config.js');
    expect(isTelemetryConfigured()).toBe(false);
  });
});
