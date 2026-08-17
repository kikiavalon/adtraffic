/**
 * Trafficking QA — shared report types (Phase 1: config + tracking checks only).
 *
 * The category enum ships all four design-doc categories so the schema does not
 * churn in Phase 2; `clickthrough` and `landing` checks require the headless
 * browser runner and are not produced in Phase 1.
 */

export type QACheckStatus = 'pass' | 'warn' | 'fail' | 'skipped';

export type QACheckCategory = 'clickthrough' | 'landing' | 'tracking' | 'config';

export interface QACheckResult {
  /** Unique within a run (UNIQUE(run_id, check_key)) — entity-scoped keys like `config.click_through.ad:2001` */
  checkKey: string;
  category: QACheckCategory;
  status: QACheckStatus;
  /** Human-readable finding, safe to render in chat */
  message: string;
  expected?: string;
  actual?: string;
  /** Structured extras rendered by the webapp and stored in qa_checks.detail
   * alongside message: { chain?, paramDiff?, queued?, runnerFailure? } */
  detail?: Record<string, unknown>;
  /** qa_evidence row backing this check (click-test screenshot) — served by
   * GET /api/v1/qa/runs/:runId/evidence/:evidenceId */
  evidenceId?: string;
}

export type QARunStatus = 'pending' | 'running' | 'passed' | 'warned' | 'failed' | 'error';

export type QARunTrigger = 'auto' | 'manual' | 'approval';

/** One entity touched by the turn's writes — Phase 2's browser runner clicks these. */
export interface QATouchedEntity {
  toolName: string;
  entityType: 'ad' | 'campaign' | 'placement' | 'landing_page' | 'creative' | 'other';
  entityId?: string;
}

export interface QARunReport {
  runId: string;
  status: QARunStatus;
  trigger: QARunTrigger;
  /** Hard-coded true: QA is advisory and never blocks approvals. */
  advisory: true;
  campaignId?: string;
  advertiserId?: string;
  conversationId?: string;
  touched: QATouchedEntity[];
  checks: QACheckResult[];
  startedAt: number;
  completedAt?: number;
}

// ── Phase 2: headless click-test types ──────────────────────────────────────

/** One hop in a traced redirect chain (design check A3). */
export interface QARedirectHop {
  url: string;
  /** HTTP status for this document response (undefined when navigation failed before a response). */
  status?: number;
  /** How the browser arrived at this hop. */
  via: 'click' | 'http_3xx' | 'meta_refresh' | 'js';
  https: boolean;
  latencyMs?: number;
}

/** Everything the pure check-derivation needs about one simulated click. */
export interface QAChainTrace {
  hops: QARedirectHop[];
  finalUrl?: string;
  /** Top-level navigations the click produced (check A1 — must be exactly 1). */
  navigationCount: number;
  /** True when tracing stopped at the 20-hop cap. */
  truncatedAtCap: boolean;
  /** True when a final document finished loading (status < 300, no navigation error). */
  landed: boolean;
  finalStatus?: number;
  /** Rendered text length of the final document (check B8 blank-page heuristic). */
  finalBodyTextLength?: number;
  /** ms from click to the final document response. */
  loadMs?: number;
  /** Navigation-level failure (DNS, TLS/cert, timeout) — checks fail with this reason. */
  errorMessage?: string;
}

/** BullMQ job payload / in-process invocation input. Stateless: everything the
 * runner needs rides in the job — it never reads entities or the database. */
export interface QAClickTestJob {
  runId: string;
  adId: string;
  advertiserId?: string;
  /** Exact URL the simulated click navigates: the exported clickTag URL (live)
   * or the demo click fixture (DEMO_MODE). */
  clickUrl: string;
  /** Optional placement tag HTML rendered in the harness before the click
   * (impression fire + render evidence; the click itself uses clickUrl). */
  tagHtml?: string;
  /** Expected final URL from the Phase 1 click-resolver (may contain CM360 macros). */
  expectedUrl?: string;
  /** Regex source the FIRST hop must match (check A2) —
   * live: '^https://ad\\.doubleclick\\.net/ddm/trackclk/'. */
  expectedFirstHopPattern: string;
  /** Hostnames exempt from HTTPS checks (demo fixtures on localhost). */
  allowInsecureHosts?: string[];
}

export interface QAClickTestEvidence {
  contentType: string;
  dataBase64: string;
  /** checkKey the evidence attaches to (e.g. `landing.renders.ad:2001`). */
  forCheckKey: string;
}

/** BullMQ job return value / in-process invocation result. */
export interface QAClickTestResult {
  runId: string;
  adId: string;
  checks: QACheckResult[];
  evidence?: QAClickTestEvidence;
}
