import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
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
}

export interface AuthTokens {
  token: string;
  user: AuthUser;
}

export async function register(email: string, password: string, name: string): Promise<AuthTokens> {
  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (existing) {
    throw new Error('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = new Date();
  const user = {
    id: randomUUID(),
    email,
    passwordHash,
    name,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(schema.users).values(user).run();

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!user) {
    // Run bcrypt.compare against dummy hash to prevent timing-based email enumeration
    await bcrypt.compare(password, DUMMY_HASH);
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export function verifyToken(token: string): { userId: string; email: string } {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof (decoded as Record<string, unknown>).userId !== 'string' ||
    typeof (decoded as Record<string, unknown>).email !== 'string'
  ) {
    throw new Error('Invalid token payload');
  }
  return { userId: (decoded as Record<string, unknown>).userId as string, email: (decoded as Record<string, unknown>).email as string };
}
