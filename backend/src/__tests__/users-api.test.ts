import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

/** Register a user via the public endpoint; returns their bearer token. First
 *  user on a fresh table becomes admin; later ones default to junior. */
async function registerUser(email: string, name = 'User', password = 'password123'): Promise<string> {
  const res = await request(app).post('/api/v1/auth/register').send({ name, email, password });
  return res.body.token as string;
}

interface ApiUser { id: string; email: string; name: string; role: string; passwordHash?: string }

async function listUsers(token: string): Promise<ApiUser[]> {
  const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${token}`);
  return res.body.users as ApiUser[];
}

describe('Users API — auth gating, list, create', () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('forbids non-admins (junior) from managing users', async () => {
    await registerUser('admin@a.com'); // first → admin
    const juniorToken = await registerUser('junior@a.com'); // second → junior
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${juniorToken}`);
    expect(res.status).toBe(403);
  });

  it('lists users for an admin without exposing password hashes', async () => {
    const adminToken = await registerUser('admin@a.com', 'Boss');
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const users = res.body.users as ApiUser[];
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: 'admin@a.com', role: 'admin', name: 'Boss' });
    expect(users[0]!.passwordHash).toBeUndefined();
  });

  it('creates an employee with an admin-set password and role, who can then log in', async () => {
    const adminToken = await registerUser('admin@a.com');
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Emp', email: 'emp@a.com', password: 'employeePass1', role: 'senior' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'emp@a.com', role: 'senior' });
    expect(res.body.user.passwordHash).toBeUndefined();

    const login = await request(app).post('/api/v1/auth/login').send({ email: 'emp@a.com', password: 'employeePass1' });
    expect(login.status).toBe(200);
  });

  it('rejects creating a user with a duplicate email', async () => {
    const adminToken = await registerUser('admin@a.com');
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dup', email: 'admin@a.com', password: 'password123', role: 'junior' });
    expect(res.status).toBe(409);
  });

  it('forbids a non-admin from creating users', async () => {
    await registerUser('admin@a.com');
    const juniorToken = await registerUser('junior@a.com');
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${juniorToken}`)
      .send({ name: 'X', email: 'x@a.com', password: 'password123', role: 'junior' });
    expect(res.status).toBe(403);
  });
});

describe('Users API — update role & delete (guards)', () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);
  });

  async function findId(token: string, email: string): Promise<string> {
    const users = await listUsers(token);
    const u = users.find((x) => x.email === email);
    if (!u) throw new Error(`user ${email} not found`);
    return u.id;
  }

  it("updates a user's role", async () => {
    const admin = await registerUser('admin@a.com');
    await registerUser('emp@a.com');
    const empId = await findId(admin, 'emp@a.com');
    const res = await request(app).patch(`/api/v1/users/${empId}`).set('Authorization', `Bearer ${admin}`).send({ role: 'senior' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'emp@a.com', role: 'senior' });
  });

  it('refuses to demote the last admin (no lockout)', async () => {
    const admin = await registerUser('admin@a.com');
    const adminId = await findId(admin, 'admin@a.com');
    const res = await request(app).patch(`/api/v1/users/${adminId}`).set('Authorization', `Bearer ${admin}`).send({ role: 'junior' });
    expect(res.status).toBe(409);
    expect((await listUsers(admin)).find((u) => u.email === 'admin@a.com')!.role).toBe('admin');
  });

  it('allows a second admin, after which the first admin can be demoted', async () => {
    const admin = await registerUser('admin@a.com');
    await registerUser('deputy@a.com');
    const deputyId = await findId(admin, 'deputy@a.com');
    await request(app).patch(`/api/v1/users/${deputyId}`).set('Authorization', `Bearer ${admin}`).send({ role: 'admin' }).expect(200);
    const adminId = await findId(admin, 'admin@a.com');
    await request(app).patch(`/api/v1/users/${adminId}`).set('Authorization', `Bearer ${admin}`).send({ role: 'senior' }).expect(200);
  });

  it('404s when updating a missing user', async () => {
    const admin = await registerUser('admin@a.com');
    const res = await request(app).patch('/api/v1/users/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${admin}`).send({ role: 'senior' });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid role', async () => {
    const admin = await registerUser('admin@a.com');
    await registerUser('emp@a.com');
    const empId = await findId(admin, 'emp@a.com');
    const res = await request(app).patch(`/api/v1/users/${empId}`).set('Authorization', `Bearer ${admin}`).send({ role: 'superadmin' });
    expect(res.status).toBe(400);
  });
});

export { registerUser, listUsers };
export type { ApiUser };
