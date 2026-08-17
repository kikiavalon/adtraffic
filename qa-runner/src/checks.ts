/**
 * Trafficking QA — PURE check derivation from a traced click
 * (design checks A1–A5, B6–B8, and C9 param diff).
 *
 * Param parsing is manual because URLSearchParams mangles CM360 macros
 * (`%e…` is an invalid percent-escape) — same rationale as the shared
 * url-validator. Expected values containing CM360 macros match any
 * serve-time expansion (macro-aware comparison).
 */

import { findUnresolvedMacros } from '@adtraffic/shared';
import type { QACheckResult, QACheckStatus, QAChainTrace, QAClickTestJob } from '@adtraffic/shared';
import { HOP_CAP, HOP_WARN_THRESHOLD } from './chain-tracer.js';

const MACRO_TOKEN_SPLIT_RE = /%e[a-z]+!|%[ng](?![\w])/g;
const MACRO_TOKEN_TEST_RE = /%e[a-z]+!|%[ng](?![\w])/;

function make(
  checkKey: string,
  category: QACheckResult['category'],
  status: QACheckStatus,
  message: string,
  extra: { expected?: string; actual?: string; detail?: Record<string, unknown> } = {},
): QACheckResult {
  return {
    checkKey, category, status, message,
    ...(extra.expected !== undefined ? { expected: extra.expected } : {}),
    ...(extra.actual !== undefined ? { actual: extra.actual } : {}),
    ...(extra.detail !== undefined ? { detail: extra.detail } : {}),
  };
}

function hostPath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    return url;
  }
}

