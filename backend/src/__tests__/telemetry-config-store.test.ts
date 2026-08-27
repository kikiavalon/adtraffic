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

describe('buildConsentConfig', () => {
  it('declining returns consent:false with no install id', async () => {
    const { buildConsentConfig } = await import('../telemetry/config-store.js');
    const cfg = buildConsentConfig({ enable: false }, null);
    expect(cfg.consent).toBe(false);
    expect(cfg.noticeShown).toBe(true);
    expect(cfg.installId).toBeUndefined();
  });

  it('enabling returns consent:true with a generated install id and createdAt', async () => {
    const { buildConsentConfig } = await import('../telemetry/config-store.js');
    const cfg = buildConsentConfig({ enable: true }, null);
    expect(cfg.consent).toBe(true);
    expect(cfg.noticeShown).toBe(true);
    expect(typeof cfg.installId).toBe('string');
    expect(cfg.installId!.length).toBeGreaterThan(0);
    expect(typeof cfg.createdAt).toBe('string');
    expect(cfg.email).toBeUndefined();
    expect(cfg.agency).toBeUndefined();
  });

  it('generates a distinct install id on separate calls with no existing config', async () => {
    const { buildConsentConfig } = await import('../telemetry/config-store.js');
    const a = buildConsentConfig({ enable: true }, null);
    const b = buildConsentConfig({ enable: true }, null);
    expect(a.installId).not.toBe(b.installId);
  });

  it('includes trimmed email/agency when provided', async () => {
    const { buildConsentConfig } = await import('../telemetry/config-store.js');
    const cfg = buildConsentConfig({ enable: true, email: '  a@b.com ', agency: ' Acme ' }, null);
    expect(cfg.email).toBe('a@b.com');
    expect(cfg.agency).toBe('Acme');
  });

  it('preserves an existing install id and createdAt instead of regenerating', async () => {
    const { buildConsentConfig } = await import('../telemetry/config-store.js');
    const existing = { consent: true, installId: 'keep-me', createdAt: '2020-01-01T00:00:00.000Z' };
    const cfg = buildConsentConfig({ enable: true }, existing);
    expect(cfg.installId).toBe('keep-me');
    expect(cfg.createdAt).toBe('2020-01-01T00:00:00.000Z');
  });
});
