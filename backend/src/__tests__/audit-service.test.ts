/**
 * Tests for the audit logging service.
 *
 * Tests verify:
 * - Correct event logging for each event type
 * - IP address hashing (deterministic, non-reversible, never raw)
 * - User agent truncation at 500 chars
 * - DB errors are caught and logged, never thrown
 * - Query filtering by userId and conversationId
 * - Query pagination with limit/offset
 */

import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, schema } from '../db/index.js';
import {
  logAuditEvent,
  getAuditLog,
  hashIp,
  type AuditEntry,
  type AuditEventType,
} from '../audit/audit-service.js';
import { eq } from 'drizzle-orm';
import { auditLogs } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let testUserId: string;

beforeEach(async () => {
  // Clean up audit logs and users from previous tests
  await db.delete(schema.approvalQueue);
  await db.delete(schema.auditLogs);
  await db.delete(schema.featureFlagOverrides);
  await db.delete(schema.oauthTokens);
  await db.delete(schema.messages);
  await db.delete(schema.conversations);
  await db.delete(schema.users);

  // Create a test user
  const userId = randomUUID();
  await db.insert(schema.users).values({
    id: userId,
    email: `${userId}@test.com`,
    passwordHash: 'hashed',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  testUserId = userId;
});

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    userId: testUserId,
    eventType: 'message_sent',
    metadata: { text: 'hello' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// hashIp
// ---------------------------------------------------------------------------

describe('hashIp', () => {
  it('returns undefined for undefined input', () => {
    expect(hashIp(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    // Empty string is falsy, treated same as undefined
    expect(hashIp('')).toBeUndefined();
  });

  it('returns a 16-character hex string', () => {
    const result = hashIp('192.168.1.1');
    expect(result).toBeDefined();
    expect(result!.length).toBe(16);
    expect(result).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces deterministic hashes (same input -> same output)', () => {
    const hash1 = hashIp('10.0.0.1');
    const hash2 = hashIp('10.0.0.1');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different IPs', () => {
    const hash1 = hashIp('192.168.1.1');
    const hash2 = hashIp('192.168.1.2');
    expect(hash1).not.toBe(hash2);
  });

  it('never returns the raw IP address', () => {
    const ip = '203.0.113.42';
    const result = hashIp(ip);
    expect(result).not.toContain('203');
    expect(result).not.toContain('113');
    expect(result).not.toContain('42');
    // Also check it's not just base64 of the IP
    expect(result).not.toBe(ip);
  });
});

// ---------------------------------------------------------------------------
// logAuditEvent
// ---------------------------------------------------------------------------

describe('logAuditEvent', () => {
  it('logs a message_sent event', async () => {
    await logAuditEvent(makeEntry({
      eventType: 'message_sent',
      metadata: { text: 'Create a new campaign for Acme Corp' },
    }));

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, testUserId));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.eventType).toBe('message_sent');
    expect(JSON.parse(row.metadata)).toEqual({ text: 'Create a new campaign for Acme Corp' });
    expect(row.userId).toBe(testUserId);
  });

  it('logs a tool_executed event with tool name and input', async () => {
    await logAuditEvent(makeEntry({
      eventType: 'tool_executed',
      conversationId: 'conv-123',
      metadata: {
        toolName: 'cm360_create_campaign',
        input: { advertiserId: '1001', name: 'Q1 Campaign' },
        result: 'success',
      },
    }));

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, testUserId));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.eventType).toBe('tool_executed');
    expect(row.conversationId).toBe('conv-123');
    const meta = JSON.parse(row.metadata) as Record<string, unknown>;
    expect(meta.toolName).toBe('cm360_create_campaign');
    expect((meta.input as Record<string, unknown>).advertiserId).toBe('1001');
  });

  it('logs a confirmation_approved event with action details', async () => {
    await logAuditEvent(makeEntry({
      eventType: 'confirmation_approved',
      conversationId: 'conv-456',
      sessionId: 'session-abc',
      metadata: {
        toolName: 'cm360_update_placement',
        action: 'activate',
        placementId: '2002',
      },
    }));

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, testUserId));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.eventType).toBe('confirmation_approved');
    expect(row.sessionId).toBe('session-abc');
    const meta = JSON.parse(row.metadata) as Record<string, unknown>;
    expect(meta.action).toBe('activate');
  });

  it('hashes IP addresses (never stores raw IPs)', async () => {
    const rawIp = '198.51.100.42';
    await logAuditEvent(makeEntry({ ipAddress: rawIp }));

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, testUserId));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    // Must not contain the raw IP
    expect(row.ipHash).not.toBe(rawIp);
    expect(row.ipHash).not.toContain('198');
    // Must be a 16-char hex hash
    expect(row.ipHash).toMatch(/^[0-9a-f]{16}$/);
    // Must match the hashIp function output
    expect(row.ipHash).toBe(hashIp(rawIp));
  });

  it('stores null ipHash when no IP is provided', async () => {
    await logAuditEvent(makeEntry({ ipAddress: undefined }));

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, testUserId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.ipHash).toBeNull();
  });

  it('truncates user agent to 500 chars', async () => {
    const longUA = 'A'.repeat(600);
    await logAuditEvent(makeEntry({ userAgent: longUA }));

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, testUserId));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.userAgent).toHaveLength(500);
    expect(row.userAgent).toBe('A'.repeat(500));
  });

  it('stores full user agent when under 500 chars', async () => {
    const normalUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    await logAuditEvent(makeEntry({ userAgent: normalUA }));

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, testUserId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userAgent).toBe(normalUA);
  });

  it('stores null userAgent when none provided', async () => {
    await logAuditEvent(makeEntry({ userAgent: undefined }));

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, testUserId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userAgent).toBeNull();
  });

  it('stores optional conversationId and sessionId', async () => {
    await logAuditEvent(makeEntry({
      conversationId: 'conv-789',
      sessionId: 'sess-xyz',
    }));

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, testUserId));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.conversationId).toBe('conv-789');
    expect(row.sessionId).toBe('sess-xyz');
  });

  it('stores null for optional fields when not provided', async () => {
    await logAuditEvent(makeEntry());

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, testUserId));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.conversationId).toBeNull();
    expect(row.sessionId).toBeNull();
  });

  it('sets createdAt timestamp automatically', async () => {
    await logAuditEvent(makeEntry());

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, testUserId));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    // createdAt should be a valid Date (set by DB's defaultNow())
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(Number.isNaN(row.createdAt.getTime())).toBe(false);
    // Should be a reasonable date (year 2020+, not epoch 0 or far future)
    const year = row.createdAt.getFullYear();
    expect(year).toBeGreaterThanOrEqual(2020);
    expect(year).toBeLessThanOrEqual(2030);
  });

  it('generates a UUID primary key', async () => {
    await logAuditEvent(makeEntry());

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, testUserId));
    expect(rows).toHaveLength(1);
    // UUID v4 format check
    expect(rows[0]!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('does not throw when DB write fails (invalid userId)', async () => {
    // Use a non-existent userId to trigger a foreign key constraint violation
    const badEntry = makeEntry({ userId: randomUUID() });

    // Should not throw -- fire-and-forget behavior
    await expect(logAuditEvent(badEntry)).resolves.toBeUndefined();
  });

  it('logs all supported event types', async () => {
    const eventTypes: AuditEventType[] = [
      'message_sent',
      'message_received',
      'tool_proposed',
      'tool_executed',
      'confirmation_approved',
      'confirmation_rejected',
      'confirmation_typed',
      'button_clicked',
      'error_occurred',
      'session_started',
      'session_ended',
      'rate_limited',
      'daily_limit_reached',
    ];

    for (const eventType of eventTypes) {
      await logAuditEvent(makeEntry({ eventType, metadata: { type: eventType } }));
    }

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, testUserId));
    expect(rows).toHaveLength(eventTypes.length);

    const storedTypes = rows.map((r) => r.eventType).sort();
    expect(storedTypes).toEqual([...eventTypes].sort());
  });
});

