import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'adtraffic-tele-'));
  process.env.ADTRAFFIC_TELEMETRY_DIR = dir;
});

afterEach(() => {
  delete process.env.ADTRAFFIC_TELEMETRY_DIR;
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('runFirstRun dispatch', () => {
  it('does nothing when a config already exists', async () => {
    const { writeConfig } = await import('../telemetry/config-store.js');
    writeConfig({ consent: true, installId: 'existing' });
    const { runFirstRun } = await import('../telemetry/notice.js');
    const setup = vi.fn().mockResolvedValue(undefined);

    const result = await runFirstRun({ isTTY: true, isCI: false, interactiveSetup: setup });

    expect(result).toBe('skipped');
    expect(setup).not.toHaveBeenCalled();
  });

  it('writes the default-ON notice config when not attended by a human (no TTY)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { runFirstRun } = await import('../telemetry/notice.js');
    const { readConfig } = await import('../telemetry/config-store.js');
    const setup = vi.fn().mockResolvedValue(undefined);

    const result = await runFirstRun({ isTTY: false, isCI: false, interactiveSetup: setup });

    expect(result).toBe('notice');
    expect(setup).not.toHaveBeenCalled();
    const cfg = readConfig();
    expect(cfg?.consent).toBe(true);
    expect(typeof cfg?.installId).toBe('string');
  });

  it('runs the interactive prompt when a human is at the terminal (TTY, not CI)', async () => {
    const { runFirstRun } = await import('../telemetry/notice.js');
    const setup = vi.fn().mockResolvedValue(undefined);

    const result = await runFirstRun({ isTTY: true, isCI: false, interactiveSetup: setup });

    expect(result).toBe('prompted');
    expect(setup).toHaveBeenCalledTimes(1);
  });

  it('never blocks on a prompt in CI even with a TTY', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { runFirstRun } = await import('../telemetry/notice.js');
    const setup = vi.fn().mockResolvedValue(undefined);

    const result = await runFirstRun({ isTTY: true, isCI: true, interactiveSetup: setup });

    expect(result).toBe('notice');
    expect(setup).not.toHaveBeenCalled();
  });
});
