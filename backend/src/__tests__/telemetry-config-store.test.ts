import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
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
});

describe('telemetry config store', () => {
  it('returns null and configExists=false when no file yet', async () => {
    const { readConfig, configExists } = await import('../telemetry/config-store.js');
    expect(readConfig()).toBeNull();
    expect(configExists()).toBe(false);
  });

  it('writes and reads back a config, creating the dir', async () => {
    const { writeConfig, readConfig, configExists } = await import('../telemetry/config-store.js');
    writeConfig({ consent: true, installId: 'id-1', email: 'a@b.com' });
    expect(configExists()).toBe(true);
    const cfg = readConfig();
    expect(cfg?.consent).toBe(true);
    expect(cfg?.installId).toBe('id-1');
    expect(cfg?.email).toBe('a@b.com');
  });

  it('merges partial writes over existing config', async () => {
    const { writeConfig, readConfig } = await import('../telemetry/config-store.js');
    writeConfig({ consent: false, noticeShown: true });
    writeConfig({ consent: true, installId: 'id-2' });
    const cfg = readConfig();
    expect(cfg?.consent).toBe(true);
    expect(cfg?.installId).toBe('id-2');
    expect(cfg?.noticeShown).toBe(true);
  });

  it('treats a malformed file as null (no consent)', async () => {
    writeFileSync(join(dir, 'telemetry.json'), '{ not json');
    const { readConfig } = await import('../telemetry/config-store.js');
    expect(readConfig()).toBeNull();
  });

  it('treats a file missing a boolean consent as null', async () => {
    writeFileSync(join(dir, 'telemetry.json'), JSON.stringify({ installId: 'x' }));
    const { readConfig } = await import('../telemetry/config-store.js');
    expect(readConfig()).toBeNull();
  });
});