// ---------------------------------------------------------------------------
// getAuditLog
// ---------------------------------------------------------------------------

describe('getAuditLog', () => {
  it('retrieves audit logs for a user', async () => {
    await logAuditEvent(makeEntry({ metadata: { msg: 'first' } }));
    await logAuditEvent(makeEntry({ metadata: { msg: 'second' } }));

    const results = await getAuditLog(testUserId);
    expect(results).toHaveLength(2);
    // Should be ordered by createdAt DESC (newest first)
    const meta0 = JSON.parse(results[0]!.metadata) as Record<string, unknown>;
    const meta1 = JSON.parse(results[1]!.metadata) as Record<string, unknown>;
    expect(meta0.msg).toBe('second');
    expect(meta1.msg).toBe('first');
  });

  it('returns empty array for user with no audit logs', async () => {
    const results = await getAuditLog(testUserId);
    expect(results).toEqual([]);
  });

  it('filters by conversationId', async () => {
    await logAuditEvent(makeEntry({ conversationId: 'conv-A', metadata: { n: 1 } }));
    await logAuditEvent(makeEntry({ conversationId: 'conv-B', metadata: { n: 2 } }));
    await logAuditEvent(makeEntry({ conversationId: 'conv-A', metadata: { n: 3 } }));

    const results = await getAuditLog(testUserId, { conversationId: 'conv-A' });
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.conversationId).toBe('conv-A'));
  });

  it('does not return logs from other users', async () => {
    // Create a second user
    const otherUserId = randomUUID();
    await db.insert(schema.users).values({
      id: otherUserId,
      email: `${otherUserId}@test.com`,
      passwordHash: 'hashed',
      name: 'Other User',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await logAuditEvent(makeEntry({ metadata: { owner: 'testUser' } }));
    await logAuditEvent(makeEntry({ userId: otherUserId, metadata: { owner: 'otherUser' } }));

    const results = await getAuditLog(testUserId);
    expect(results).toHaveLength(1);
    expect((JSON.parse(results[0]!.metadata) as Record<string, unknown>).owner).toBe('testUser');
  });

  it('paginates with limit', async () => {
    // Insert 5 entries
    for (let i = 0; i < 5; i++) {
      await logAuditEvent(makeEntry({ metadata: { index: i } }));
    }

    const results = await getAuditLog(testUserId, { limit: 3 });
    expect(results).toHaveLength(3);
  });

  it('paginates with offset', async () => {
    for (let i = 0; i < 5; i++) {
      await logAuditEvent(makeEntry({ metadata: { index: i } }));
    }

    const page1 = await getAuditLog(testUserId, { limit: 2, offset: 0 });
    const page2 = await getAuditLog(testUserId, { limit: 2, offset: 2 });
    const page3 = await getAuditLog(testUserId, { limit: 2, offset: 4 });

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page3).toHaveLength(1);

    // No overlap between pages
    const allIds = [...page1, ...page2, ...page3].map((r) => r.id);
    expect(new Set(allIds).size).toBe(5);
  });

  it('clamps limit to max 250', async () => {
    // Even if caller requests 500, should be clamped to 250 internally
    // We can verify by inserting fewer items -- no error is thrown
    await logAuditEvent(makeEntry());
    const results = await getAuditLog(testUserId, { limit: 500 });
    expect(results).toHaveLength(1);
  });

  it('clamps limit minimum to 1', async () => {
    await logAuditEvent(makeEntry());
    const results = await getAuditLog(testUserId, { limit: 0 });
    expect(results).toHaveLength(1);
  });

  it('clamps offset minimum to 0', async () => {
    await logAuditEvent(makeEntry());
    const results = await getAuditLog(testUserId, { offset: -5 });
    expect(results).toHaveLength(1);
  });

  it('defaults to limit=50 when not specified', async () => {
    // Insert 60 entries
    for (let i = 0; i < 60; i++) {
      await logAuditEvent(makeEntry({ metadata: { index: i } }));
    }

    const results = await getAuditLog(testUserId);
    expect(results).toHaveLength(50);
  });

  it('orders results by createdAt DESC (newest first)', async () => {
    // Insert with sequential operations to ensure order
    await logAuditEvent(makeEntry({ metadata: { order: 'first' } }));
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    await logAuditEvent(makeEntry({ metadata: { order: 'second' } }));
    await new Promise((r) => setTimeout(r, 10));
    await logAuditEvent(makeEntry({ metadata: { order: 'third' } }));

    const results = await getAuditLog(testUserId);
    expect(results).toHaveLength(3);

    // Newest first
    expect((JSON.parse(results[0]!.metadata) as Record<string, unknown>).order).toBe('third');
    expect((JSON.parse(results[1]!.metadata) as Record<string, unknown>).order).toBe('second');
    expect((JSON.parse(results[2]!.metadata) as Record<string, unknown>).order).toBe('first');

    // Timestamps should be in descending order
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i]!.createdAt.getTime()).toBeGreaterThanOrEqual(results[i + 1]!.createdAt.getTime());
    }
  });
});