function isAllowedInsecure(url: string, hosts: readonly string[] | undefined): boolean {
  if (!hosts || hosts.length === 0) return false;
  try {
    return hosts.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

interface QueryPair { key: string; value: string; }

/** Manual query parsing — macro-safe (see module doc). */
function parseQueryPairs(url: string): QueryPair[] {
  const qIndex = url.indexOf('?');
  if (qIndex === -1) return [];
  const query = url.slice(qIndex + 1).split('#')[0]!;
  if (!query) return [];
  return query.split('&').filter(Boolean).map((pair) => {
    const eq = pair.indexOf('=');
    if (eq === -1) return { key: pair, value: '' };
    return { key: pair.slice(0, eq), value: pair.slice(eq + 1) };
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Expected values containing CM360 macros match any serve-time expansion. */
export function macroAwareEquals(expected: string, actual: string): boolean {
  if (!MACRO_TOKEN_TEST_RE.test(expected)) return expected === actual;
  const pattern = expected.split(MACRO_TOKEN_SPLIT_RE).map(escapeRegExp).join('[^&#]*');
  return new RegExp(`^${pattern}$`).test(actual);
}

export interface ParamDiff {
  missing: string[];
  unexpected: string[];
  mismatched: Array<{ key: string; expected: string; actual: string }>;
}

/** Check 9: query parameters on the final URL diffed against trafficked values. */
export function diffParams(expectedUrl: string, finalUrl: string): ParamDiff {
  const expected = parseQueryPairs(expectedUrl);
  const actual = parseQueryPairs(finalUrl);
  const actualByKey = new Map(actual.map((p) => [p.key.toLowerCase(), p.value]));
  const expectedKeys = new Set(expected.map((p) => p.key.toLowerCase()));
  const diff: ParamDiff = { missing: [], unexpected: [], mismatched: [] };
  for (const pair of expected) {
    const got = actualByKey.get(pair.key.toLowerCase());
    if (got === undefined) diff.missing.push(pair.key);
    else if (!macroAwareEquals(pair.value, got)) diff.mismatched.push({ key: pair.key, expected: pair.value, actual: got });
  }
  for (const pair of actual) {
    if (!expectedKeys.has(pair.key.toLowerCase())) diff.unexpected.push(pair.key);
  }
  return diff;
}

/** Derive the full check set for one simulated click (pure). */
export function deriveClickChecks(job: QAClickTestJob, trace: QAChainTrace): QACheckResult[] {
  const suffix = `ad:${job.adId}`;
  const checks: QACheckResult[] = [];
  const chainDetail: Record<string, unknown> = {
    chain: trace.hops,
    ...(trace.finalUrl ? { finalUrl: trace.finalUrl } : {}),
  };
  const failureNote = trace.errorMessage ? ` (${trace.errorMessage})` : '';

  // A1 — exactly one navigation (no double-fire, no dead click)
  if (trace.navigationCount === 1) {
    checks.push(make(`clickthrough.single_navigation.${suffix}`, 'clickthrough', 'pass',
      'Click opened exactly one navigation'));
  } else if (trace.navigationCount === 0) {
    checks.push(make(`clickthrough.single_navigation.${suffix}`, 'clickthrough', 'fail',
      `Dead click — the simulated click opened no navigation${failureNote}`));
  } else {
    checks.push(make(`clickthrough.single_navigation.${suffix}`, 'clickthrough', 'fail',
      `Click opened ${trace.navigationCount} navigations — double-fire`));
  }

  // A2 — first hop must be the CM360 click redirect
  const first = trace.hops[0];
  if (!first) {
    checks.push(make(`clickthrough.first_hop.${suffix}`, 'clickthrough', 'skipped',
      'No navigation to inspect'));
  } else if (new RegExp(job.expectedFirstHopPattern).test(first.url)) {
    checks.push(make(`clickthrough.first_hop.${suffix}`, 'clickthrough', 'pass',
      'First hop is the click-tracking redirect', { actual: first.url }));
  } else {
    checks.push(make(`clickthrough.first_hop.${suffix}`, 'clickthrough', 'fail',
      'First hop is not the CM360 click redirect — click tracking is broken',
      { expected: job.expectedFirstHopPattern, actual: first.url }));
  }

  // A3 — chain length: flag > 4 hops, fail > 20 (cap)
  const hopCount = trace.hops.length;
  if (trace.truncatedAtCap) {
    checks.push(make(`clickthrough.chain_length.${suffix}`, 'clickthrough', 'fail',
      `Redirect chain exceeded the ${HOP_CAP}-hop cap — likely a redirect loop`, { detail: chainDetail }));
  } else if (hopCount > HOP_WARN_THRESHOLD) {
    checks.push(make(`clickthrough.chain_length.${suffix}`, 'clickthrough', 'warn',
      `${hopCount} redirect hops (recommended maximum ${HOP_WARN_THRESHOLD}) — each hop adds latency and drop-off`,
      { detail: chainDetail }));
  } else if (hopCount > 0) {
    checks.push(make(`clickthrough.chain_length.${suffix}`, 'clickthrough', 'pass',
      `${hopCount} hop(s) to the landing page`, { detail: chainDetail }));
  }

  // A5 — no unresolved macros in the FINAL url
  if (trace.finalUrl) {
    const violations = findUnresolvedMacros(trace.finalUrl, { treatCm360MacrosAsUnresolved: true });
    if (violations.length > 0) {
      checks.push(make(`clickthrough.unresolved_macros.${suffix}`, 'clickthrough', 'fail',
        violations[0]!.message, { actual: trace.finalUrl }));
    } else {
      checks.push(make(`clickthrough.unresolved_macros.${suffix}`, 'clickthrough', 'pass',
        'No unresolved macro tokens in the final URL'));
    }
  }

  // A4 — final URL host + path matches the expected landing page
  if (job.expectedUrl && trace.finalUrl) {
    const expected = hostPath(job.expectedUrl);
    const actual = hostPath(trace.finalUrl);
    checks.push(expected === actual
      ? make(`clickthrough.final_url.${suffix}`, 'clickthrough', 'pass',
          'Landed on the expected page', { expected, actual })
      : make(`clickthrough.final_url.${suffix}`, 'clickthrough', 'fail',
          'Final URL does not match the expected landing page', { expected, actual }));
  } else if (job.expectedUrl) {
    checks.push(make(`clickthrough.final_url.${suffix}`, 'clickthrough', 'skipped',
      `Never reached a final URL${failureNote}`, { expected: hostPath(job.expectedUrl) }));
  }

  // B6 — final page HTTP status
  if (trace.landed && trace.finalStatus !== undefined && trace.finalStatus >= 200 && trace.finalStatus < 300) {
    checks.push(make(`landing.http_status.${suffix}`, 'landing', 'pass',
      `Landing page returned HTTP ${trace.finalStatus}`));
  } else if (trace.finalStatus !== undefined && trace.finalStatus >= 400) {
    checks.push(make(`landing.http_status.${suffix}`, 'landing', 'fail',
      `Landing page returned HTTP ${trace.finalStatus}`, { expected: '200', actual: String(trace.finalStatus) }));
  } else {
    checks.push(make(`landing.http_status.${suffix}`, 'landing', 'fail',
      `Landing page never loaded${failureNote}`));
  }

  // B7 — HTTPS on every hop (valid certs: a cert error kills navigation and lands here too)
  const insecure = trace.hops.filter((h) => !h.https && !isAllowedInsecure(h.url, job.allowInsecureHosts));
  const certError = trace.errorMessage?.includes('ERR_CERT') ?? false;
  if (certError) {
    checks.push(make(`landing.https.${suffix}`, 'landing', 'fail',
      `TLS certificate error in the chain: ${trace.errorMessage}`));
  } else if (insecure.length > 0) {
    checks.push(make(`landing.https.${suffix}`, 'landing', 'fail',
      `${insecure.length} hop(s) are not HTTPS`, { actual: insecure.map((h) => h.url).join(' → ') }));
  } else if (trace.hops.length > 0) {
    const exempted = trace.hops.some((h) => !h.https);
    checks.push(make(`landing.https.${suffix}`, 'landing', 'pass',
      exempted ? 'Chain is HTTPS (localhost demo fixtures exempt)' : 'Every hop is HTTPS with a valid certificate'));
  }

  // B8 — page renders (not blank); the click-test evidence screenshot attaches here
  if (trace.landed && (trace.finalBodyTextLength ?? 0) > 0) {
    checks.push(make(`landing.renders.${suffix}`, 'landing', 'pass',
      `Page rendered ${trace.finalBodyTextLength} chars of text${trace.loadMs !== undefined ? ` in ${trace.loadMs} ms` : ''}`));
  } else if (trace.landed) {
    checks.push(make(`landing.renders.${suffix}`, 'landing', 'fail',
      'Landing page rendered blank (no visible text)'));
  } else {
    checks.push(make(`landing.renders.${suffix}`, 'landing', 'fail',
      `Landing page never rendered${failureNote}`));
  }

  // C9 — query params on the final URL diffed against the trafficked values
  if (job.expectedUrl && trace.finalUrl) {
    const diff = diffParams(job.expectedUrl, trace.finalUrl);
    const broken = diff.missing.length > 0 || diff.mismatched.length > 0;
    if (broken) {
      const parts = [
        ...(diff.missing.length ? [`missing: ${diff.missing.join(', ')}`] : []),
        ...(diff.mismatched.length ? [`mismatched: ${diff.mismatched.map((m) => m.key).join(', ')}`] : []),
      ];
      checks.push(make(`tracking.param_diff.${suffix}`, 'tracking', 'fail',
        `Final-URL parameters do not match the trafficked values (${parts.join('; ')})`,
        { detail: { paramDiff: diff } }));
    } else if (diff.unexpected.length > 0) {
      checks.push(make(`tracking.param_diff.${suffix}`, 'tracking', 'warn',
        `Unexpected extra parameters on the final URL: ${diff.unexpected.join(', ')}`,
        { detail: { paramDiff: diff } }));
    } else {
      checks.push(make(`tracking.param_diff.${suffix}`, 'tracking', 'pass',
        'Final-URL parameters match the trafficked values'));
    }
  }

  // Summary — worst of the sub-checks; overwrites the live-mode queued placeholder
  const worst: QACheckStatus = checks.some((c) => c.status === 'fail') ? 'fail'
    : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
  const destination = trace.finalUrl ? ` → ${hostPath(trace.finalUrl)}` : '';
  checks.push(make(`clickthrough.click_test.${suffix}`, 'clickthrough', worst,
    trace.errorMessage
      ? `Click test failed: ${trace.errorMessage}`
      : `Click test: ${hopCount} hop(s)${destination}`,
    { detail: chainDetail }));
  return checks;
}
