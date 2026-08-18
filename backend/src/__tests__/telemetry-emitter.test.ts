import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const capture = vi.fn();
const shutdown = vi.fn().mockResolvedValue(undefined);

vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation(() => ({ capture, shutdown })),
}));

// Force a "configured" telemetry key for these tests.
vi.mock('../telemetry/config.js', () => ({
  POSTHOG_KEY: 'phc_test_key',
  POSTHOG_HOST: 'https://example.test',
  isTelemetryConfigured: () => true,
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

describe('telemetry emitter', () => {
  it('sends nothing when there is no config', async () => {
    const { emitStartupEventAsync } = await import('../telemetry/emitter.js');
    await emitStartupEventAsync();
    expect(capture).not.toHaveBeenCalled();
  });

  it('sends nothing when consent is false', async () => {
    const { writeConfig } = await import('../telemetry/config-store.js');
    writeConfig({ consent: false, installId: 'id-1' });
    const { emitStartupEventAsync } = await import('../telemetry/emitter.js');
    await emitStartupEventAsync();
    expect(capture).not.toHaveBeenCalled();
  });

  it('sends nothing when consent is true but installId is missing', async () => {
    const { writeConfig } = await import('../telemetry/config-store.js');
    writeConfig({ consent: true });
    const { emitStartupEventAsync } = await import('../telemetry/emitter.js');
    await emitStartupEventAsync();
    expect(capture).not.toHaveBeenCalled();
  });

  it('sends one anonymous app_started event when consent is true', async () => {
    const { writeConfig } = await import('../telemetry/config-store.js');
    writeConfig({ consent: true, installId: 'id-1' });
    const { emitStartupEventAsync } = await import('../telemetry/emitter.js');
    await emitStartupEventAsync();
    expect(capture).toHaveBeenCalledTimes(1);
    const arg = capture.mock.calls[0]![0];
    expect(arg.event).toBe('app_started');
    expect(arg.distinctId).toBe('id-1');
    expect(arg.properties.os).toBe(process.platform);
    expect(arg.properties.$set).toBeUndefined();
    expect(shutdown).toHaveBeenCalled();
  });

  it('attaches email/agency as $set person properties when present', async () => {
    const { writeConfig } = await import('../telemetry/config-store.js');
    writeConfig({ consent: true, installId: 'id-1', email: 'a@b.com', agency: 'Acme' });
    const { emitStartupEventAsync } = await import('../telemetry/emitter.js');
    await emitStartupEventAsync();
    const arg = capture.mock.calls[0]![0];
    expect(arg.properties.$set).toEqual({ email: 'a@b.com', agency: 'Acme' });
  });

  it('does not throw when the PostHog client rejects', async () => {
    capture.mockImplementationOnce(() => { throw new Error('boom'); });
    const { writeConfig } = await import('../telemetry/config-store.js');
    writeConfig({ consent: true, installId: 'id-1' });
    const { emitStartupEventAsync } = await import('../telemetry/emitter.js');
    await expect(emitStartupEventAsync()).resolves.toBeUndefined();
  });
});
