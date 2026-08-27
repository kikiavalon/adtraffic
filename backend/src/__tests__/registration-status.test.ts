import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Public, unauthenticated endpoint the auth screens read on load to decide:
 *  - needsBootstrap: no users yet → land on "create the agency admin" signup
 *  - registrationOpen: whether public self-registration is currently allowed
 */
describe('GET /api/v1/auth/registration-status', () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);
    delete process.env.ALLOW_OPEN_REGISTRATION;
  });

  afterEach(() => {
    delete process.env.ALLOW_OPEN_REGISTRATION;
  });

  it('reports bootstrap needed and registration open when there are no users', async () => {
    const res = await request(app).get('/api/v1/auth/registration-status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ needsBootstrap: true, registrationOpen: true });
  });

  it('reports closed once the first user exists', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Admin', email: `admin-${Date.now()}@agency.com`, password: 'password123' });

    const res = await request(app).get('/api/v1/auth/registration-status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ needsBootstrap: false, registrationOpen: false });
  });

  it('stays open when ALLOW_OPEN_REGISTRATION=true even after the first user', async () => {
    process.env.ALLOW_OPEN_REGISTRATION = 'true';
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Admin', email: `admin2-${Date.now()}@agency.com`, password: 'password123' });

    const res = await request(app).get('/api/v1/auth/registration-status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ needsBootstrap: false, registrationOpen: true });
  });
});
