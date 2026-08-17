/**
 * Trafficking QA — expected click-through computation + override detection.
 *
 * Owns design checks 13 (suffix / click-tag overrides), 15 (precedence
 * resolution), and 16 (assignment/date sanity) so precedence logic is
 * implemented exactly once (shared resolveClickThroughUrl from Phase 0).
 * All reads go through qaRead (read-only allowlist).
 */

import {
  resolveClickThroughUrl,
  validateConfiguredUrl,
  findUnresolvedMacros,
} from '@adtraffic/shared';
import type {
  CM360Ad, CM360Advertiser, CM360Campaign, CM360Creative, CM360LandingPage, CM360Placement,
  QACheckResult,
} from '@adtraffic/shared';
import { qaRead } from './qa-read.js';

export interface CampaignContext {
  profileId: string;
  campaign: CM360Campaign;
  advertiser?: CM360Advertiser;
  ads: CM360Ad[];
  placements: CM360Placement[];
  landingPages: CM360LandingPage[];
  creatives: Map<string, CM360Creative>;
}

export interface AdAssessment {
  adId: string;
  adName: string;
  expectedUrl?: string;
  checks: QACheckResult[];
}

function config(
  checkKey: string,
  status: QACheckResult['status'],
  message: string,
  expected?: string,
  actual?: string,
): QACheckResult {
  return {
    checkKey, category: 'config', status, message,
    ...(expected !== undefined ? { expected } : {}),
    ...(actual !== undefined ? { actual } : {}),
  };
}

/** Full Layer-1/2 assessment of one ad against prefetched campaign context (pure). */
export function assessAd(input: {
  ad: CM360Ad;
  campaign: CM360Campaign;
  advertiser?: CM360Advertiser;
  landingPages: CM360LandingPage[];
  creatives: Map<string, CM360Creative>;
}): AdAssessment {
  const { ad, campaign, advertiser, landingPages, creatives } = input;
  const suffix = `ad:${ad.id}`;
  const checks: QACheckResult[] = [];

  // Check 16: active creative assignment.
  // Our model collapses rotation to a single assignment (Phase 0 scope cut) —
  // only creativeAssignments[0] is assessed.
  const assignment = ad.creativeRotation.creativeAssignments[0];
  if (!assignment) {
    checks.push(config(`config.creative_assignment.${suffix}`, 'fail',
      `Ad "${ad.name}" has no creative assignment — it cannot serve`));
  } else {
    const creative = creatives.get(assignment.creativeId);
    if (!creative) {
      checks.push(config(`config.creative_assignment.${suffix}`, 'warn',
        `Assigned creative ${assignment.creativeId} was not found among the advertiser's creatives`));
    } else if (creative.archived || !creative.active) {
      checks.push(config(`config.creative_assignment.${suffix}`, 'fail',
        `Assigned creative "${creative.name}" is ${creative.archived ? 'archived' : 'inactive'}`));
    } else {
      checks.push(config(`config.creative_assignment.${suffix}`, 'pass',
        `Active creative "${creative.name}" assigned`));
    }
    // Check 13 (HTML5 caveat): click-tag introspection needs the Phase 2 browser runner
    if (creative && String(creative.type).includes('HTML5')) {
      checks.push(config(`config.click_tag_override.${suffix}`, 'skipped',
        `"${creative.name}" is an HTML5 creative — its click-tag landing page can override the ad-level URL; browser verification arrives in QA Phase 2`));
    }
  }

  // Check 15: expected URL via documented precedence (shared resolver, Phase 0)
  const resolved = resolveClickThroughUrl({
    assignment: assignment?.clickThroughUrl ?? { defaultLandingPage: true },
    landingPages: landingPages.map((lp) => ({ id: lp.id, url: lp.url })),
    campaignDefaultLandingPageId: campaign.defaultLandingPageId,
    advertiserSuffix: advertiser?.clickThroughUrlSuffix,
    campaignSuffixProperties: campaign.clickThroughUrlSuffixProperties,
    adSuffixProperties: ad.clickThroughUrlSuffixProperties,
  });
  if (resolved.url) {
    checks.push(config(`config.click_through.${suffix}`, 'pass',
      `Click-through resolves via ${resolved.source}`, undefined, resolved.url));
  } else {
    checks.push(config(`config.click_through.${suffix}`, 'fail',
      `Click-through does not resolve (${resolved.source}) — check the assignment's landing page and the campaign default`));
  }

  // Check 13: lower-level suffix silently overriding the advertiser default
  if (resolved.suffixLevel && resolved.suffixLevel !== 'advertiser' && advertiser?.clickThroughUrlSuffix) {
    checks.push(config(`config.suffix_override.${suffix}`, 'warn',
      `${resolved.suffixLevel}-level URL suffix overrides the advertiser default — suffixes override, never append, so UTMs may be inconsistent`,
      advertiser.clickThroughUrlSuffix, resolved.effectiveSuffix));
  }

  // Check 13/15: custom URL bypasses managed landing pages
  if (assignment?.clickThroughUrl?.customClickThroughUrl) {
    checks.push(config(`config.custom_url.${suffix}`, 'warn',
      'Ad uses a custom click-through URL instead of a managed landing page — not centrally managed',
      undefined, assignment.clickThroughUrl.customClickThroughUrl));
  }

  // Check 16: ad date window sanity
  if (ad.startTime && ad.endTime && ad.startTime > ad.endTime) {
    checks.push(config(`config.ad_dates.${suffix}`, 'fail',
      `Ad start time ${ad.startTime} is after end time ${ad.endTime}`));
  }

  // Tracking rules (checks 5/10/11/12/14) on the expected URL
  if (resolved.url) {
    const violations = [
      ...validateConfiguredUrl(resolved.url, { keySuffix: suffix }),
      ...findUnresolvedMacros(resolved.url, { keySuffix: suffix }),
    ];
    if (violations.length === 0) {
      checks.push({
        checkKey: `tracking.url.${suffix}`, category: 'tracking', status: 'pass',
        message: 'Expected click-through URL passes all string-level tracking rules', actual: resolved.url,
      });
    } else {
      checks.push(...violations);
    }
  }

  return { adId: ad.id, adName: ad.name, expectedUrl: resolved.url, checks };
}

