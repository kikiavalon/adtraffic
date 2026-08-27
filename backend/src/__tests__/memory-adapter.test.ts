import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb, createNoOpSql } from '../db/memory-adapter.js';
import { eq, desc, asc, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';

describe('memory-adapter', () => {
  describe('createNoOpSql', () => {
    it('returns [{ "1": 1 }] for health check queries', async () => {
      const sql = createNoOpSql();
      const result = await sql`SELECT 1`;
      expect(result).toEqual([{ '1': 1 }]);
    });

    it('end() resolves without error', async () => {
      const sql = createNoOpSql();
      await expect(sql.end()).resolves.toBeUndefined();
    });
  });

  describe('createMemoryDb', () => {
    it('returns a db object with select, insert, update, delete methods', () => {
      const { db } = createMemoryDb();
      expect(typeof db.select).toBe('function');
      expect(typeof db.insert).toBe('function');
      expect(typeof db.update).toBe('function');
      expect(typeof db.delete).toBe('function');
    });
  });
});

describe('memory-adapter CRUD', () => {
  let db: ReturnType<typeof createMemoryDb>['db'];

  beforeEach(() => {
    ({ db } = createMemoryDb());
  });

  describe('users table', () => {
    it('starts with no users (fresh instance)', async () => {
      const users = await db.select().from(schema.users);
      expect(users).toHaveLength(0);
    });

    it('insert with returning projects specified columns', async () => {
      const result = await db.insert(schema.users).values({
        email: 'test@example.com',
        passwordHash: 'hash123',
        name: 'Test User',
      }).returning({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('email', 'test@example.com');
      expect(result[0]).toHaveProperty('name', 'Test User');
      expect(result[0]).not.toHaveProperty('passwordHash');
    });

    it('rejects duplicate email', async () => {
      await db.insert(schema.users).values({ email: 'dup@example.com', passwordHash: 'hash', name: 'First' });
      await expect(
        db.insert(schema.users).values({
          email: 'dup@example.com',
          passwordHash: 'hash',
          name: 'Dupe',
        })
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('conversations + messages', () => {
    it('insert with onConflictDoNothing skips duplicates', async () => {
      const [owner] = await db.insert(schema.users).values({ email: 'owner1@example.com', passwordHash: 'h', name: 'Owner' }).returning({ id: schema.users.id });
      const userId = owner!.id as string;

      await db.insert(schema.conversations).values({ id: 'conv-1', userId, title: 'First' }).onConflictDoNothing();
      await db.insert(schema.conversations).values({ id: 'conv-1', userId, title: 'Duplicate' }).onConflictDoNothing();

      const convos = await db.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-1'));
      expect(convos).toHaveLength(1);
      expect(convos[0]).toHaveProperty('title', 'First');
    });

    it('select with orderBy desc + limit + offset paginates correctly', async () => {
      const [owner] = await db.insert(schema.users).values({ email: 'owner2@example.com', passwordHash: 'h', name: 'Owner' }).returning({ id: schema.users.id });
      const userId = owner!.id as string;

      // Insert 3 conversations with different updatedAt
      const now = Date.now();
      for (let i = 0; i < 3; i++) {
        await db.insert(schema.conversations).values({
          id: `conv-${i}`,
          userId,
          title: `Conv ${i}`,
          createdAt: new Date(now + i * 1000),
          updatedAt: new Date(now + i * 1000),
        });
      }

      const page = await db.select({
        id: schema.conversations.id,
        title: schema.conversations.title,
        updatedAt: schema.conversations.updatedAt,
      })
        .from(schema.conversations)
        .where(eq(schema.conversations.userId, userId))
        .orderBy(desc(schema.conversations.updatedAt))
        .limit(2)
        .offset(0);

      expect(page).toHaveLength(2);
      expect(page[0]).toHaveProperty('title', 'Conv 2');
      expect(page[1]).toHaveProperty('title', 'Conv 1');
    });

    it('select with orderBy asc returns chronological order', async () => {
      const [owner] = await db.insert(schema.users).values({ email: 'owner@example.com', passwordHash: 'h', name: 'Owner' }).returning({ id: schema.users.id });
      const userId = owner!.id as string;

      await db.insert(schema.conversations).values({ id: 'conv-1', userId, title: 'Chat' });

      await db.insert(schema.messages).values({ id: 'msg-1', conversationId: 'conv-1', role: 'user', content: 'Hello', timestamp: 100 });
      await db.insert(schema.messages).values({ id: 'msg-2', conversationId: 'conv-1', role: 'assistant', content: 'Hi!', timestamp: 200 });

      const msgs = await db.select({
        id: schema.messages.id,
        content: schema.messages.content,
        timestamp: schema.messages.timestamp,
      })
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, 'conv-1'))
        .orderBy(asc(schema.messages.timestamp))
        .limit(100)
        .offset(0);

      expect(msgs).toHaveLength(2);
      expect(msgs[0]).toHaveProperty('content', 'Hello');
      expect(msgs[1]).toHaveProperty('content', 'Hi!');
    });

    it('delete cascades from conversations to messages', async () => {
      const [owner] = await db.insert(schema.users).values({ email: 'owner@example.com', passwordHash: 'h', name: 'Owner' }).returning({ id: schema.users.id });
      const userId = owner!.id as string;

      await db.insert(schema.conversations).values({ id: 'conv-del', userId, title: 'Delete me' });
      await db.insert(schema.messages).values({ id: 'msg-del', conversationId: 'conv-del', role: 'user', content: 'Gone', timestamp: 100 });

      await db.delete(schema.conversations).where(eq(schema.conversations.id, 'conv-del'));

      const convos = await db.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-del'));
      const msgs = await db.select().from(schema.messages).where(eq(schema.messages.conversationId, 'conv-del'));
      expect(convos).toHaveLength(0);
      expect(msgs).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('updates matching records', async () => {
      const [owner] = await db.insert(schema.users).values({ email: 'owner@example.com', passwordHash: 'h', name: 'Owner' }).returning({ id: schema.users.id });
      const userId = owner!.id as string;

      await db.insert(schema.conversations).values({ id: 'conv-upd', userId, title: 'Old', updatedAt: new Date(1000) });

      const newDate = new Date();
      await db.update(schema.conversations).set({ updatedAt: newDate }).where(eq(schema.conversations.id, 'conv-upd'));

      const updated = await db.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-upd'));
      expect(updated[0]!.updatedAt).toEqual(newDate);
    });
  });

  describe('feature flags — onConflictDoUpdate + and()', () => {
    it('upsert with onConflictDoUpdate creates then updates', async () => {
      const [owner] = await db.insert(schema.users).values({ email: 'owner@example.com', passwordHash: 'h', name: 'Owner' }).returning({ id: schema.users.id });
      const userId = owner!.id as string;

      // Insert
      await db.insert(schema.featureFlagOverrides).values({
        userId,
        flagName: 'chat.enabled',
        value: 'true',
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [schema.featureFlagOverrides.userId, schema.featureFlagOverrides.flagName],
        set: { value: 'true', updatedAt: new Date() },
      });

      let flags = await db.select().from(schema.featureFlagOverrides).where(eq(schema.featureFlagOverrides.userId, userId));
      expect(flags).toHaveLength(1);
      expect(flags[0]).toHaveProperty('value', 'true');

      // Upsert (update existing)
      await db.insert(schema.featureFlagOverrides).values({
        userId,
        flagName: 'chat.enabled',
        value: 'false',
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [schema.featureFlagOverrides.userId, schema.featureFlagOverrides.flagName],
        set: { value: 'false', updatedAt: new Date() },
      });

      flags = await db.select().from(schema.featureFlagOverrides).where(eq(schema.featureFlagOverrides.userId, userId));
      expect(flags).toHaveLength(1);
      expect(flags[0]).toHaveProperty('value', 'false');
    });

    it('delete with and() compound condition', async () => {
      const [owner] = await db.insert(schema.users).values({ email: 'owner@example.com', passwordHash: 'h', name: 'Owner' }).returning({ id: schema.users.id });
      const userId = owner!.id as string;

      await db.insert(schema.featureFlagOverrides).values({ userId, flagName: 'flag-a', value: 'true', updatedAt: new Date() });
      await db.insert(schema.featureFlagOverrides).values({ userId, flagName: 'flag-b', value: 'false', updatedAt: new Date() });

      // Delete only flag-a
      await db.delete(schema.featureFlagOverrides).where(
        and(
          eq(schema.featureFlagOverrides.userId, userId),
          eq(schema.featureFlagOverrides.flagName, 'flag-a'),
        ),
      );

      const remaining = await db.select().from(schema.featureFlagOverrides).where(eq(schema.featureFlagOverrides.userId, userId));
      expect(remaining).toHaveLength(1);
      expect(remaining[0]).toHaveProperty('flagName', 'flag-b');
    });
  });

  describe('oauth tokens', () => {
    it('CRUD cycle works', async () => {
      const [owner] = await db.insert(schema.users).values({ email: 'owner@example.com', passwordHash: 'h', name: 'Owner' }).returning({ id: schema.users.id });
      const userId = owner!.id as string;

      await db.insert(schema.oauthTokens).values({
        id: randomUUID(),
        userId,
        accessToken: 'enc-access',
        refreshToken: 'enc-refresh',
        expiresAt: new Date(Date.now() + 3600_000),
        scopes: 'dfatrafficking dfareporting',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Select with projection
      const check = await db.select({ userId: schema.oauthTokens.userId }).from(schema.oauthTokens).where(eq(schema.oauthTokens.userId, userId));
      expect(check).toHaveLength(1);
      expect(check[0]).toEqual({ userId });

      // Update
      await db.update(schema.oauthTokens).set({ accessToken: 'new-token', updatedAt: new Date() }).where(eq(schema.oauthTokens.userId, userId));
      const updated = await db.select().from(schema.oauthTokens).where(eq(schema.oauthTokens.userId, userId));
      expect(updated[0]).toHaveProperty('accessToken', 'new-token');

      // Delete
      await db.delete(schema.oauthTokens).where(eq(schema.oauthTokens.userId, userId));
      const deleted = await db.select().from(schema.oauthTokens).where(eq(schema.oauthTokens.userId, userId));
      expect(deleted).toHaveLength(0);
    });
  });
});
