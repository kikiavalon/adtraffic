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
