/**
 * Trafficking QA — PURE redirect-chain classification (design check A3).
 *
 * The Playwright adapter (click-test.ts) records raw main-frame document
 * events; everything here is deterministic string/array work so the chain
 * logic is unit-testable without a browser. Design thresholds: flag > 4 hops,
 * fail > 20 (the adapter also stops navigating at the cap).
 */

import type { QAChainTrace, QARedirectHop } from '@adtraffic/shared';

export const HOP_WARN_THRESHOLD = 4;
export const HOP_CAP = 20;

/** Raw main-frame document event recorded by the browser adapter (or a test fake). */
export interface RawNavigationEvent {
  url: string;
  status?: number;
  /** Location header when status is 3xx. */
  redirectLocation?: string;
  /** Document HTML for non-3xx responses — used to classify meta-refresh hops. */
  documentHtml?: string;
  startedAt?: number;
  endedAt?: number;
}

const META_REFRESH_TAG_RE = /<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*>/i;
const META_CONTENT_URL_RE = /content\s*=\s*["']?\s*\d+\s*;\s*url\s*=\s*([^"'>\s]+)/i;

/** Parse the target of a <meta http-equiv="refresh"> tag; null when absent/unparsable. */
export function parseMetaRefreshUrl(html: string, baseUrl: string): string | null {
  const tag = html.match(META_REFRESH_TAG_RE)?.[0];
  if (!tag) return null;
  const target = tag.match(META_CONTENT_URL_RE)?.[1];
  if (!target) return null;
  try {
    return new URL(target, baseUrl).toString();
  } catch {
    return null;
  }
}

function urlsMatch(a: string | null, b: string): boolean {
  if (!a) return false;
  try {
    return new URL(a).toString() === new URL(b).toString();
  } catch {
    return a === b;
  }
}

/** Classify recorded events into a typed hop chain (pure — no browser). */
export function classifyHops(events: RawNavigationEvent[]): QARedirectHop[] {
  return events.map((event, i) => {
    let via: QARedirectHop['via'] = 'js';
    if (i === 0) {
      via = 'click';
    } else {
      const prev = events[i - 1]!;
      if (prev.status !== undefined && prev.status >= 300 && prev.status < 400) {
        // The browser followed the Location header to get here.
        via = 'http_3xx';
      } else if (
        prev.documentHtml &&
        urlsMatch(parseMetaRefreshUrl(prev.documentHtml, prev.url), event.url)
      ) {
        via = 'meta_refresh';
      }
    }
    return {
      url: event.url,
      ...(event.status !== undefined ? { status: event.status } : {}),
      via,
      https: event.url.startsWith('https://'),
      ...(event.startedAt !== undefined && event.endedAt !== undefined
        ? { latencyMs: event.endedAt - event.startedAt }
        : {}),
    };
  });
}

export interface BuildChainTraceInput {
  events: RawNavigationEvent[];
  navigationCount: number;
  landed: boolean;
  finalBodyTextLength?: number;
  loadMs?: number;
  errorMessage?: string;
}

/** Assemble the full trace the check-derivation consumes (pure).
 * Chromium aborts long server-redirect chains internally with
 * ERR_TOO_MANY_REDIRECTS (often before our own 20-hop cap records that many
 * events) — treat that as hitting the cap so chain_length fails deterministically. */
export function buildChainTrace(input: BuildChainTraceInput): QAChainTrace {
  const hops = classifyHops(input.events);
  const last = input.events[input.events.length - 1];
  return {
    hops,
    ...(last ? { finalUrl: last.url } : {}),
    navigationCount: input.navigationCount,
    truncatedAtCap:
      input.events.length >= HOP_CAP ||
      (input.errorMessage?.includes('ERR_TOO_MANY_REDIRECTS') ?? false),
    landed: input.landed,
    ...(last?.status !== undefined ? { finalStatus: last.status } : {}),
    ...(input.finalBodyTextLength !== undefined ? { finalBodyTextLength: input.finalBodyTextLength } : {}),
    ...(input.loadMs !== undefined ? { loadMs: input.loadMs } : {}),
    ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
  };
}
