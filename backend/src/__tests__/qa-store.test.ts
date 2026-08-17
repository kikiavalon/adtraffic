import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, schema } from '../db/index.js';
import {
  createRun, saveChecks, completeRun, getRunWithChecks, listRuns, cleanupExpiredRuns, runToReport,
} from '../qa/qa-store.js';
import type { QACheckResult } from '@adtraffic/shared';

let testUserId: string;

beforeEach(async () => {
  // Delete children BEFORE users: audit_logs.user_id (and others) FK users
  // WITHOUT cascade (schema.ts:53) — mirror audit-service.test.ts:34-40 exactly.
  await db.delete(schema.qaChecks);
  await db.delete(schema.qaRuns);
  await db.delete(schema.approvalQueue);
  await db.delete(schema.auditLogs);
  await db.delete(schema.featureFlagOverrides);
  await db.delete(schema.oauthTokens);
  await db.delete(schema.messages);
  await db.delete(schema.conversations);
  await db.delete(schema.users);
  testUserId = randomUUID();
  await db.insert(schema.users).values({
    id: testUserId, email: `${testUserId}@test.com`, passwordHash: 'hashed', name: 'QA Test',
    createdAt: new Date(), updatedAt: new Date(),
  });
});

const CHECK: QACheckResult = {
  checkKey: 'config.click_through.ad:1', category: 'config', status: 'pass',
  message: 'resolves', expected: 'https://x.com',
};

function input(overrides: Record<string, unknown> = {}) {
  return {
    userId: testUserId, conversationId: 'conv-1', campaignId: '101', advertiserId: '1',
    trigger: 'auto' as const, touched: [{ toolName: 'cm360_update_ad', entityType: 'ad' as const, entityId: '2001' }],
    retentionDays: 30,
    ...overrides,
  };
}

describe('qa-store (database path)', () => {
  it('creates a run with a retention expiry ~retentionDays out', async () => {
    const run = await createRun(input({ retentionDays: 7 }));
    const expectedMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(run.expiresAt.getTime() - expectedMs)).toBeLessThan(5000);
    expect(run.status).toBe('running');
  });

  it('round-trips run + checks and maps to a QARunReport', async () => {
    const run = await createRun(input());
    await saveChecks(run.id, [CHECK]);
    await completeRun(run.id, 'passed');
    const found = await getRunWithChecks(run.id);
    expect(found).not.toBeNull();
    const report = runToReport(found!.run, found!.checks);
    expect(report.status).toBe('passed');
    expect(report.advisory).toBe(true);
    expect(report.touched[0]!.entityId).toBe('2001');
    expect(report.checks[0]!.checkKey).toBe(CHECK.checkKey);
    expect(report.checks[0]!.message).toBe('resolves');
  });

  it('saveChecks is an idempotent upsert on (run_id, check_key)', async () => {
    const run = await createRun(input());
    await saveChecks(run.id, [CHECK]);
    await saveChecks(run.id, [{ ...CHECK, status: 'fail', message: 'changed' }]);
    const found = await getRunWithChecks(run.id);
    expect(found!.checks.length).toBe(1);
    expect(found!.checks[0]!.status).toBe('fail');
  });

  it('listRuns filters by user and conversation, newest first', async () => {
    const a = await createRun(input({ conversationId: 'conv-A' }));
    await new Promise((r) => setTimeout(r, 25));
    const b = await createRun(input({ conversationId: 'conv-B' }));
    const all = await listRuns(testUserId, {});
    expect(all.runs.map((r) => r.id)).toEqual([b.id, a.id]);
    const onlyA = await listRuns(testUserId, { conversationId: 'conv-A' });
    expect(onlyA.runs.map((r) => r.id)).toEqual([a.id]);
  });

  it('cleanupExpiredRuns deletes runs past expiry (checks cascade)', async () => {
    const run = await createRun(input({ retentionDays: 0 }));
    await saveChecks(run.id, [CHECK]);
    await new Promise((r) => setTimeout(r, 10));
    await cleanupExpiredRuns();
    expect(await getRunWithChecks(run.id)).toBeNull();
  });
});

describe('qa-store (memory fallback)', () => {
  afterEach(() => { delete process.env.DEMO_MODE; });

  it('DEMO_MODE round-trips entirely in memory', async () => {
    process.env.DEMO_MODE = 'true';
    const run = await createRun(input({ userId: randomUUID() }));
    await saveChecks(run.id, [CHECK]);
    await completeRun(run.id, 'warned');
    const found = await getRunWithChecks(run.id);
    expect(found!.run.status).toBe('warned');
    expect(found!.checks.length).toBe(1);
  });

  it('falls back to memory when the insert fails (no users row)', async () => {
    const run = await createRun(input({ userId: 'not-a-uuid' as string }));
    const found = await getRunWithChecks(run.id);
    expect(found).not.toBeNull();
  });
});

describe('retention read-filter', () => {
  it('listRuns excludes expired runs', async () => {
    const expired = await createRun(input({ retentionDays: -1 }));
    const live = await createRun(input());
    const { runs } = await listRuns(testUserId, {});
    const ids = runs.map((r) => r.id);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(expired.id);
  });

  it('getRunWithChecks returns null for an expired run', async () => {
    const expired = await createRun(input({ retentionDays: -1 }));
    expect(await getRunWithChecks(expired.id)).toBeNull();
  });
});
