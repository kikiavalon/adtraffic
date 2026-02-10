import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const SALT_ROUNDS = 10;

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

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export function verifyToken(token: string): { userId: string; email: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
}
