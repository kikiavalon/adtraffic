/**
 * Trafficking QA — Layer 3 orchestration (design §4 runner transports).
 *
 * DEMO/dev: invoke runner-core in-process (no queue, no qa-runner service);
 * Playwright missing → skipped with an install hint.
 * Live: BUILD jobs + queued placeholder checks but do NOT enqueue here —
 * qa-service persists the full check set first and only then enqueues, so a
 * fast worker completion can never finalize the run against an incomplete
 * check set. The QueueEvents handlers later overwrite the placeholders
 * (idempotent upsert on (run_id, check_key) — exactly why that constraint exists).
 *
 * Never throws — QA is advisory and must never break the chat/approve request.
 */

import type {
  QACheckResult, QAClickTestJob, QATouchedEntity,
} from '@adtraffic/shared';
import type { ResolvedFlags } from '../feature-flags/flag-registry.js';
import { logger } from '../lib/logger.js';
import { mapExpectedToDemoLanding } from '../routes/demo-fixtures.js';
import { assessAd, type CampaignContext } from './click-resolver.js';
import { demoFixtureBase } from './demo-base.js';
import { loadClickTestRunner } from './qa-runner-loader.js';
import { qaRead } from './qa-read.js';
import { saveEvidence } from './qa-store.js';

export const MAX_CLICK_TESTS_PER_RUN = 5;
const TRACKCLK_PATTERN = '^https://ad\\.doubleclick\\.net/ddm/trackclk/';

export interface ClickLayerInput {
  runId: string;
  profileId: string;
  touched: QATouchedEntity[];
  ctx: CampaignContext | null;
  userId: string;
  conversationId: string;
  flags?: ResolvedFlags;
}

export interface ClickLayerOutcome {
  checks: QACheckResult[];
  /** Live-mode jobs to enqueue — the CALLER persists `checks` (which include
   * queued placeholders for these jobs) BEFORE enqueueing, then leaves the run
   * `running`. Always empty in DEMO_MODE (results are already in `checks`). */
  jobs: QAClickTestJob[];
}

function summaryKey(adId: string): string {
  return `clickthrough.click_test.ad:${adId}`;
}

