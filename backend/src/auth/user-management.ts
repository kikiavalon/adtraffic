import bcrypt from 'bcrypt';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import type { UserRole } from './roles.js';

const SALT_ROUNDS = 10;

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
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
  active: schema.users.active,
  createdAt: schema.users.createdAt,
});

/** Normalize a raw row into a ManagedUser. `active` may be undefined on the
 *  in-memory (demo) adapter, which never applies the column default — treat
 *  anything that isn't explicitly false as active. */
function toManaged(row: Record<string, unknown>): ManagedUser {
  return {
    id: row['id'] as string,
    email: row['email'] as string,
    name: row['name'] as string,
    role: row['role'] as UserRole,
    active: row['active'] !== false,
    createdAt: row['createdAt'] as Date,
  };
}

export class DuplicateEmailError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'DuplicateEmailError';
  }
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

export class SelfActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SelfActionError';
  }
}

/** All users, newest first. Never includes password hashes. */
export async function listUsers(): Promise<ManagedUser[]> {
  const rows = await db.select(userColumns()).from(schema.users);
  return rows
    .map(toManaged)
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
  return toManaged(row);
}

/** Number of admins that can still sign in (active only) — the guard for
 *  "don't remove the last admin" must ignore deactivated admins. */
async function countActiveAdmins(): Promise<number> {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.role, 'admin'), eq(schema.users.active, true)));
  return rows.length;
}

async function getUserRow(userId: string): Promise<ManagedUser | null> {
  const rows = await db.select(userColumns()).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const row = rows[0];
  return row ? toManaged(row) : null;
}

/**
 * Change a user's role. Guards against demoting the LAST active admin so an
 * agency can never lock itself out (a second active admin must exist first).
 */
export async function updateUserRole(userId: string, role: UserRole): Promise<ManagedUser> {
  const current = await getUserRow(userId);
  if (!current) throw new UserNotFoundError();
  if (current.role === 'admin' && role !== 'admin' && (await countActiveAdmins()) <= 1) {
    throw new LastAdminError();
  }
  const rows = await db
    .update(schema.users)
    .set({ role, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning(userColumns());
  const row = rows[0];
  if (!row) throw new UserNotFoundError();
  return toManaged(row);
}

/**
 * Soft-delete: deactivate (or reactivate) a user. Deactivating guards against
 * removing yourself or the last active admin. Reactivating is always allowed.
 */
export async function setUserActive(userId: string, active: boolean, actingUserId: string): Promise<ManagedUser> {
  const current = await getUserRow(userId);
  if (!current) throw new UserNotFoundError();
  if (!active) {
    if (userId === actingUserId) throw new SelfActionError('You cannot deactivate your own account.');
    if (current.role === 'admin' && current.active && (await countActiveAdmins()) <= 1) {
      throw new LastAdminError();
    }
  }
  const rows = await db
    .update(schema.users)
    .set({ active, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning(userColumns());
  const row = rows[0];
  if (!row) throw new UserNotFoundError();
  return toManaged(row);
}
