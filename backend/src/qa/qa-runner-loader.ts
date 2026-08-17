/**
 * Trafficking QA — dynamic loader for the runner-core library (DEMO/dev only).
 *
 * The specifier is a runtime variable ON PURPOSE: backend has NO dependency on
 * @adtraffic/qa-runner (the backend Docker image stays browser-free — design §4).
 * In the npm-workspace dev tree the hoisted symlink resolves at runtime; in
 * production non-demo the loader is never called; anywhere the package or
 * Playwright is missing, callers degrade to skipped-with-install-hint.
 * Isolated in its own module so tests can vi.mock it.
 */

import type { QAClickTestJob, QAClickTestResult } from '@adtraffic/shared';

export type RunClickTestFn = (job: QAClickTestJob) => Promise<QAClickTestResult>;

export async function loadClickTestRunner(): Promise<RunClickTestFn | null> {
  try {
    const specifier = '@adtraffic/qa-runner';
    const mod = (await import(specifier)) as { runClickTest?: RunClickTestFn };
    return mod.runClickTest ?? null;
  } catch {
    return null;
  }
}
