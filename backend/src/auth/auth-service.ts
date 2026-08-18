import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import type { UserRole } from './roles.js';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    if (process.env.NODE_ENV === 'production' && secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production environment');
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

export async function register(email: string, password: string, name: string): Promise<AuthTokens> {
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (existing[0]) {
    throw new Error('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await db.insert(schema.users).values({
    email,
    passwordHash,
    name,
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
    : 'senior'; // Backward compat: tokens issued before role was added default to senior
  return { userId: (decoded as Record<string, unknown>).userId as string, email: (decoded as Record<string, unknown>).email as string, role };
}
