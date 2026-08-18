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

describe('first-boot notice', () => {
  it('shows the notice and writes a consent:false config when none exists', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { maybeShowFirstBootNotice } = await import('../telemetry/notice.js');
    const { readConfig } = await import('../telemetry/config-store.js');

    const shown = maybeShowFirstBootNotice();

    expect(shown).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    const cfg = readConfig();
    expect(cfg?.consent).toBe(false);
    expect(cfg?.noticeShown).toBe(true);
  });

  it('does nothing on a second call (config now exists)', async () => {
    const { maybeShowFirstBootNotice } = await import('../telemetry/notice.js');
    maybeShowFirstBootNotice();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const shown = maybeShowFirstBootNotice();
    expect(shown).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
