import { describe, it, expect, beforeEach, vi } from 'vitest';
const { mockList } = vi.hoisted(() => ({ mockList: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    models: { list: mockList },
  })),
}));
import { db } from '../db/index.js';
import { anthropicCredentials } from '../db/schema.js';
import { users } from '../db/schema.js';
import { setKey, getDecryptedKey, getStatus, clearKey, verifyKey, NoAnthropicKeyError } from '../claude/anthropic-key-service.js';

async function makeUser(): Promise<string> {
  const [u] = await db.insert(users).values({ email: `k${Math.floor(performance.now())}-${Math.random().toString(36).slice(2)}@t.co`, passwordHash: 'x', name: 'K' }).returning();
  return u!.id;
}

describe('anthropic-key-service storage', () => {
  beforeEach(async () => { await db.delete(anthropicCredentials); });

  it('stores encrypted, returns the same key on read, exposes last4', async () => {
    const userId = await makeUser();
    await setKey(userId, 'sk-ant-abcdEFGH1234');
    expect(await getDecryptedKey(userId)).toBe('sk-ant-abcdEFGH1234');
    const status = await getStatus(userId);
    expect(status.connected).toBe(true);
    expect(status.last4).toBe('1234');
    expect(status.verifiedAt).toBeDefined();
  });

  it('does not persist the key in plaintext', async () => {
    const userId = await makeUser();
    await setKey(userId, 'sk-ant-secretVALUE9999');
    const [row] = await db.select().from(anthropicCredentials);
    expect(row!.encryptedApiKey).not.toContain('secretVALUE');
  });

  it('upsert replaces a prior key for the same user', async () => {
    const userId = await makeUser();
    await setKey(userId, 'sk-ant-aaaa1111');
    await setKey(userId, 'sk-ant-bbbb2222');
    expect(await getDecryptedKey(userId)).toBe('sk-ant-bbbb2222');
    expect((await db.select().from(anthropicCredentials)).length).toBe(1);
  });

  it('getDecryptedKey returns null and getStatus.connected=false when absent', async () => {
    const userId = await makeUser();
    expect(await getDecryptedKey(userId)).toBeNull();
    expect((await getStatus(userId)).connected).toBe(false);
  });

  it('clearKey removes the row', async () => {
    const userId = await makeUser();
    await setKey(userId, 'sk-ant-cccc3333');
    await clearKey(userId);
    expect(await getDecryptedKey(userId)).toBeNull();
  });
});

describe('anthropic-key-service verifyKey', () => {
  beforeEach(() => mockList.mockReset());

  it('verifyKey returns true on a 200 models.list', async () => {
    mockList.mockResolvedValueOnce({ data: [] });
    expect(await verifyKey('sk-ant-good')).toBe(true);
  });

  it('verifyKey returns false on a 401', async () => {
    mockList.mockRejectedValueOnce(Object.assign(new Error('unauth'), { status: 401 }));
    expect(await verifyKey('sk-ant-bad')).toBe(false);
  });

  it('verifyKey rethrows on a 5xx / network error', async () => {
    mockList.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
    await expect(verifyKey('sk-ant-x')).rejects.toThrow();
  });

  it('NoAnthropicKeyError is an Error with name NoAnthropicKeyError', () => {
    const err = new NoAnthropicKeyError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('NoAnthropicKeyError');
  });
});
