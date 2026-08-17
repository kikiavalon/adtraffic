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
import { qaChecks, qaRuns } from '../db/schema.js';

export type QaRunRow = typeof qaRuns.$inferSelect;
export type QaCheckRow = Pick<typeof qaChecks.$inferSelect, 'checkKey' | 'category' | 'status' | 'expected' | 'actual' | 'detail'>;

export interface CreateRunInput {
  userId: string;
  conversationId?: string;
  campaignId?: string;
  advertiserId?: string;
  trigger: QARunTrigger;
  touched: QATouchedEntity[];
  retentionDays: number;
}

interface MemoryRun { row: QaRunRow; checks: Map<string, QaCheckRow>; }
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
  memoryRuns.set(row.id, { row, checks: new Map() });
  return row;
}

function toCheckRow(check: QACheckResult): QaCheckRow {
  return {
    checkKey: check.checkKey,
    category: check.category,
    status: check.status,
    expected: check.expected ?? null,
    actual: check.actual ?? null,
    detail: JSON.stringify({ message: check.message }),
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
        set: { status: row.status, expected: row.expected, actual: row.actual, detail: row.detail },
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

function parseDetailMessage(detail: string | null): string {
  if (!detail) return '';
  try {
    const parsed = JSON.parse(detail) as { message?: string };
    return parsed.message ?? '';
  } catch {
    return '';
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
    checks: checks.map((c) => ({
      checkKey: c.checkKey,
      category: c.category,
      status: c.status,
      message: parseDetailMessage(c.detail),
      ...(c.expected !== null ? { expected: c.expected } : {}),
      ...(c.actual !== null ? { actual: c.actual } : {}),
    })),
    startedAt: run.startedAt.getTime(),
    ...(run.completedAt ? { completedAt: run.completedAt.getTime() } : {}),
  };
}
