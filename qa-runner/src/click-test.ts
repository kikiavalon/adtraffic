/**
 * Trafficking QA — Playwright adapter (the impure half of runner-core).
 *
 * Renders the harness, clicks, records main-frame document events (redirect
 * responses included), lets the browser follow 3xx/meta-refresh/JS redirects
 * naturally, and hands the recorded events to the pure chain-tracer/checks.
 *
 * Chromium is launched per call so a crash poisons only this job (design §4).
 * The 90 s per-job timeout is enforced HERE — BullMQ v5/v6 has no job-level
 * timeout option; on breach we throw so the attempt fails and retries.
 */

import { chromium, type Page, type Response } from 'playwright';
import type { QAClickTestJob, QAClickTestResult } from '@adtraffic/shared';
import { buildChainTrace, HOP_CAP, type RawNavigationEvent } from './chain-tracer.js';
import { deriveClickChecks } from './checks.js';
import { buildHarnessHtml } from './harness.js';
import { assertEgressAllowed } from './egress-guard.js';

export interface RunClickTestOptions {
  timeoutMs?: number;
  /** Chain considered settled after this long with no new document event. */
  settleMs?: number;
}

const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_SETTLE_MS = 2_500;

export class ClickTestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Click test exceeded the ${timeoutMs} ms per-job timeout`);
    this.name = 'ClickTestTimeoutError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runClickTest(
  job: QAClickTestJob,
  options: RunClickTestOptions = {},
): Promise<QAClickTestResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const settleMs = options.settleMs ?? DEFAULT_SETTLE_MS;
  const deadline = Date.now() + timeoutMs;
  const browser = await chromium.launch({
    headless: true,
    // Containers set QA_RUNNER_NO_SANDBOX=true (see qa-runner/Dockerfile notes);
    // everywhere else the Chromium sandbox stays ON — landing pages are untrusted.
    chromiumSandbox: process.env.QA_RUNNER_NO_SANDBOX !== 'true',
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    context.setDefaultTimeout(Math.min(30_000, timeoutMs));

    // Buffer served HTML so meta-refresh classification survives instant (0 s)
    // refreshes — Chromium frees a redirected-away document's body before a
    // post-hoc response.text() can read it. maxRedirects:0 keeps each 3xx hop
    // visible to the browser so the redirect chain is preserved.
    const htmlBodies = new Map<string, string>();
    const allowHosts = job.allowInsecureHosts ?? [];
    await context.route('**/*', async (route) => {
      // Guard every hop (initial nav, 3xx/meta/JS redirects, subresources): a
      // user-controlled click-through must never be fetched if it resolves to a
      // loopback/link-local/private/metadata address. Local fixtures opt in via
      // allowInsecureHosts.
      try {
        await assertEgressAllowed(route.request().url(), allowHosts);
      } catch {
        await route.abort('addressunreachable').catch(() => undefined);
        return;
      }
      try {
        const fetched = await route.fetch({ maxRedirects: 0 });
        const contentType = fetched.headers()['content-type'] ?? '';
        if (contentType.includes('text/html')) {
          const body = await fetched.text().catch(() => undefined);
          if (body !== undefined) htmlBodies.set(route.request().url(), body);
        }
        await route.fulfill({ response: fetched });
      } catch {
        await route.continue().catch(() => undefined);
      }
    });

    const events: RawNavigationEvent[] = [];
    const requestStarts = new Map<string, number>();
    let lastEventAt = 0;
    let errorMessage: string | undefined;
    let popupCount = 0;
    let mainNavigated = false;

    const record = async (page: Page, response: Response): Promise<void> => {
      const request = response.request();
      if (!request.isNavigationRequest() || request.frame() !== page.mainFrame()) return;
      const status = response.status();
      const event: RawNavigationEvent = {
        url: response.url(),
        status,
        ...(requestStarts.has(response.url()) ? { startedAt: requestStarts.get(response.url())! } : {}),
        endedAt: Date.now(),
      };
      if (status >= 300 && status < 400) {
        const headers = await response.allHeaders().catch(() => ({} as Record<string, string>));
        if (headers['location']) event.redirectLocation = headers['location'];
      } else {
        const body = htmlBodies.get(response.url());
        if (body !== undefined) event.documentHtml = body.slice(0, 100_000);
      }
      events.push(event);
      lastEventAt = Date.now();
    };

    // Serialize the async recorder — concurrent record() calls on a fast
    // 302→302→200 chain could otherwise push events out of order.
    let recordChain: Promise<void> = Promise.resolve();
    const attach = (page: Page): void => {
      page.on('request', (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
          mainNavigated = true;
          requestStarts.set(request.url(), Date.now());
        }
      });
      page.on('response', (response) => {
        recordChain = recordChain.then(() => record(page, response)).catch(() => undefined);
      });
      page.on('requestfailed', (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
          errorMessage = request.failure()?.errorText ?? 'navigation failed';
          lastEventAt = Date.now();
        }
      });
    };

    let activePage = await context.newPage();
    attach(activePage);
    context.on('page', (popup) => {
      popupCount += 1;
      activePage = popup;
      attach(popup);
    });

    await activePage.setContent(buildHarnessHtml(job), { waitUntil: 'domcontentloaded' });
    mainNavigated = false; // setContent is not a click-initiated navigation
    const clickAt = Date.now();
    await activePage.click('#qa-click', { noWaitAfter: true });

    // Settle loop: done when no new document event for settleMs
    // (dead click: nothing within 2×settleMs); bounded by hop cap + deadline.
    for (;;) {
      await sleep(200);
      const now = Date.now();
      if (now >= deadline) throw new ClickTestTimeoutError(timeoutMs);
      if (events.length >= HOP_CAP || errorMessage) break;
      if (events.length === 0) {
        if (now - clickAt > 2 * settleMs) break;
        continue;
      }
      if (now - lastEventAt > settleMs) break;
    }
    await recordChain; // flush the serialized recorder before reading events

    const last = events[events.length - 1];
    const landed = last !== undefined && last.status !== undefined && last.status < 300 && !errorMessage;
    let finalBodyTextLength: number | undefined;
    if (landed) {
      finalBodyTextLength = await activePage
        .evaluate(() => document.body?.innerText.trim().length ?? 0)
        .catch(() => undefined);
    }

    const trace = buildChainTrace({
      events,
      navigationCount: popupCount + (mainNavigated ? 1 : 0),
      landed,
      ...(finalBodyTextLength !== undefined ? { finalBodyTextLength } : {}),
      ...(last?.endedAt !== undefined ? { loadMs: last.endedAt - clickAt } : {}),
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    });
    const checks = deriveClickChecks(job, trace);
    const screenshot = await activePage.screenshot({ type: 'png' }).catch(() => null);
    return {
      runId: job.runId,
      adId: job.adId,
      checks,
      ...(screenshot
        ? {
            evidence: {
              contentType: 'image/png',
              dataBase64: screenshot.toString('base64'),
              forCheckKey: `landing.renders.ad:${job.adId}`,
            },
          }
        : {}),
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
