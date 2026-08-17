/**
 * Trafficking QA persistence — qa_runs + qa_checks.
 *
 * Database-backed when PostgreSQL is available; in-memory in DEMO_MODE or when
 * an insert fails (behavioral test harness user ids have no users row).
 * Mirrors backend/src/cm360/pending-actions.ts exactly.
 */

import crypto from 'crypto';
import { and, desc, eq, gt, lt } from 'drizzle-orm';
import type { QACheckResult, QARunReport, QARunStatus, QARunTrigger, QATouchedEntity } from '@adtraffic/shared';
import { db } from '../db/index.js';
import { qaChecks, qaEvidence, qaRuns } from '../db/schema.js';

export type QaRunRow = typeof qaRuns.$inferSelect;
export type QaCheckRow = Pick<typeof qaChecks.$inferSelect, 'checkKey' | 'category' | 'status' | 'expected' | 'actual' | 'detail' | 'evidenceId'>;

export interface CreateRunInput {
  userId: string;
  conversationId?: string;
  campaignId?: string;
  advertiserId?: string;
  trigger: QARunTrigger;
  touched: QATouchedEntity[];
  retentionDays: number;
}

interface MemoryRun {
  row: QaRunRow;
  checks: Map<string, QaCheckRow>;
  evidence: Map<string, { id: string; contentType: string; data: Buffer }>;
}
const memoryRuns = new Map<string, MemoryRun>();

function dbEnabled(): boolean {
  return process.env.DEMO_MODE !== 'true';
}

export async function createRun(input: CreateRunInput): Promise<QaRunRow> {
  const row: QaRunRow = {
    id: crypto.randomUUID(),
    userId: input.userId,
    conversationId: input.conversationId ?? null,
    campaignId: input.campaignId ?? null,
    advertiserId: input.advertiserId ?? null,
    trigger: input.trigger,
    status: 'running',
    scope: JSON.stringify(input.touched),
    startedAt: new Date(),
    completedAt: null,
    expiresAt: new Date(Date.now() + input.retentionDays * 24 * 60 * 60 * 1000),
  };
  if (dbEnabled()) {
    try {
      await db.insert(qaRuns).values(row);
      return row;
    } catch { /* fall through to memory */ }
  }
  memoryRuns.set(row.id, { row, checks: new Map(), evidence: new Map() });
  return row;
}

function toCheckRow(check: QACheckResult): QaCheckRow {
  return {
    checkKey: check.checkKey,
    category: check.category,
    status: check.status,
    expected: check.expected ?? null,
    actual: check.actual ?? null,
    detail: JSON.stringify({ message: check.message, ...(check.detail ?? {}) }),
    evidenceId: check.evidenceId ?? null,
  };
}

/** Idempotent upsert keyed on (run_id, check_key). */
export async function saveChecks(runId: string, checks: QACheckResult[]): Promise<void> {
  const memory = memoryRuns.get(runId);
  if (memory) {
    for (const check of checks) memory.checks.set(check.checkKey, toCheckRow(check));
    return;
  }
  if (!dbEnabled()) return;
  for (const check of checks) {
    const row = toCheckRow(check);
    await db.insert(qaChecks)
      .values({ runId, ...row })
      .onConflictDoUpdate({
        target: [qaChecks.runId, qaChecks.checkKey],
        set: { status: row.status, expected: row.expected, actual: row.actual, detail: row.detail, evidenceId: row.evidenceId },
      });
  }
}

export async function completeRun(runId: string, status: QARunStatus): Promise<void> {
  const completedAt = new Date();
  const memory = memoryRuns.get(runId);
  if (memory) {
    memory.row = { ...memory.row, status, completedAt };
    return;
  }
  if (!dbEnabled()) return;
  await db.update(qaRuns).set({ status, completedAt }).where(eq(qaRuns.id, runId));
}

/** Retention read-filter: expired runs are invisible even before the sweep deletes them. */
function isExpired(row: QaRunRow): boolean {
  return row.expiresAt.getTime() <= Date.now();
}

export async function getRunWithChecks(runId: string): Promise<{ run: QaRunRow; checks: QaCheckRow[] } | null> {
  const memory = memoryRuns.get(runId);
  if (memory) return isExpired(memory.row) ? null : { run: memory.row, checks: [...memory.checks.values()] };
  if (!dbEnabled()) return null;
  try {
    const rows = await db.select().from(qaRuns).where(eq(qaRuns.id, runId)).limit(1);
    const run = rows[0];
    if (!run || isExpired(run)) return null;
    const checks = await db.select().from(qaChecks).where(eq(qaChecks.runId, runId));
    return { run, checks };
  } catch {
    return null;
  }
}

export async function listRuns(
  userId: string,
  options: { conversationId?: string; limit?: number; offset?: number },
): Promise<{ runs: QaRunRow[]; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const fromMemory = [...memoryRuns.values()]
    .map((m) => m.row)
    .filter((r) => r.userId === userId && !isExpired(r) && (!options.conversationId || r.conversationId === options.conversationId));
  let fromDb: QaRunRow[] = [];
  if (dbEnabled()) {
    try {
      const conditions = [eq(qaRuns.userId, userId), gt(qaRuns.expiresAt, new Date())];
      if (options.conversationId) conditions.push(eq(qaRuns.conversationId, options.conversationId));
      fromDb = await db.select().from(qaRuns).where(and(...conditions)).orderBy(desc(qaRuns.startedAt));
    } catch { /* memory only */ }
  }
  const all = [...fromDb, ...fromMemory].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  return { runs: all.slice(offset, offset + limit), total: all.length };
}

