/**
 * Trafficking QA — BullMQ plumbing for Layer 3 click tests (live mode only).
 *
 * IMPORTANT: BullMQ needs dedicated Redis connections with
 * maxRetriesPerRequest: null. It must NOT reuse the shared client in
 * db/redis.ts (maxRetriesPerRequest: 3, NODE_ENV=test no-op).
 *
 * The runner is stateless — results arrive as the BullMQ job return value.
 * These handlers persist them; everything is idempotent (check upserts,
 * evidence (run_id, source_key), finalize-once), so both backend replicas
 * hearing the same QueueEvents completion is harmless (design §4).
 */

import { Job, Queue, QueueEvents } from 'bullmq';
import { Redis, type RedisOptions } from 'ioredis';
import type { QACheckResult, QAClickTestJob, QAClickTestResult } from '@adtraffic/shared';
import { logAuditEvent } from '../audit/audit-service.js';
import { logger } from '../lib/logger.js';
import { finalizeRunIfSettled, saveChecks, saveEvidence } from './qa-store.js';

export const QA_CLICK_QUEUE = 'qa-click-tests';
export const CLICK_JOB_ATTEMPTS = 3;
export const CLICK_JOB_BACKOFF_MS = 30_000;
/** The enqueue must never hang a chat/approve request (advisory guarantee). */
export const ENQUEUE_TIMEOUT_MS = 5_000;

function queueAvailable(): boolean {
  // DEMO_MODE runs the runner in-process (no Redis); tests never touch Redis.
  return process.env.DEMO_MODE !== 'true' && process.env.NODE_ENV !== 'test';
}

function newConnection(extra: RedisOptions = {}): Redis {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    ...extra,
  });
}

/** Bounded await — a down/absent Redis degrades to `false` (→ skipped checks),
 * it must never wedge the request that triggered QA. */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

let queue: Queue<QAClickTestJob, QAClickTestResult> | null = null;
let queueEvents: QueueEvents | null = null;

export function getQaQueue(): Queue<QAClickTestJob, QAClickTestResult> | null {
  if (!queueAvailable()) return null;
  queue ??= new Queue(QA_CLICK_QUEUE, {
    // enableOfflineQueue:false → commands REJECT immediately while disconnected
    // instead of buffering forever; with the withTimeout guard below this makes
    // enqueue fail fast when Redis is down or absent.
    connection: newConnection({ enableOfflineQueue: false }),
    defaultJobOptions: {
      attempts: CLICK_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: CLICK_JOB_BACKOFF_MS },
      // Keep completed jobs long enough for BOTH replicas to read returnvalue.
      removeOnComplete: { age: 3600, count: 500 },
      removeOnFail: { age: 24 * 3600, count: 500 },
    },
  });
  return queue;
}

/** Custom BullMQ job ids must not contain ':' (reserved in Redis keys). */
export function clickJobId(runId: string, adId: string): string {
  return `${runId}__ad-${adId}`;
}

export function parseClickJobId(jobId: string): { runId: string; adId: string } | null {
  const match = /^(.+)__ad-(.+)$/.exec(jobId);
  return match ? { runId: match[1]!, adId: match[2]! } : null;
}

/** Enqueue Layer 3 jobs; false when the queue is unavailable (caller degrades
 * to skipped). Bounded: enableOfflineQueue:false + withTimeout guarantee this
 * resolves within ~ENQUEUE_TIMEOUT_MS even with Redis down/absent. */
export async function enqueueClickTests(
  jobs: QAClickTestJob[],
  timeoutMs: number = ENQUEUE_TIMEOUT_MS,
): Promise<boolean> {
  const q = getQaQueue();
  if (!q) return false;
  try {
    await withTimeout(
      q.addBulk(jobs.map((data) => ({
        name: 'click-test',
        data,
        opts: { jobId: clickJobId(data.runId, data.adId) },
      }))),
      timeoutMs,
    );
    return true;
  } catch (err) {
    logger.warn({ err: { message: err instanceof Error ? err.message : 'Unknown' } }, 'QA click-test enqueue failed');
    return false;
  }
}

/** Persist a completed click test: evidence first (id feeds the check row), then
 * checks (upsert overwrites the queued placeholder), then finalize + audit. */
