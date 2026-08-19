/**
 * Impact analyzer — examines downstream consequences of elevated/destructive
 * write operations BEFORE showing the confirmation card to the user.
 *
 * Returns an array of warning strings that get appended to ActionPreview.warnings
 * so the ConfirmationCard can display them prominently.
 *
 * Count-based warnings (e.g. "N active placements") are derived from the mock
 * data store, which is exactly what a demo user sees — so those counts are
 * accurate in demo mode. For a user connected to a LIVE CM360 account the mock
 * store holds unrelated data, so emitting mock counts would be fabricated (a real
 * archive could read "0 affected"). In live mode we therefore never show mock
 * counts; we show an honest "not verified against your live account" warning
 * instead. A future enhancement can query real impact via cm360-client.
 */

import { mockStore } from './mock-data-store.js';

/**
 * Analyze the downstream impact of a proposed write operation.
 *
 * Only produces warnings for elevated/destructive operations:
 * - Archiving campaigns (checks active placements and ads)
 * - Deactivating/archiving placements
 * - Archiving creatives (warns about ad references)
 * - Archiving ads (warns about serving stoppage)
 * - Archiving landing pages (warns about campaign dependencies)
 *
 * @param toolName - The CM360 tool being called
 * @param toolInput - The tool's input parameters
 * @param _userId - Reserved for future real API support
 * @param isLiveData - True when the user is connected to a live CM360 account;
 *   suppresses mock-derived counts that would be fabricated for real campaigns.
 * @returns Array of warning strings (empty if no concerns)
 */
export async function analyzeImpact(
  toolName: string,
  toolInput: Record<string, unknown>,
  _userId?: string,
  isLiveData = false,
): Promise<string[]> {
  try {
    switch (toolName) {
      case 'cm360_update_campaign':
        return await analyzeCampaignUpdate(toolInput, isLiveData);

      case 'cm360_update_placement':
        return analyzePlacementUpdate(toolInput);

      case 'cm360_update_creative':
        return analyzeCreativeUpdate(toolInput);

      case 'cm360_update_ad':
        return analyzeAdUpdate(toolInput);

      case 'cm360_update_landing_page':
        return analyzeLandingPageUpdate(toolInput);

      default:
        return [];
    }
  } catch {
    // Impact analysis is best-effort — never block the confirmation flow
    return [];
  }
}

/**
 * Campaign archive: check for active placements and ads that would be affected.
 */
async function analyzeCampaignUpdate(input: Record<string, unknown>, isLiveData: boolean): Promise<string[]> {
  if (input.archived !== true) return [];

  const campaignId = typeof input.campaignId === 'string' ? input.campaignId : undefined;
  if (!campaignId) return [];

  // Live account: the mock store does not hold this campaign, so any count would
  // be fabricated. Warn honestly rather than assert an unverified number.
  if (isLiveData) {
    return [
      'Archiving this campaign will stop its active placements and ads from serving. The number affected is not verified against your live CM360 account — review in CM360 before confirming.',
    ];
  }

  // Demo mode: the mock store IS the data the user sees, so its counts are accurate.
  const [placements, ads] = await Promise.all([
    Promise.resolve(mockStore.listPlacements({ campaignId }) ?? []),
    Promise.resolve(mockStore.listAds({ campaignId }) ?? []),
  ]);

  const warnings: string[] = [];

  // Only count active placements
  const activePlacements = placements.filter(
    (p) => p.activeStatus === 'ACTIVE',
  );
  if (activePlacements.length > 0) {
    warnings.push(
      `This campaign has ${activePlacements.length} active placement(s) that may be affected.`,
    );
  }

  // Only count non-archived ads (already-archived ads are unaffected)
  const activeAds = ads.filter((a) => !a.archived);
  if (activeAds.length > 0) {
    warnings.push(
      `This campaign has ${activeAds.length} active ad(s) that will stop serving.`,
    );
  }

  return warnings;
}

/**
 * Placement deactivation/archive: warn about serving stoppage and permanence.
 */
function analyzePlacementUpdate(input: Record<string, unknown>): string[] {
  const activeStatus = typeof input.activeStatus === 'string' ? input.activeStatus : undefined;
  if (!activeStatus) return [];

  const warnings: string[] = [];

  if (activeStatus === 'INACTIVE' || activeStatus === 'ARCHIVED') {
    warnings.push(
      'Setting this placement to ' + activeStatus + ' will stop serving ads on it.',
    );
  }

  if (activeStatus === 'PERMANENTLY_ARCHIVED') {
    warnings.push(
      'Setting this placement to PERMANENTLY_ARCHIVED is permanent and cannot be undone.',
    );
    warnings.push(
      'This will stop serving ads on this placement permanently.',
    );
  }

  return warnings;
}

/**
 * Creative archive: warn about ads that may reference this creative.
 * We don't have a way to efficiently query which ads use a creative via the
 * mock data store, so we provide a generic warning.
 */
function analyzeCreativeUpdate(input: Record<string, unknown>): string[] {
  if (input.archived !== true) return [];

  return [
    'Archived creatives may affect ads that reference them.',
  ];
}

/**
 * Ad archive: warn about serving stoppage.
 */
function analyzeAdUpdate(input: Record<string, unknown>): string[] {
  if (input.archived !== true) return [];

  return [
    'Archiving this ad will stop it from serving.',
  ];
}

/**
 * Landing page archive: warn about campaigns that use it as default.
 */
function analyzeLandingPageUpdate(input: Record<string, unknown>): string[] {
  if (input.archived !== true) return [];

  return [
    'Archived landing pages may affect campaigns that use them as default.',
  ];
}