/** Opportunistic retention sweep — mirrors pending-actions cleanupExpired. Best effort, never throws. */
export async function cleanupExpiredRuns(): Promise<void> {
  const now = Date.now();
  for (const [id, memory] of memoryRuns) {
    if (memory.row.expiresAt.getTime() <= now) memoryRuns.delete(id);
  }
  if (!dbEnabled()) return;
  try {
    await db.delete(qaRuns).where(lt(qaRuns.expiresAt, new Date()));
  } catch { /* best effort */ }
}

function parseDetailObject(detail: string | null): Record<string, unknown> {
  if (!detail) return {};
  try {
    const parsed = JSON.parse(detail) as unknown;
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function runToReport(run: QaRunRow, checks: QaCheckRow[]): QARunReport {
  let touched: QATouchedEntity[] = [];
  try { touched = JSON.parse(run.scope) as QATouchedEntity[]; } catch { /* keep [] */ }
  return {
    runId: run.id,
    status: run.status,
    trigger: run.trigger,
    advisory: true,
    ...(run.campaignId ? { campaignId: run.campaignId } : {}),
    ...(run.advertiserId ? { advertiserId: run.advertiserId } : {}),
    ...(run.conversationId ? { conversationId: run.conversationId } : {}),
    touched,
    checks: checks.map((c) => {
      const { message, ...rest } = parseDetailObject(c.detail);
      return {
        checkKey: c.checkKey,
        category: c.category,
        status: c.status,
        message: typeof message === 'string' ? message : '',
        ...(Object.keys(rest).length > 0 ? { detail: rest } : {}),
        ...(c.expected !== null ? { expected: c.expected } : {}),
        ...(c.actual !== null ? { actual: c.actual } : {}),
        ...(c.evidenceId ? { evidenceId: c.evidenceId } : {}),
      };
    }),
    startedAt: run.startedAt.getTime(),
    ...(run.completedAt ? { completedAt: run.completedAt.getTime() } : {}),
  };
}

/** Idempotent evidence upsert keyed on (run_id, source_key) — replica-safe. */
export async function saveEvidence(
  runId: string,
  sourceKey: string,
  contentType: string,
  data: Buffer,
): Promise<string> {
  const memory = memoryRuns.get(runId);
  if (memory) {
    const existing = memory.evidence.get(sourceKey);
    const id = existing?.id ?? crypto.randomUUID();
    memory.evidence.set(sourceKey, { id, contentType, data });
    return id;
  }
  const rows = await db.insert(qaEvidence)
    .values({ id: crypto.randomUUID(), runId, sourceKey, contentType, data, createdAt: new Date() })
    .onConflictDoUpdate({
      target: [qaEvidence.runId, qaEvidence.sourceKey],
      set: { contentType, data },
    })
    .returning({ id: qaEvidence.id });
  return rows[0]!.id;
}

export async function getEvidence(
  evidenceId: string,
): Promise<{ runId: string; contentType: string; data: Buffer } | null> {
  for (const [runId, memory] of memoryRuns) {
    for (const evidence of memory.evidence.values()) {
      if (evidence.id === evidenceId) {
        return { runId, contentType: evidence.contentType, data: evidence.data };
      }
    }
  }
  if (!dbEnabled()) return null;
  try {
    const rows = await db.select().from(qaEvidence).where(eq(qaEvidence.id, evidenceId)).limit(1);
    const row = rows[0];
    return row ? { runId: row.runId, contentType: row.contentType, data: row.data } : null;
  } catch {
    return null;
  }
}

export const STALLED_RUN_MS = 15 * 60 * 1000;

/** Design §4 failure policy: runs stuck in `running` > 15 min → error.
 * Piggybacks the retention sweep (called alongside cleanupExpiredRuns). */
export async function markStalledRuns(): Promise<void> {
  const cutoff = new Date(Date.now() - STALLED_RUN_MS);
  for (const memory of memoryRuns.values()) {
    if (memory.row.status === 'running' && memory.row.startedAt < cutoff) {
      memory.row = { ...memory.row, status: 'error', completedAt: new Date() };
    }
  }
  if (!dbEnabled()) return;
  try {
    await db.update(qaRuns)
      .set({ status: 'error', completedAt: new Date() })
      .where(and(eq(qaRuns.status, 'running'), lt(qaRuns.startedAt, cutoff)));
  } catch { /* best effort */ }
}

function isQueuedCheck(row: QaCheckRow): boolean {
  return parseDetailObject(row.detail)['queued'] === true;
}

/** Run-status roll-up over persisted rows; a runnerFailure detail (exhausted
 * BullMQ retries) dominates as `error` — never silently dropped (design §4). */
export function computeRunStatus(checks: QaCheckRow[]): 'passed' | 'warned' | 'failed' | 'error' {
  if (checks.some((c) => parseDetailObject(c.detail)['runnerFailure'] === true)) return 'error';
  if (checks.some((c) => c.status === 'fail')) return 'failed';
  if (checks.some((c) => c.status === 'warn')) return 'warned';
  return 'passed';
}

/** Complete a `running` run once no queued placeholders remain. Idempotent and
 * replica-safe: on the second replica the run is usually no longer `running` →
 * null. If both replicas race past the `running` read, both complete the run
 * (same status — idempotent update) and a duplicate qa_run_completed audit
 * event is emitted; that duplicate is ACCEPTED — the audit log is append-only
 * observability, not a ledger, and serializing across replicas isn't worth it. */
export async function finalizeRunIfSettled(
  runId: string,
): Promise<{ status: 'passed' | 'warned' | 'failed' | 'error'; userId: string; checkCount: number } | null> {
  const found = await getRunWithChecks(runId);
  if (!found || found.run.status !== 'running') return null;
  if (found.checks.some(isQueuedCheck)) return null;
  const status = computeRunStatus(found.checks);
  await completeRun(runId, status);
  return { status, userId: found.run.userId, checkCount: found.checks.length };
}
