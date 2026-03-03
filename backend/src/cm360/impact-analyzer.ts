/**
 * Impact analyzer — examines downstream consequences of elevated/destructive
 * write operations BEFORE showing the confirmation card to the user.
 *
 * Returns an array of warning strings that get appended to ActionPreview.warnings
 * so the ConfirmationCard can display them prominently.
 *
 * Currently uses the mock data store directly (demo mode). When users connect
 * real CM360 accounts, this should be updated to query the real API.
 *
 * TODO: Add real CM360 API support via cm360-client when OAuth tokens are available.
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
 * @returns Array of warning strings (empty if no concerns)
 */
export async function analyzeImpact(
  toolName: string,
  toolInput: Record<string, unknown>,
  _userId?: string,
): Promise<string[]> {
  try {
    switch (toolName) {
      case 'cm360_update_campaign':
        return await analyzeCampaignUpdate(toolInput);

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
async function analyzeCampaignUpdate(input: Record<string, unknown>): Promise<string[]> {
  if (input.archived !== true) return [];

  const campaignId = typeof input.campaignId === 'string' ? input.campaignId : undefined;
  if (!campaignId) return [];

  // Query placements and ads in parallel for future API migration readiness
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
