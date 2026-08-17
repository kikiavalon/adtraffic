/**
 * Trafficking QA — run lifecycle (design §4 qa-service, Phase 1 slice).
 *
 * Advisory only: results never block approvals. Strictly read-only: all data
 * access goes through qaRead. Triggered at the end of each request that
 * executed writes (chat turn or confirmation approve).
 */

import { logAuditEvent } from '../audit/audit-service.js';
import { logger } from '../lib/logger.js';
import type { ResolvedFlags } from '../feature-flags/flag-registry.js';
import type { QACheckResult, QARunReport, QARunTrigger, QATouchedEntity } from '@adtraffic/shared';
import { validateConfiguredUrl, findUnresolvedMacros, validateSourceConsistency } from '@adtraffic/shared';
import { drainQaWrites, type RecordedWrite } from './qa-recorder.js';
import { qaRead } from './qa-read.js';
import { assessAd, fetchCampaignContext, type CampaignContext } from './click-resolver.js';
import { cleanupExpiredRuns, completeRun, createRun, runToReport, saveChecks } from './qa-store.js';

const DEFAULT_RETENTION_DAYS = 30;

const WRITE_ENTITY_TYPES: Record<string, QATouchedEntity['entityType']> = {
  cm360_create_ad: 'ad', cm360_update_ad: 'ad',
  cm360_create_campaign: 'campaign', cm360_update_campaign: 'campaign',
  cm360_create_placement: 'placement', cm360_update_placement: 'placement',
  cm360_create_landing_page: 'landing_page', cm360_update_landing_page: 'landing_page',
  cm360_create_creative: 'creative', cm360_update_creative: 'creative',
};

