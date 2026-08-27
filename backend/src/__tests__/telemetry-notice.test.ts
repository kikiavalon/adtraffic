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

describe('headless first-boot notice (telemetry ON by default)', () => {
  it('shows the notice and writes a consent:true config with an install id when none exists', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { showHeadlessNotice } = await import('../telemetry/notice.js');
    const { readConfig } = await import('../telemetry/config-store.js');

    const shown = showHeadlessNotice();

    expect(shown).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    const cfg = readConfig();
    expect(cfg?.consent).toBe(true);
    expect(cfg?.noticeShown).toBe(true);
    expect(typeof cfg?.installId).toBe('string');
    expect(cfg?.installId?.length).toBeGreaterThan(0);
  });

  it('does nothing on a second call (config now exists)', async () => {
    const { showHeadlessNotice } = await import('../telemetry/notice.js');
    showHeadlessNotice();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const shown = showHeadlessNotice();
    expect(shown).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
