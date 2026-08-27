import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

interface ApiUser { id: string; email: string; role: string; active: boolean }

async function registerUser(email: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/register').send({ name: 'U', email, password: 'password123' });
  return res.body.token as string;
}
async function listUsers(token: string): Promise<ApiUser[]> {
  const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${token}`);
  return res.body.users as ApiUser[];
}
async function findId(token: string, email: string): Promise<string> {
  const u = (await listUsers(token)).find((x) => x.email === email);
  if (!u) throw new Error(`no ${email}`);
  return u.id;
}
const deactivate = (token: string, id: string) =>
  request(app).delete(`/api/v1/users/${id}`).set('Authorization', `Bearer ${token}`);

describe('User deactivation (soft delete)', () => {
  beforeEach(async () => { await db.execute(sql`TRUNCATE TABLE users CASCADE`); });

  it('deactivates a user, blocks their login, and shows active:false', async () => {
    const admin = await registerUser('admin@a.com');
    await registerUser('emp@a.com');
    const empId = await findId(admin, 'emp@a.com');

    await deactivate(admin, empId).expect(200);
    expect((await listUsers(admin)).find((u) => u.email === 'emp@a.com')!.active).toBe(false);

    const login = await request(app).post('/api/v1/auth/login').send({ email: 'emp@a.com', password: 'password123' });
    expect(login.status).toBe(403);
  });

  it('reactivates a user, restoring login', async () => {
    const admin = await registerUser('admin@a.com');
    await registerUser('emp@a.com');
    const empId = await findId(admin, 'emp@a.com');

    await deactivate(admin, empId).expect(200);
    await request(app).post(`/api/v1/users/${empId}/reactivate`).set('Authorization', `Bearer ${admin}`).expect(200);
    expect((await listUsers(admin)).find((u) => u.email === 'emp@a.com')!.active).toBe(true);

    const login = await request(app).post('/api/v1/auth/login').send({ email: 'emp@a.com', password: 'password123' });
    expect(login.status).toBe(200);
  });

  it('refuses to deactivate yourself', async () => {
    const admin = await registerUser('admin@a.com');
    const adminId = await findId(admin, 'admin@a.com');
    expect((await deactivate(admin, adminId)).status).toBe(409);
  });

  it('forbids a non-admin from deactivating', async () => {
    await registerUser('admin@a.com');
    const junior = await registerUser('junior@a.com');
    const res = await request(app)
      .delete('/api/v1/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${junior}`);
    expect(res.status).toBe(403);
  });

  it('counts only ACTIVE admins for the last-admin guard on role change', async () => {
    const admin = await registerUser('admin@a.com');
    await registerUser('deputy@a.com');
    const deputyId = await findId(admin, 'deputy@a.com');
    // Promote deputy to admin, then deactivate them → only admin@a.com is an active admin.
    await request(app).patch(`/api/v1/users/${deputyId}`).set('Authorization', `Bearer ${admin}`).send({ role: 'admin' }).expect(200);
    await deactivate(admin, deputyId).expect(200);
    // Now demoting the remaining active admin must be refused (would leave 0 active admins).
    const adminId = await findId(admin, 'admin@a.com');
    const res = await request(app).patch(`/api/v1/users/${adminId}`).set('Authorization', `Bearer ${admin}`).send({ role: 'senior' });
    expect(res.status).toBe(409);
  });
});
