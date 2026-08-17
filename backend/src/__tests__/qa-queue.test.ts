import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, schema } from '../db/index.js';
import { createRun, getRunWithChecks, saveChecks, getEvidence } from '../qa/qa-store.js';
import {
  getQaQueue, enqueueClickTests, clickJobId, parseClickJobId,
  handleClickTestResult, handleClickTestFailure, withTimeout,
} from '../qa/qa-queue.js';
import type { QAClickTestResult } from '@adtraffic/shared';

let testUserId: string;

beforeEach(async () => {
  // Children before users (audit_logs FK has no cascade — see qa-store.test.ts note).
  // qa_checks references qa_evidence (set null) and qa_evidence FKs qa_runs (cascade):
  // delete qaChecks, then qaEvidence, then qaRuns.
  await db.delete(schema.qaChecks);
  await db.delete(schema.qaEvidence);
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

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    userId: testUserId, conversationId: 'conv-1', campaignId: '101', advertiserId: '1',
    trigger: 'auto' as const, touched: [{ toolName: 'cm360_update_ad', entityType: 'ad' as const, entityId: '2001' }],
    retentionDays: 30,
    ...overrides,
  };
}

const QUEUED = {
  checkKey: 'clickthrough.click_test.ad:2001', category: 'clickthrough' as const,
  status: 'skipped' as const, message: 'queued', detail: { queued: true },
};

function result(runId: string): QAClickTestResult {
  return {
    runId, adId: '2001',
    checks: [
      { checkKey: 'clickthrough.click_test.ad:2001', category: 'clickthrough', status: 'pass', message: 'Click test: 2 hop(s)' },
      { checkKey: 'landing.renders.ad:2001', category: 'landing', status: 'pass', message: 'rendered' },
    ],
    evidence: { contentType: 'image/png', dataBase64: Buffer.from('png').toString('base64'), forCheckKey: 'landing.renders.ad:2001' },
  };
}

describe('qa-queue availability', () => {
  it('is disabled under NODE_ENV=test (mirrors initRedis)', async () => {
    expect(getQaQueue()).toBeNull();
    expect(await enqueueClickTests([{ runId: 'r', adId: 'a', clickUrl: 'x', expectedFirstHopPattern: '.' }])).toBe(false);
  });

  it('jobId round-trips without the BullMQ-reserved colon', () => {
    const id = clickJobId('run-1', '2001');
    expect(id).not.toContain(':');
    expect(parseClickJobId(id)).toEqual({ runId: 'run-1', adId: '2001' });
    expect(parseClickJobId('garbage')).toBeNull();
  });
});

describe('enqueue never hangs the request (advisory guarantee)', () => {
  it('withTimeout rejects a never-resolving promise within the bound', async () => {
    const never = new Promise<void>(() => { /* hangs */ });
    await expect(withTimeout(never, 50)).rejects.toThrow(/timed out/);
  });

  it('a wedged addBulk degrades enqueue to false within the bound', async () => {
    // Simulate live mode with a wedged Redis: queueAvailable() is env-gated,
    // so flip NODE_ENV and stub the queue module's singleton via bullmq mock.
    vi.doMock('bullmq', () => ({
      Queue: class { addBulk() { return new Promise(() => { /* never */ }); } },
      QueueEvents: class {},
      Job: class {},
    }));
    vi.doMock('ioredis', () => ({ Redis: class { quit() { return Promise.resolve(); } } }));
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      vi.resetModules(); // fresh module instance picks up the doMock-ed bullmq
      const fresh = await import('../qa/qa-queue.js');
      const start = Date.now();
      const ok = await fresh.enqueueClickTests(
        [{ runId: 'r', adId: 'a', clickUrl: 'x', expectedFirstHopPattern: '.' }],
        200,
      );
      expect(ok).toBe(false);
      expect(Date.now() - start).toBeLessThan(2_000);
    } finally {
      process.env.NODE_ENV = previous;
      vi.doUnmock('bullmq');
      vi.doUnmock('ioredis');
      vi.resetModules();
    }
  });
});

describe('handleClickTestResult', () => {
  it('persists evidence + checks, overwrites the queued placeholder, finalizes, audits', async () => {
    const run = await createRun(makeInput());
    await saveChecks(run.id, [QUEUED]);
    await handleClickTestResult(result(run.id));

    const found = await getRunWithChecks(run.id);
    expect(found!.run.status).toBe('passed');
    const renders = found!.checks.find((c) => c.checkKey === 'landing.renders.ad:2001');
    expect(renders!.evidenceId).toBeTruthy();
    expect((await getEvidence(renders!.evidenceId!))!.data.toString()).toBe('png');
    const summary = found!.checks.find((c) => c.checkKey === 'clickthrough.click_test.ad:2001');
    expect(summary!.status).toBe('pass'); // placeholder overwritten

    const audits = await db.select().from(schema.auditLogs);
    expect(audits.map((a) => a.eventType)).toContain('qa_run_completed');
  });

  it('is idempotent — the duplicate replica delivery changes nothing', async () => {
    const run = await createRun(makeInput());
    await saveChecks(run.id, [QUEUED]);
    await handleClickTestResult(result(run.id));
    await handleClickTestResult(result(run.id));
    const found = await getRunWithChecks(run.id);
    expect(found!.checks.filter((c) => c.checkKey === 'landing.renders.ad:2001').length).toBe(1);
    const evidence = await db.select().from(schema.qaEvidence);
    expect(evidence.length).toBe(1);
  });

  it('does not finalize while another ad is still queued', async () => {
    const run = await createRun(makeInput());
    await saveChecks(run.id, [QUEUED, { ...QUEUED, checkKey: 'clickthrough.click_test.ad:2002' }]);
    await handleClickTestResult(result(run.id));
    expect((await getRunWithChecks(run.id))!.run.status).toBe('running');
  });
});

describe('handleClickTestFailure (exhausted retries)', () => {
  it('records the last failure and errors the run — never silently dropped', async () => {
    const run = await createRun(makeInput());
    await saveChecks(run.id, [QUEUED]);
    await handleClickTestFailure(run.id, '2001', 'browser crashed');
    const found = await getRunWithChecks(run.id);
    expect(found!.run.status).toBe('error');
    const summary = found!.checks.find((c) => c.checkKey === 'clickthrough.click_test.ad:2001');
    expect(summary!.status).toBe('fail');
    expect(JSON.parse(summary!.detail!)['runnerFailure']).toBe(true);
  });
});