const ENTITY_ID_INPUT_FIELDS = ['adId', 'campaignId', 'placementId', 'landingPageId', 'creativeId'] as const;

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function rec(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function toTouched(write: RecordedWrite): QATouchedEntity {
  const entityType = WRITE_ENTITY_TYPES[write.toolName] ?? 'other';
  const entityId =
    str(rec(write.result)?.id) ??
    ENTITY_ID_INPUT_FIELDS.map((f) => str(write.toolInput[f])).find(Boolean);
  return { toolName: write.toolName, entityType, ...(entityId ? { entityId } : {}) };
}

interface RunScope {
  profileId: string;
  campaignId?: string;
  advertiserId?: string;
  touched: QATouchedEntity[];
}

async function resolveScope(
  writes: RecordedWrite[],
  userId: string,
  conversationId: string,
): Promise<RunScope> {
  const touched = writes.map(toTouched);
  const profileId = writes.map((w) => str(w.toolInput.profileId)).find(Boolean) ?? 'qa';
  let campaignId: string | undefined;
  let advertiserId: string | undefined;
  for (const write of writes) {
    campaignId ??= str(write.toolInput.campaignId) ?? str(rec(write.result)?.campaignId);
    advertiserId ??= str(write.toolInput.advertiserId) ?? str(rec(write.result)?.advertiserId);
  }
  if (!campaignId) {
    // Update tools carry only the entity id — one allowlisted read resolves the campaign
    for (const write of writes) {
      const adId = str(write.toolInput.adId);
      const placementId = str(write.toolInput.placementId);
      if (adId) {
        const res = await qaRead('cm360_get_ad', { profileId, adId }, userId, conversationId);
        if (!res.isError) campaignId = str(rec(res.result)?.campaignId);
      } else if (placementId) {
        const res = await qaRead('cm360_get_placement', { profileId, placementId }, userId, conversationId);
        if (!res.isError) campaignId = str(rec(res.result)?.campaignId);
      }
      if (campaignId) break;
    }
  }
  return { profileId, ...(campaignId ? { campaignId } : {}), ...(advertiserId ? { advertiserId } : {}), touched };
}

/**
 * Campaign-wide read-only quick sweep (design §4 scope tier 2 — Layers 1+2, no browser):
 * every ad resolves a click-through, every ad has an active creative assignment,
 * every placement has an ad, date windows sane, UTM convention consistent.
 * In Phase 1 the touched-entity "full stack" and the sweep coincide — the
 * browser layer that distinguishes them is Phase 2.
 */
export function sweepCampaign(ctx: CampaignContext): QACheckResult[] {
  const checks: QACheckResult[] = [];
  const { campaign, advertiser, ads, placements, landingPages, creatives } = ctx;

  // Campaign date sanity
  if (campaign.startDate > campaign.endDate) {
    checks.push({
      checkKey: 'config.campaign_dates', category: 'config', status: 'fail',
      message: `Campaign start ${campaign.startDate} is after end ${campaign.endDate}`,
    });
  } else {
    checks.push({
      checkKey: 'config.campaign_dates', category: 'config', status: 'pass',
      message: `Campaign flight ${campaign.startDate} → ${campaign.endDate}`,
    });
  }

  // Per-ad full Layer-1/2 assessment
  const resolvedUrls: Array<{ url: string; label: string }> = [];
  for (const ad of ads) {
    if (ad.archived) continue;
    const assessment = assessAd({ ad, campaign, ...(advertiser ? { advertiser } : {}), landingPages, creatives });
    checks.push(...assessment.checks);
    if (assessment.expectedUrl) resolvedUrls.push({ url: assessment.expectedUrl, label: `ad:${ad.id}` });
  }

  // Every active placement has at least one ad; placement dates inside the campaign window
  const coveredPlacements = new Set(
    ads.filter((ad) => !ad.archived).flatMap((ad) => ad.placementAssignments.map((p) => p.placementId)),
  );
  for (const placement of placements) {
    if (placement.archived || placement.activeStatus !== 'ACTIVE') continue;
    const key = `config.placement_has_ad.placement:${placement.id}`;
    if (coveredPlacements.has(placement.id)) {
      checks.push({ checkKey: key, category: 'config', status: 'pass', message: `Placement "${placement.name}" has an assigned ad` });
    } else {
      checks.push({ checkKey: key, category: 'config', status: 'warn', message: `Placement "${placement.name}" has no ad assigned — it will serve nothing` });
    }
    const { startDate, endDate } = placement.pricingSchedule;
    if (startDate < campaign.startDate || endDate > campaign.endDate) {
      checks.push({
        checkKey: `config.placement_dates.placement:${placement.id}`, category: 'config', status: 'warn',
        message: `Placement "${placement.name}" dates (${startDate} → ${endDate}) fall outside the campaign flight`,
        expected: `${campaign.startDate} → ${campaign.endDate}`, actual: `${startDate} → ${endDate}`,
      });
    }
  }

  // UTM convention consistent across the whole campaign
  const mixed = validateSourceConsistency(resolvedUrls);
  if (mixed.length > 0) {
    checks.push(...mixed);
  } else if (resolvedUrls.length > 0) {
    checks.push({
      checkKey: 'tracking.source_consistency', category: 'tracking', status: 'pass',
      message: `utm_source is consistent across ${resolvedUrls.length} resolved click-through URL(s)`,
    });
  }

  return checks;
}

/** Direct URL validation for writes with no campaign scope (e.g. landing pages). */
function checkScopelessWrites(writes: RecordedWrite[]): QACheckResult[] {
  const checks: QACheckResult[] = [];
  for (const write of writes) {
    const url = str(write.toolInput.url) ?? str(rec(write.result)?.url);
    if (!url) continue;
    const entityId = str(rec(write.result)?.id) ?? str(write.toolInput.landingPageId) ?? 'new';
    const keySuffix = `lp:${entityId}`;
    const violations = [
      ...validateConfiguredUrl(url, { keySuffix }),
      ...findUnresolvedMacros(url, { keySuffix }),
    ];
    if (violations.length === 0) {
      checks.push({
        checkKey: `tracking.url.${keySuffix}`, category: 'tracking', status: 'pass',
        message: 'Landing page URL passes all string-level tracking rules', actual: url,
      });
    } else {
      checks.push(...violations);
    }
  }
  return checks;
}

function worstOf(checks: QACheckResult[]): 'passed' | 'warned' | 'failed' {
  if (checks.some((c) => c.status === 'fail')) return 'failed';
  if (checks.some((c) => c.status === 'warn')) return 'warned';
  return 'passed';
}

/**
 * The recording hook captures EVERY mutating tool (isMutatingTool prefix regex —
 * broader than the confirmation classifier), but only entity writes QA can
 * validate should produce runs: floodlight/report/user-role/directory-site
 * writes would yield near-empty "sweep skipped" runs cluttering the UI and DB.
 * Filtering happens here at drain time (not in the hook) so tool-executor stays
 * free of QA policy. URL-carrying writes (e.g. event tags) stay in — their URLs
 * still get string-level validation via checkScopelessWrites.
 */
function isQaRelevantWrite(write: RecordedWrite): boolean {
  if (write.toolName in WRITE_ENTITY_TYPES) return true;
  return str(write.toolInput.url) !== undefined || str(rec(write.result)?.url) !== undefined;
}

export interface RunTurnQaOptions {
  conversationId: string;
  userId: string;
  flags?: ResolvedFlags;
  trigger?: QARunTrigger;
}

/**
 * End-of-turn trigger: drain the writes this request executed, validate them
 * (touched stack + campaign sweep), persist, and return the report.
 * Returns null when nothing was written or qa.enabled is off.
 * Never throws — QA must never break chat or approvals.
 */
export async function runTurnQa(options: RunTurnQaOptions): Promise<QARunReport | null> {
  const { conversationId, userId } = options;
  const writes = drainQaWrites(conversationId).filter(isQaRelevantWrite);
  if (writes.length === 0) return null;
  if (options.flags?.['qa.enabled'] !== true) return null;
  const retentionDays = options.flags?.['qa.retention_days'] ?? DEFAULT_RETENTION_DAYS;
  const trigger = options.trigger ?? 'auto';

  void cleanupExpiredRuns(); // opportunistic retention sweep

  try {
    const scope = await resolveScope(writes, userId, conversationId);
    const run = await createRun({
      userId, conversationId, trigger, retentionDays,
      touched: scope.touched,
      ...(scope.campaignId ? { campaignId: scope.campaignId } : {}),
      ...(scope.advertiserId ? { advertiserId: scope.advertiserId } : {}),
    });
    void logAuditEvent({
      userId, conversationId, eventType: 'qa_run_started',
      metadata: { runId: run.id, trigger, writeCount: writes.length, campaignId: scope.campaignId },
    });

    let checks: QACheckResult[] = [];
    let status: QARunReport['status'];
    try {
      if (scope.campaignId) {
        const ctx = await fetchCampaignContext(scope.profileId, scope.campaignId, userId, conversationId);
        if (ctx) {
          checks = sweepCampaign(ctx);
        } else {
          checks.push({
            checkKey: 'config.scope', category: 'config', status: 'skipped',
            message: `Campaign ${scope.campaignId} could not be read — sweep skipped`,
          });
        }
      } else {
        checks.push({
          checkKey: 'config.scope', category: 'config', status: 'skipped',
          message: 'No campaign scope derivable from this turn\'s writes — campaign sweep skipped',
        });
      }
      checks.push(...checkScopelessWrites(writes));
      status = worstOf(checks);
    } catch (err) {
      status = 'error';
      checks.push({
        checkKey: 'config.run_error', category: 'config', status: 'skipped',
        message: `QA run errored: ${err instanceof Error ? err.message : 'unknown'}`,
      });
    }

    await saveChecks(run.id, checks);
    await completeRun(run.id, status);
    await logAuditEvent({
      userId, conversationId, eventType: 'qa_run_completed',
      metadata: { runId: run.id, status, checkCount: checks.length },
    });

    const completed = { ...run, status, completedAt: new Date() };
    return runToReport(completed, checks.map((c) => ({
      checkKey: c.checkKey, category: c.category, status: c.status,
      expected: c.expected ?? null, actual: c.actual ?? null,
      detail: JSON.stringify({ message: c.message }),
    })));
  } catch (err) {
    logger.warn(
      { err: { message: err instanceof Error ? err.message : 'Unknown' }, conversationId },
      'Trafficking QA run failed — advisory only, continuing',
    );
    return null;
  }
}