function skipped(adId: string, message: string): QACheckResult {
  return { checkKey: summaryKey(adId), category: 'clickthrough', status: 'skipped', message };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type BuiltJob = { job: QAClickTestJob } | { check: QACheckResult };

async function buildJob(
  input: ClickLayerInput,
  ctx: CampaignContext,
  adId: string,
  demoMode: boolean,
): Promise<BuiltJob> {
  const ad = ctx.ads.find((candidate) => candidate.id === adId);
  if (!ad || ad.archived) {
    return { check: skipped(adId, `Ad ${adId} not found in the campaign context — click test skipped`) };
  }
  const assessment = assessAd({
    ad, campaign: ctx.campaign,
    ...(ctx.advertiser ? { advertiser: ctx.advertiser } : {}),
    landingPages: ctx.landingPages, creatives: ctx.creatives,
  });
  if (!assessment.expectedUrl) {
    // The config layer already failed check 15 for this ad — nothing to click against.
    return { check: skipped(adId, `Ad "${ad.name}" has no resolvable click-through — click test skipped (see configuration checks)`) };
  }
  const advertiserId = ctx.campaign.advertiserId;
  if (demoMode) {
    const base = demoFixtureBase();
    return {
      job: {
        runId: input.runId, adId, advertiserId,
        clickUrl: `${base}/demo/click/${adId}`,
        // Same mapping the hop redirect uses; the runner's macro-aware param
        // diff absorbs serve-time macro expansion (e.g. utm_content=suffix-%epid!).
        expectedUrl: mapExpectedToDemoLanding(assessment.expectedUrl, advertiserId, base),
        expectedFirstHopPattern: `^${escapeRegExp(base)}/demo/click/`,
        allowInsecureHosts: ['localhost', '127.0.0.1'],
      },
    };
  }
  // Live: export the real placement tag for the ad's first placement (read-only).
  const placementId = ad.placementAssignments[0]?.placementId;
  if (!placementId) {
    return { check: skipped(adId, `Ad "${ad.name}" has no placement assignment — nothing to click`) };
  }
  const tagResult = await qaRead(
    'cm360_generate_tags',
    { profileId: input.profileId, campaignId: ctx.campaign.id, placementIds: [placementId] },
    input.userId, input.conversationId,
  );
  // Both executor paths wrap the result as { placementTags: [...] }
  // (tool-executor.ts:737 real, :1705 mock).
  const wrapped = tagResult.isError ? null : (tagResult.result as { placementTags?: Array<{ tagData: Array<{ clickTag?: string; impressionTag?: string }> }> } | null);
  const tagData = wrapped?.placementTags?.[0]?.tagData?.[0];
  if (!tagData?.clickTag) {
    return { check: skipped(adId, `Placement tag export returned no clickTag for placement ${placementId} — click test skipped`) };
  }
  return {
    job: {
      runId: input.runId, adId, advertiserId,
      clickUrl: tagData.clickTag,
      ...(tagData.impressionTag ? { tagHtml: tagData.impressionTag } : {}),
      expectedUrl: assessment.expectedUrl,
      expectedFirstHopPattern: TRACKCLK_PATTERN,
    },
  };
}

export async function runClickLayer(input: ClickLayerInput): Promise<ClickLayerOutcome> {
  try {
    if (input.flags?.['qa.click_test.enabled'] !== true) return { checks: [], jobs: [] };
    const adIds = [...new Set(
      input.touched
        .filter((entity) => entity.entityType === 'ad' && entity.entityId)
        .map((entity) => entity.entityId!),
    )];
    if (adIds.length === 0) return { checks: [], jobs: [] };
    if (!input.ctx) {
      return {
        checks: [{ checkKey: 'clickthrough.scope', category: 'clickthrough', status: 'skipped', message: 'No campaign context — click tests skipped' }],
        jobs: [],
      };
    }

    const demoMode = process.env.DEMO_MODE === 'true';
    const checks: QACheckResult[] = [];
    const jobs: QAClickTestJob[] = [];
    for (const adId of adIds.slice(0, MAX_CLICK_TESTS_PER_RUN)) {
      const built = await buildJob(input, input.ctx, adId, demoMode);
      if ('check' in built) checks.push(built.check);
      else jobs.push(built.job);
    }
    for (const adId of adIds.slice(MAX_CLICK_TESTS_PER_RUN)) {
      checks.push(skipped(adId, `Over the ${MAX_CLICK_TESTS_PER_RUN}-click-tests-per-run cap — re-run QA for this ad manually (Phase 3)`));
    }
    if (jobs.length === 0) return { checks, jobs: [] };

    if (demoMode) {
      const runner = await loadClickTestRunner();
      if (!runner) {
        for (const job of jobs) {
          checks.push(skipped(job.adId,
            'Playwright is not installed — run "npx playwright install chromium" and "npm run build --workspace=qa-runner" to enable click tests in demo mode'));
        }
        return { checks, jobs: [] };
      }
      for (const job of jobs) {
        try {
          const result = await runner(job);
          const resultChecks = [...result.checks];
          if (result.evidence) {
            try {
              const evidenceId = await saveEvidence(
                result.runId, `click:ad:${result.adId}`,
                result.evidence.contentType, Buffer.from(result.evidence.dataBase64, 'base64'),
              );
              const index = resultChecks.findIndex((c) => c.checkKey === result.evidence!.forCheckKey);
              if (index >= 0) resultChecks[index] = { ...resultChecks[index]!, evidenceId };
            } catch { /* screenshot is optional evidence */ }
          }
          checks.push(...resultChecks);
        } catch (err) {
          checks.push({
            checkKey: summaryKey(job.adId), category: 'clickthrough', status: 'fail',
            message: `Click test errored: ${err instanceof Error ? err.message : 'unknown'}`,
            detail: { runnerFailure: true },
          });
        }
      }
      return { checks, jobs: [] };
    }

    // Live: return the jobs + queued placeholders — qa-service persists the
    // checks FIRST, then enqueues (closes the fast-worker/persist race).
    for (const job of jobs) {
      checks.push({
        checkKey: summaryKey(job.adId), category: 'clickthrough', status: 'skipped',
        message: 'Click test queued — results will attach to this run shortly',
        detail: { queued: true },
      });
    }
    return { checks, jobs };
  } catch (err) {
    logger.warn(
      { err: { message: err instanceof Error ? err.message : 'Unknown' }, runId: input.runId },
      'QA click layer failed — advisory only, continuing',
    );
    return {
      checks: [{ checkKey: 'clickthrough.scope', category: 'clickthrough', status: 'skipped', message: 'Click layer errored — see backend logs' }],
      jobs: [],
    };
  }
}
