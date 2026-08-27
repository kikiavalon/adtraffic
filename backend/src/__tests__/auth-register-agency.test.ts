import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import app from '../index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

function readTelemetry(dir: string): Record<string, unknown> | null {
  const p = join(dir, 'telemetry.json');
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>) : null;
}

describe('POST /api/v1/auth/register — agency field', () => {
  let telemetryDir: string;

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);
    telemetryDir = mkdtempSync(join(tmpdir(), 'adtraffic-reg-'));
    process.env.ADTRAFFIC_TELEMETRY_DIR = telemetryDir;
  });

  afterEach(() => {
    delete process.env.ADTRAFFIC_TELEMETRY_DIR;
    rmSync(telemetryDir, { recursive: true, force: true });
  });

  it('accepts an agency in the body and records it for the bootstrap admin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Boss', email: `boss-${Date.now()}@agency.com`, password: 'password123', agency: 'Acme Media' });
    expect(res.status).toBe(201);
    expect(readTelemetry(telemetryDir)).toMatchObject({ agency: 'Acme Media' });
  });

  it('still registers when no agency is provided', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Solo', email: `solo-${Date.now()}@agency.com`, password: 'password123' });
    expect(res.status).toBe(201);
    expect(readTelemetry(telemetryDir)).toBeNull();
  });
});
