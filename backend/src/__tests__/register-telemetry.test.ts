import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { register } from '../auth/auth-service.js';
import { writeConfig } from '../telemetry/config-store.js';

/**
 * Signup is the telemetry consent — but ONLY the agency admin (the first user
 * on a fresh instance) contributes email + agency. Employees never do. Each
 * test isolates ADTRAFFIC_TELEMETRY_DIR so it never touches the real config.
 */
function readTelemetry(dir: string): Record<string, unknown> | null {
  const p = join(dir, 'telemetry.json');
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>) : null;
}

describe('register() → telemetry identity (agency admin only)', () => {
  let telemetryDir: string;

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);
    telemetryDir = mkdtempSync(join(tmpdir(), 'adtraffic-tele-'));
    process.env.ADTRAFFIC_TELEMETRY_DIR = telemetryDir;
  });

  afterEach(() => {
    delete process.env.ADTRAFFIC_TELEMETRY_DIR;
    rmSync(telemetryDir, { recursive: true, force: true });
  });

  it('records email + agency for the first (admin) signup', async () => {
    await register('boss@agency.com', 'password123', 'Boss', 'Acme Media');
    expect(readTelemetry(telemetryDir)).toMatchObject({
      consent: true,
      email: 'boss@agency.com',
      agency: 'Acme Media',
    });
  });

  it('does NOT record telemetry for a second (employee) signup', async () => {
    await register('boss@agency.com', 'password123', 'Boss', 'Acme Media'); // admin
    rmSync(join(telemetryDir, 'telemetry.json'), { force: true }); // detect any further write
    await register('emp@agency.com', 'password123', 'Emp', 'Acme Media'); // employee sends agency too
    expect(readTelemetry(telemetryDir)).toBeNull();
  });

  it('records nothing when the admin provides no agency', async () => {
    await register('solo@agency.com', 'password123', 'Solo'); // no agency arg
    const cfg = readTelemetry(telemetryDir);
    expect(cfg?.['email']).toBeUndefined();
    expect(cfg?.['agency']).toBeUndefined();
  });

  it('respects an explicit prior opt-out (does not re-enable)', async () => {
    writeConfig({ consent: false, noticeShown: true }); // operator declined in the terminal
    await register('boss@agency.com', 'password123', 'Boss', 'Acme Media');
    const cfg = readTelemetry(telemetryDir);
    expect(cfg?.['consent']).toBe(false);
    expect(cfg?.['email']).toBeUndefined();
    expect(cfg?.['agency']).toBeUndefined();
  });
});
