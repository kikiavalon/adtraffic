import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Once the workspace admin (first user) exists, public self-registration is
 * closed by default — employees are added by an admin. A fresh instance still
 * allows the one bootstrap signup, and an operator can reopen registration with
 * ALLOW_OPEN_REGISTRATION=true.
 */
describe('POST /api/v1/auth/register — closed after bootstrap', () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);
    delete process.env.ALLOW_OPEN_REGISTRATION;
  });

  afterEach(() => {
    delete process.env.ALLOW_OPEN_REGISTRATION;
  });

  const reg = (email: string) =>
    request(app).post('/api/v1/auth/register').send({ name: 'U', email, password: 'password123' });

  it('allows the first (bootstrap) signup on a fresh instance', async () => {
    const res = await reg(`first-${Date.now()}@a.com`);
    expect(res.status).toBe(201);
  });

  it('refuses a second self-signup once an admin exists', async () => {
    await reg('admin@a.com'); // bootstrap admin
    const res = await reg('intruder@a.com');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/closed/i);
  });

  it('allows self-signup when ALLOW_OPEN_REGISTRATION=true', async () => {
    await reg('admin@a.com');
    process.env.ALLOW_OPEN_REGISTRATION = 'true';
    const res = await reg('teammate@a.com');
    expect(res.status).toBe(201);
  });
});
