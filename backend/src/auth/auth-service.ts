import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import type { UserRole } from './roles.js';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    if (process.env.NODE_ENV === 'production' && secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
    return secret;
  }
  // No secret set. The hardcoded fallback is public in the source tree, so it is
  // only safe for an explicit non-production run: development, test, or a
  // throwaway DEMO_MODE demo (in-memory DB, no real users). Any other
  // environment — an unset NODE_ENV, "staging", "production", or a misspelled
  // "Production" — must supply a real secret rather than silently signing tokens
  // with a known value. Production never uses the fallback, even in demo mode.
  const nodeEnv = process.env.NODE_ENV;
  const isDevOrTest = nodeEnv === 'development' || nodeEnv === 'test';
  const isDemo = nodeEnv !== 'production' && process.env.DEMO_MODE === 'true';
  if (!isDevOrTest && !isDemo) {
    throw new Error(
      'JWT_SECRET must be set unless NODE_ENV is "development" or "test", or DEMO_MODE is "true"',
    );
  }
  return 'dev-secret-change-in-production';
}

const JWT_SECRET = getJwtSecret();
const SALT_ROUNDS = 10;

// Pre-computed dummy hash for timing-safe login rejection.
// When a user is not found, we still run bcrypt.compare against this hash
// so the response time is indistinguishable from a wrong-password case.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-padding', SALT_ROUNDS);

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthTokens {
  token: string;
  user: AuthUser;
}

/**
 * Role for a newly registered user. The FIRST account on a fresh instance
 * becomes `admin` (bootstraps the self-host operator); everyone after gets
 * DEFAULT_USER_ROLE — default `junior` (read + write-pending-approval), so open
 * registration cannot silently grant direct live-write authority. A trusted-team
 * instance can set DEFAULT_USER_ROLE=senior. (Best-effort first-user check: two
 * truly simultaneous first registrations could both be admin — acceptable for a
 * self-hosted instance.)
 */
async function resolveNewUserRole(): Promise<UserRole> {
  if (await isBootstrapNeeded()) return 'admin';
  // Only senior/junior are valid mass-assignment defaults. admin is reserved for
  // the bootstrap first user, so DEFAULT_USER_ROLE=admin (which would make every
  // registrant a full admin) is rejected and falls back to least privilege.
  const configured = process.env.DEFAULT_USER_ROLE;
  return configured === 'senior' || configured === 'junior' ? configured : 'junior';
}

/**
 * True when no users exist yet — the next signup bootstraps the agency admin.
 * Single source of truth for the public registration-status endpoint and the
 * closed-registration gate, so both agree on "is this a fresh instance?".
 */
export async function isBootstrapNeeded(): Promise<boolean> {
  const anyUser = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  return anyUser.length === 0;
}

export async function register(email: string, password: string, name: string): Promise<AuthTokens> {
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (existing[0]) {
    throw new Error('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const role = await resolveNewUserRole();

  const result = await db.insert(schema.users).values({
    email,
    passwordHash,
    name,
    role,
  }).returning({
    id: schema.users.id,
    email: schema.users.email,
    name: schema.users.name,
    role: schema.users.role,
  });

  const insertedUser = result[0];
  if (!insertedUser) {
    throw new Error('Failed to create user');
  }

  const token = jwt.sign({ userId: insertedUser.id, email: insertedUser.email, role: insertedUser.role }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });

  return {
    token,
    user: { id: insertedUser.id, email: insertedUser.email, name: insertedUser.name, role: insertedUser.role as UserRole },
  };
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const result = await db.select().from(schema.users).where(eq(schema.users.email, email));
  const user = result[0];
  if (!user) {
    // Run bcrypt.compare against dummy hash to prevent timing-based email enumeration
    await bcrypt.compare(password, DUMMY_HASH);
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role as UserRole },
  };
}

/** Look up the current user's public profile by id — used to rehydrate the
 * session on page load when the JWT lives in an httpOnly cookie. */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role as UserRole };
}

export function verifyToken(token: string): { userId: string; email: string; role: string } {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof (decoded as Record<string, unknown>).userId !== 'string' ||
    typeof (decoded as Record<string, unknown>).email !== 'string'
  ) {
    throw new Error('Invalid token payload');
  }
  const role = typeof (decoded as Record<string, unknown>).role === 'string'
    ? (decoded as Record<string, unknown>).role as string
    : 'junior'; // Missing/legacy role → least privilege (freshly issued tokens always carry a role)
  return { userId: (decoded as Record<string, unknown>).userId as string, email: (decoded as Record<string, unknown>).email as string, role };
}
