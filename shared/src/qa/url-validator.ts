/**
 * Trafficking QA — pure string-level URL and UTM (Urchin Tracking Module) rules.
 *
 * Executable transcription of the verified utm-expert rule set
 * (.agents/skills/utm-expert/SKILL.md, verified against Google docs 2026-08-15).
 * Design-doc checks covered: 5 (unresolved macros), 10 (required UTMs),
 * 11 (convention), 12 (macro table), 14 (GA4 partial tagging).
 *
 * Pure and dependency-free: takes URLs in, returns violations. No entity reads.
 * Returns [] when a URL is clean — callers synthesize the `pass` check.
 */

import type { QACheckResult } from '../types/qa.js';

/** Verified CM360 macro table — case-sensitive, must be lowercase. There is NO timestamp macro. */
export const VALID_CM360_MACROS: readonly string[] = [
  '%ebuy!', // Campaign ID
  '%epid!', // Placement ID
  '%eaid!', // Ad ID
  '%ecid!', // Creative ID
  '%eadv!', // Advertiser ID
  '%esid!', // Site ID of the placement
  '%n',     // Random number (cache buster)
  '%g',     // Geo key-values
];

const GA4_REQUIRED_UTMS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;

export interface ValidateUrlOptions {
  /** Params that must be present and non-empty (check 10). Check 14 fires regardless. */
  requiredParams?: readonly string[];
  /** Appended to every check key so multiple URLs in one run satisfy UNIQUE(run_id, check_key), e.g. 'ad:2001'. */
  keySuffix?: string;
}

interface QueryParam { key: string; rawValue: string; }

/** Manual query parsing — URLSearchParams mangles CM360 macros (`%e…` is an invalid percent-escape). */
function parseQueryParams(url: string): QueryParam[] {
  const qIndex = url.indexOf('?');
  if (qIndex === -1) return [];
  const query = url.slice(qIndex + 1).split('#')[0]!;
  if (!query) return [];
  return query.split('&').filter(Boolean).map((pair) => {
    const eq = pair.indexOf('=');
    if (eq === -1) return { key: pair, rawValue: '' };
    return { key: pair.slice(0, eq), rawValue: pair.slice(eq + 1) };
  });
}

function tracking(
  key: string,
  status: QACheckResult['status'],
  message: string,
  keySuffix?: string,
  expected?: string,
  actual?: string,
): QACheckResult {
  return {
    checkKey: keySuffix ? `${key}.${keySuffix}` : key,
    category: 'tracking',
    status,
    message,
    ...(expected !== undefined ? { expected } : {}),
    ...(actual !== undefined ? { actual } : {}),
  };
}

/** Strip macro-shaped tokens before value-level casing checks (macro casing has its own check). */
function stripMacroTokens(value: string): string {
  return value.replace(/%e[a-z]+!/gi, '').replace(/%[ng](?![\w])/g, '');
}

/**
 * Checks 10, 11, 12, 14 on a configured/expected click-through URL.
 * CM360 macros are legitimate here — they expand at serve time.
 */
