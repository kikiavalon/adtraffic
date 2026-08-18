import Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { anthropicCredentials } from '../db/schema.js';
import { encrypt, decrypt } from '../auth/crypto.js';

export interface AnthropicKeyStatus {
  connected: boolean;
  last4?: string;
  verifiedAt?: string;
}

export async function setKey(userId: string, apiKey: string): Promise<void> {
  const encryptedApiKey = encrypt(apiKey);
  const last4 = apiKey.slice(-4);
  const now = new Date();
  await db.insert(anthropicCredentials)
    .values({ userId, encryptedApiKey, last4, verifiedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [anthropicCredentials.userId],
      set: { encryptedApiKey, last4, verifiedAt: now, updatedAt: now },
    });
}

export async function getDecryptedKey(userId: string): Promise<string | null> {
  // An empty/absent id can never own a credential row. Short-circuit before the
  // query so a blank id resolves cleanly to null (treated as not-connected)
  // rather than tripping Postgres' uuid input validation.
  if (!userId) return null;
  const [row] = await db.select().from(anthropicCredentials).where(eq(anthropicCredentials.userId, userId));
  if (!row) return null;
  try {
    return decrypt(row.encryptedApiKey);
  } catch {
    return null; // e.g. ENCRYPTION_KEY rotated — treat as not-connected
  }
}

export async function getStatus(userId: string): Promise<AnthropicKeyStatus> {
  const [row] = await db.select().from(anthropicCredentials).where(eq(anthropicCredentials.userId, userId));
  if (!row) return { connected: false };
  return { connected: true, last4: row.last4, verifiedAt: row.verifiedAt.toISOString() };
}

export async function clearKey(userId: string): Promise<void> {
  await db.delete(anthropicCredentials).where(eq(anthropicCredentials.userId, userId));
}

export class NoAnthropicKeyError extends Error {
  constructor() { super('No Anthropic API key connected'); this.name = 'NoAnthropicKeyError'; }
}

export async function verifyKey(apiKey: string): Promise<boolean> {
  const client = new Anthropic({ apiKey });
  try {
    await client.models.list();
    return true;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as { status?: number }).status === 401) return false;
    throw err; // 5xx / network — caller maps to 502 so we don't record a maybe-valid key as failed
  }
}