/**
 * List tools return WRAPPED results — `{ ads }` (tool-executor.ts:1656),
 * `{ placements }` (:1610), `{ landingPages }` (:1582), `{ creatives }` (:1641) —
 * while get tools return the bare entity. Unwrap with a typed accessor.
 */
function unwrapList<T>(result: unknown, key: string): T[] {
  const wrapped = result as Record<string, unknown> | null | undefined;
  const list = wrapped?.[key];
  return Array.isArray(list) ? (list as T[]) : [];
}

/** Read-only fetch of everything the sweep needs (6 reads, all allowlisted). */
export async function fetchCampaignContext(
  profileId: string,
  campaignId: string,
  userId?: string,
  conversationId?: string,
): Promise<CampaignContext | null> {
  const campaignRes = await qaRead('cm360_get_campaign', { profileId, campaignId }, userId, conversationId);
  const campaign = campaignRes.isError ? null : (campaignRes.result as CM360Campaign | null);
  if (!campaign) return null;

  const advertiserId = campaign.advertiserId;
  const [advRes, adsRes, placementsRes, lpRes, creativesRes] = [
    await qaRead('cm360_get_advertiser', { profileId, advertiserId }, userId, conversationId),
    await qaRead('cm360_list_ads', { profileId, campaignId, maxResults: 100 }, userId, conversationId),
    await qaRead('cm360_list_placements', { profileId, campaignId, maxResults: 100 }, userId, conversationId),
    await qaRead('cm360_list_landing_pages', { profileId, advertiserId, maxResults: 100 }, userId, conversationId),
    await qaRead('cm360_list_creatives', { profileId, advertiserId, maxResults: 100 }, userId, conversationId),
  ];

  const advertiser = advRes.isError ? undefined : (advRes.result as CM360Advertiser | undefined) ?? undefined;
  const creatives = new Map(unwrapList<CM360Creative>(creativesRes.result, 'creatives').map((c) => [c.id, c]));
  return {
    profileId,
    campaign,
    ...(advertiser ? { advertiser } : {}),
    ads: unwrapList<CM360Ad>(adsRes.result, 'ads'),
    placements: unwrapList<CM360Placement>(placementsRes.result, 'placements'),
    landingPages: unwrapList<CM360LandingPage>(lpRes.result, 'landingPages'),
    creatives,
  };
}
