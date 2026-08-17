/**
 * Trafficking QA runner — BullMQ Worker transport (live mode, compose profile "qa").
 *
 * Consumes 'qa-click-tests'; each job launches its own Chromium (crash isolation).
 * Retry/backoff policy lives on the jobs (backend enqueue: attempts 3,
 * exponential 30 s base); the 90 s timeout is enforced inside runClickTest.
 * BullMQ requires a dedicated connection with maxRetriesPerRequest: null.
 */

import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import type { QAClickTestJob, QAClickTestResult } from '@adtraffic/shared';
import { runClickTest } from './click-test.js';

const logger = pino({ name: 'adtraffic-qa-runner' });
const QUEUE_NAME = 'qa-click-tests';

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker<QAClickTestJob, QAClickTestResult>(
  QUEUE_NAME,
  async (job) => {
    logger.info({ jobId: job.id, adId: job.data.adId, runId: job.data.runId }, 'click test start');
    return runClickTest(job.data);
  },
  { connection, concurrency: 1, lockDuration: 120_000 },
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'click test completed');
});
worker.on('failed', (job, err) => {
  logger.warn({ jobId: job?.id, err: { message: err.message }, attemptsMade: job?.attemptsMade }, 'click test attempt failed');
});

async function shutdown(): Promise<void> {
  logger.info('shutting down');
  await worker.close();
  await connection.quit().catch(() => undefined);
  process.exit(0);
}
process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT', () => { void shutdown(); });

logger.info({ queue: QUEUE_NAME }, 'qa-runner worker started');
