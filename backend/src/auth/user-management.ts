import bcrypt from 'bcrypt';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import type { UserRole } from './roles.js';

const SALT_ROUNDS = 10;

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

// A function (not a top-level const) so schema columns are dereferenced at call
// time. Reading schema.* during module init races the db module's top-level
// await and can throw "Cannot read properties of undefined (reading 'id')".
const userColumns = () => ({
  id: schema.users.id,
  email: schema.users.email,
  name: schema.users.name,
  role: schema.users.role,
  createdAt: schema.users.createdAt,
});

export class DuplicateEmailError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'DuplicateEmailError';
  }
}

/** All users, newest first. Never includes password hashes. */
export async function listUsers(): Promise<ManagedUser[]> {
  const rows = await db.select(userColumns()).from(schema.users);
  return rows
    .map((r) => ({ ...r, role: r.role as UserRole }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Create a user with an admin-set password. Throws DuplicateEmailError if the
 *  email is taken. Returns the created user (no hash). */
export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}): Promise<ManagedUser> {
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, input.email))
    .limit(1);
  if (existing[0]) throw new DuplicateEmailError();

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const rows = await db
    .insert(schema.users)
    .values({ email: input.email, passwordHash, name: input.name, role: input.role })
    .returning(userColumns());
  const row = rows[0];
  if (!row) throw new Error('Failed to create user');
  return { ...row, role: row.role as UserRole };
}

export class UserNotFoundError extends Error {
  constructor() {
    super('User not found');
    this.name = 'UserNotFoundError';
  }
}

export class LastAdminError extends Error {
  constructor() {
    super('Cannot remove the last admin');
    this.name = 'LastAdminError';
  }
}

async function countAdmins(): Promise<number> {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, 'admin'));
  return rows.length;
}

async function getUserRow(userId: string): Promise<ManagedUser | null> {
  const rows = await db.select(userColumns()).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const row = rows[0];
  return row ? { ...row, role: row.role as UserRole } : null;
}

/**
 * Change a user's role. Guards against demoting/removing the LAST admin so an
 * agency can never lock itself out (a second admin must exist first).
 */
export async function updateUserRole(userId: string, role: UserRole): Promise<ManagedUser> {
  const current = await getUserRow(userId);
  if (!current) throw new UserNotFoundError();
  if (current.role === 'admin' && role !== 'admin' && (await countAdmins()) <= 1) {
    throw new LastAdminError();
  }
  const rows = await db
    .update(schema.users)
    .set({ role, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning(userColumns());
  const row = rows[0];
  if (!row) throw new UserNotFoundError();
  return { ...row, role: row.role as UserRole };
}