export function validateConfiguredUrl(url: string, options: ValidateUrlOptions = {}): QACheckResult[] {
  const { requiredParams, keySuffix } = options;
  const violations: QACheckResult[] = [];

  // Check 11: https:// present
  if (!url.startsWith('https://')) {
    violations.push(tracking('url.not_https', 'fail',
      'Click-through URL must use https://', keySuffix, 'https://…', url.slice(0, 40)));
  }

  // Check 11: no duplicate '?'
  const questionMarks = url.split('?').length - 1;
  if (questionMarks > 1) {
    violations.push(tracking('url.duplicate_query', 'fail',
      `URL contains ${questionMarks} '?' characters — query strings were joined incorrectly (CM360 auto-inserts the ?/& joiner for suffixes)`, keySuffix));
  }

  // Check 12: every %e…! macro must be in the verified table, lowercase
  const macroMatches = url.match(/%e[a-z]+!/gi) ?? [];
  for (const macro of new Set(macroMatches)) {
    const lower = macro.toLowerCase();
    if (!VALID_CM360_MACROS.includes(lower)) {
      violations.push(tracking('macro.unknown', 'fail',
        `Unknown CM360 macro ${macro} — not in the verified macro table (there is no timestamp macro; do not invent macros)`,
        keySuffix, VALID_CM360_MACROS.join(' '), macro));
    } else if (macro !== lower) {
      violations.push(tracking('macro.case', 'fail',
        `CM360 macros are case-sensitive lowercase — ${macro} will not expand`, keySuffix, lower, macro));
    }
  }

  const params = parseQueryParams(url);
  const lowerKeys = new Set(params.map((p) => p.key.toLowerCase()));
  const utmParams = params.filter((p) => p.key.toLowerCase().startsWith('utm_'));

  // Check 10: required params present and non-empty
  if (requiredParams) {
    for (const required of requiredParams) {
      const found = params.find((p) => p.key.toLowerCase() === required.toLowerCase());
      if (!found || found.rawValue === '') {
        violations.push(tracking(`utm.required_missing.${required.toLowerCase()}`, 'fail',
          `Required tracking parameter ${required} is missing or empty`, keySuffix, required));
      }
    }
  }

  // Check 14: GA4 partial-tagging rule — if ANY UTM is present, source/medium/campaign must all be present
  if (utmParams.length > 0) {
    const missing = GA4_REQUIRED_UTMS.filter((r) => !lowerKeys.has(r));
    if (missing.length > 0) {
      violations.push(tracking('utm.partial_tagging', 'fail',
        `Partial UTM tagging breaks GA4 attribution — ${missing.join(', ')} missing while other UTM parameters are present (GA4 derives ALL traffic-source dimensions from UTMs if any one is present)`,
        keySuffix, GA4_REQUIRED_UTMS.join(', ')));
    }
  }

  // Check 11: lowercase values, no spaces
  for (const p of utmParams) {
    const lowerKey = p.key.toLowerCase();
    if (/[A-Z]/.test(stripMacroTokens(p.rawValue))) {
      violations.push(tracking(`utm.case.${lowerKey}`, 'warn',
        `UTM values should be lowercase: ${p.key}=${p.rawValue}`, keySuffix, p.rawValue.toLowerCase(), p.rawValue));
    }
    if (/[ ]|%20/.test(p.rawValue)) {
      violations.push(tracking(`utm.spaces.${lowerKey}`, 'fail',
        `UTM value contains spaces: ${p.key}=${p.rawValue} — use hyphens`, keySuffix));
    }
  }

  return violations;
}

/**
 * Check 5: unresolved macro tokens.
 * Phase 1 runs this on configured URLs, where CM360 macros are legitimate —
 * it flags third-party template tokens CM360 will NOT expand (%%MACRO%%, ${CLICK_URL}).
 * Phase 2 passes treatCm360MacrosAsUnresolved: true for browser-observed FINAL URLs.
 */
export function findUnresolvedMacros(
  url: string,
  options: { treatCm360MacrosAsUnresolved?: boolean; keySuffix?: string } = {},
): QACheckResult[] {
  const found = new Set<string>();
  for (const pattern of [/%%[A-Za-z0-9_]+%%/g, /\$\{[^}]+\}/g]) {
    for (const match of url.match(pattern) ?? []) found.add(match);
  }
  if (options.treatCm360MacrosAsUnresolved) {
    for (const match of url.match(/%e[a-z]+!/gi) ?? []) found.add(match);
    for (const match of url.match(/%[ng](?![\w])/g) ?? []) found.add(match);
  }
  if (found.size === 0) return [];
  const tokens = [...found].join(', ');
  return [tracking('macro.unresolved', 'fail',
    `Unresolved macro tokens in URL: ${tokens}`, options.keySuffix, undefined, tokens)];
}

/**
 * Check 11 (cross-URL half): consistent utm_source across a campaign —
 * never mix dcm/dfa/cm360 (or any two values) within one account.
 */
export function validateSourceConsistency(urls: Array<{ url: string; label: string }>): QACheckResult[] {
  const sources = new Map<string, string[]>();
  for (const { url, label } of urls) {
    const param = parseQueryParams(url).find((p) => p.key.toLowerCase() === 'utm_source');
    if (param && param.rawValue !== '') {
      const labels = sources.get(param.rawValue) ?? [];
      labels.push(label);
      sources.set(param.rawValue, labels);
    }
  }
  if (sources.size <= 1) return [];
  const detail = [...sources.entries()].map(([value, labels]) => `${value} (${labels.join(', ')})`).join(' vs ');
  return [tracking('utm.source_mixed', 'fail',
    `Inconsistent utm_source across the campaign: ${detail} — pick one value and never mix`, undefined, undefined, detail)];
}