export async function handleClickTestResult(result: QAClickTestResult): Promise<void> {
  const checks: QACheckResult[] = [...result.checks];
  if (result.evidence) {
    try {
      const evidenceId = await saveEvidence(
        result.runId,
        `click:ad:${result.adId}`,
        result.evidence.contentType,
        Buffer.from(result.evidence.dataBase64, 'base64'),
      );
      const index = checks.findIndex((c) => c.checkKey === result.evidence!.forCheckKey);
      if (index >= 0) checks[index] = { ...checks[index]!, evidenceId };
    } catch (err) {
      logger.warn({ err: { message: err instanceof Error ? err.message : 'Unknown' }, runId: result.runId }, 'QA evidence persistence failed — continuing without screenshot');
    }
  }
  await saveChecks(result.runId, checks);
  await finalizeAndAudit(result.runId);
}

/** Exhausted BullMQ retries: record the last failure; the run errors (design §4). */
export async function handleClickTestFailure(runId: string, adId: string, reason: string): Promise<void> {
  await saveChecks(runId, [{
    checkKey: `clickthrough.click_test.ad:${adId}`,
    category: 'clickthrough',
    status: 'fail',
    message: `Click test could not run after ${CLICK_JOB_ATTEMPTS} attempts: ${reason}`,
    detail: { runnerFailure: true },
  }]);
  await finalizeAndAudit(runId);
}

async function finalizeAndAudit(runId: string): Promise<void> {
  const final = await finalizeRunIfSettled(runId);
  if (!final) return;
  void logAuditEvent({
    userId: final.userId,
    eventType: 'qa_run_completed',
    metadata: { runId, status: final.status, checkCount: final.checkCount, layer: 'clickthrough' },
  });
}

async function onCompletedEvent(jobId: string): Promise<void> {
  try {
    const q = getQaQueue();
    if (!q) return;
    // returnvalue via Job.fromId (the job hash), not the events-stream payload —
    // robust for multi-hundred-KB results with base64 evidence.
    const job = await Job.fromId(q, jobId);
    const raw: unknown = job?.returnvalue;
    const result = typeof raw === 'string' ? (JSON.parse(raw) as QAClickTestResult) : (raw as QAClickTestResult | undefined);
    if (result?.runId) await handleClickTestResult(result);
  } catch (err) {
    logger.warn({ err: { message: err instanceof Error ? err.message : 'Unknown' }, jobId }, 'QA click-test completion handling failed');
  }
}

async function onFailedEvent(jobId: string, reason: string): Promise<void> {
  const parsed = parseClickJobId(jobId);
  if (!parsed) return;
  try {
    await handleClickTestFailure(parsed.runId, parsed.adId, reason);
  } catch (err) {
    logger.warn({ err: { message: err instanceof Error ? err.message : 'Unknown' }, jobId }, 'QA click-test failure handling failed');
  }
}

/** Called once at backend startup (index.ts). No-op in DEMO_MODE/tests, and in
 * no-Redis deployments (supported config): without REDIS_URL the listener would
 * reconnect-loop to localhost:6379 forever. */
export function initQaQueueEvents(): void {
  if (!queueAvailable() || queueEvents) return;
  if (!process.env.REDIS_URL) {
    logger.info('REDIS_URL not set — QA click-test QueueEvents disabled');
    return;
  }
  queueEvents = new QueueEvents(QA_CLICK_QUEUE, { connection: newConnection() });
  queueEvents.on('completed', ({ jobId }) => { void onCompletedEvent(jobId); });
  // 'failed' fires only when retries are exhausted (attempts with retries left re-queue).
  queueEvents.on('failed', ({ jobId, failedReason }) => { void onFailedEvent(jobId, failedReason); });
  queueEvents.on('error', (err) => {
    logger.warn({ err: { message: err.message } }, 'QA QueueEvents connection error');
  });
  logger.info({ queue: QA_CLICK_QUEUE }, 'QA click-test QueueEvents listening');
}

export async function closeQaQueue(): Promise<void> {
  await queueEvents?.close().catch(() => undefined);
  await queue?.close().catch(() => undefined);
  queueEvents = null;
  queue = null;
}
