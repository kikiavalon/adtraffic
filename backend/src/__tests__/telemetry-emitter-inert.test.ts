import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const capture = vi.fn();
const shutdown = vi.fn().mockResolvedValue(undefined);

vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation(() => ({ capture, shutdown })),
}));

// A real key IS present, but isTelemetryConfigured() reports false — nothing must
// ever be sent. This locks the "inert until a real key is configured" guard.
vi.mock('../telemetry/config.js', () => ({
  POSTHOG_KEY: 'phc_real_key',
  POSTHOG_HOST: 'https://example.test',
  isTelemetryConfigured: () => false,
}));

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'adtraffic-tele-'));
  process.env.ADTRAFFIC_TELEMETRY_DIR = dir;
  capture.mockClear();
  shutdown.mockClear();
});

afterEach(() => {
  delete process.env.ADTRAFFIC_TELEMETRY_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('telemetry emitter — not configured', () => {
  it('sends nothing when isTelemetryConfigured() is false even with full consent', async () => {
    const { writeConfig } = await import('../telemetry/config-store.js');
    writeConfig({ consent: true, installId: 'id-1' });
    const { emitStartupEventAsync } = await import('../telemetry/emitter.js');
    await emitStartupEventAsync();
    expect(capture).not.toHaveBeenCalled();
  });
});
