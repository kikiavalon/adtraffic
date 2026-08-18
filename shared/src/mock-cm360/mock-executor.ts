/**
 * Mock CM360 tool executor — dispatches Claude tool_use calls to the mock
 * data store. Dependency-free (no logger/audit/redis/postgres imports) so
 * the MCP demo server can consume it via @adtraffic/shared/mock-cm360.
 *
 * Moved verbatim from backend/src/cm360/tool-executor.ts.
 */

import type { PendingAction } from '../types/confirmation.js';
import { mockStore } from './mock-data-store.js';
import {
  ListProfilesInputSchema,
  ListAdvertisersInputSchema,
  GetAdvertiserInputSchema,
  ListCampaignsInputSchema,
  CreateCampaignInputSchema,
  ListSitesInputSchema,
  ListLandingPagesInputSchema,
  CreateLandingPageInputSchema,
  ListPlacementsInputSchema,
  CreatePlacementInputSchema,
  ListCreativesInputSchema,
  ListAdsInputSchema,
  CreateAdInputSchema,
  GenerateTagsInputSchema,
  GetCampaignInputSchema,
  GetPlacementInputSchema,
  GetAdInputSchema,
  UpdateCampaignInputSchema,
  UpdatePlacementInputSchema,
  UpdateAdInputSchema,
  UpdateCreativeInputSchema,
  UpdateLandingPageInputSchema,
  GetCreativeInputSchema,
  CreateCreativeInputSchema,
  GetLandingPageInputSchema,
  GetSiteInputSchema,
  ListSizesInputSchema,
  AssociateCreativeCampaignInputSchema,
  ListCampaignCreativeAssociationsInputSchema,
  UploadCreativeAssetInputSchema,
  ListEventTagsInputSchema,
  GetEventTagInputSchema,
  CreateEventTagInputSchema,
  UpdateEventTagInputSchema,
  ListPlacementGroupsInputSchema,
  GetPlacementGroupInputSchema,
  CreatePlacementGroupInputSchema,
  UpdatePlacementGroupInputSchema,
  ListDirectorySitesInputSchema,
  GetDirectorySiteInputSchema,
  InsertDirectorySiteInputSchema,
  ListChangeLogsInputSchema,
  GetChangeLogInputSchema,
  ListReportsInputSchema,
  GetReportInputSchema,
  RunReportInputSchema,
  GetReportFileInputSchema,
  QueryCompatibleFieldsInputSchema,
  CreateReportInputSchema,
  ListFloodlightActivitiesInputSchema,
  GetFloodlightActivityInputSchema,
  CreateFloodlightActivityInputSchema,
  GenerateFloodlightTagInputSchema,
  ListFloodlightActivityGroupsInputSchema,
  GetFloodlightActivityGroupInputSchema,
  CreateFloodlightActivityGroupInputSchema,
  ListFloodlightConfigurationsInputSchema,
  PacingAnalysisInputSchema,
  ListAccountUserProfilesInputSchema,
  GetAccountUserProfileInputSchema,
  CreateAccountUserProfileInputSchema,
  ListUserRolesInputSchema,
  GetUserRoleInputSchema,
  CreateUserRoleInputSchema,
  ListUserRolePermissionsInputSchema,
  GetUserRolePermissionInputSchema,
  ListUserRolePermissionGroupsInputSchema,
  GetUserRolePermissionGroupInputSchema,
  ListSubaccountsInputSchema,
  GetSubaccountInputSchema,
  formatZodErrors,
} from './tool-input-schemas.js';

export interface ToolResult {
  result: unknown;
  isError: boolean;
  errorMessage?: string;
  /** Set when a write tool requires user confirmation before execution */
  requiresConfirmation?: boolean;
  /** The pending action details for the confirmation card */
  pendingAction?: PendingAction;
}

// ---------------------------------------------------------------------------
// EU AI Act Article 50(2) — machine-readable AI attribution on generated outputs
// ---------------------------------------------------------------------------

/** HTML comment prepended to all AI-generated tag code snippets. */
export function aiTagAttribution(): string {
  return `<!-- AI-Generated: true | Agent: AdTraffic.ai/Kiki | Timestamp: ${new Date().toISOString()} -->`;
}

/** Metadata object appended to AI-processed report files. */
export function aiReportMetadata(): { agent: string; generated_at: string; eu_ai_act_disclosure: string } {
  return {
    agent: 'adtraffic.ai/kiki',
    generated_at: new Date().toISOString(),
    eu_ai_act_disclosure: 'This content was processed by an AI system (AdTraffic.ai)',
  };
}

export function executeToolMock(
  toolName: string,
  toolInput: Record<string, unknown>,
): ToolResult {
  try {
    switch (toolName) {
      case 'cm360_list_profiles': {
        const parsed = ListProfilesInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        return { result: { profiles: mockStore.listProfiles() }, isError: false };
      }

      case 'cm360_list_advertisers': {
        const parsed = ListAdvertisersInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const advertisers = mockStore.listAdvertisers({
          searchString: parsed.data.searchString,
          maxResults: parsed.data.maxResults,
        });
        return { result: { advertisers }, isError: false };
      }

      case 'cm360_get_advertiser': {
        const parsed = GetAdvertiserInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const adv = mockStore.getAdvertiser(parsed.data.advertiserId);
        if (!adv) {
          return { result: null, isError: true, errorMessage: `Advertiser ${parsed.data.advertiserId} not found` };
        }
        return { result: adv, isError: false };
      }

      case 'cm360_list_campaigns': {
        const parsed = ListCampaignsInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const campaigns = mockStore.listCampaigns({
          advertiserId: parsed.data.advertiserId,
          searchString: parsed.data.searchString,
          maxResults: parsed.data.maxResults,
        });
        return { result: { campaigns }, isError: false };
      }

      case 'cm360_create_campaign': {
        const parsed = CreateCampaignInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const campaign = mockStore.createCampaign({
          advertiserId: parsed.data.advertiserId,
          name: parsed.data.name,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          defaultLandingPageId: parsed.data.defaultLandingPageId,
        });
        return { result: campaign, isError: false };
      }

      case 'cm360_list_sites': {
        const parsed = ListSitesInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const sites = mockStore.listSites({
          searchString: parsed.data.searchString,
          maxResults: parsed.data.maxResults,
        });
        return { result: { sites }, isError: false };
      }

      case 'cm360_list_landing_pages': {
        const parsed = ListLandingPagesInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const landingPages = mockStore.listLandingPages({
          advertiserId: parsed.data.advertiserId,
          searchString: parsed.data.searchString,
          maxResults: parsed.data.maxResults,
        });
        return { result: { landingPages }, isError: false };
      }

      case 'cm360_create_landing_page': {
        const parsed = CreateLandingPageInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const page = mockStore.createLandingPage({
          advertiserId: parsed.data.advertiserId,
          name: parsed.data.name,
          url: parsed.data.url,
        });
        return { result: page, isError: false };
      }

      case 'cm360_list_placements': {
        const parsed = ListPlacementsInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const placements = mockStore.listPlacements({
          campaignId: parsed.data.campaignId,
          advertiserId: parsed.data.advertiserId,
          searchString: parsed.data.searchString,
          maxResults: parsed.data.maxResults,
        });
        return { result: { placements }, isError: false };
      }

      case 'cm360_create_placement': {
        const parsed = CreatePlacementInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const placement = mockStore.createPlacement({
          campaignId: parsed.data.campaignId,
          siteId: parsed.data.siteId,
          name: parsed.data.name,
          width: parsed.data.width,
          height: parsed.data.height,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          paymentSource: parsed.data.paymentSource,
          compatibility: parsed.data.compatibility,
        });
        return { result: placement, isError: false };
      }

      case 'cm360_list_creatives': {
        const parsed = ListCreativesInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const creatives = mockStore.listCreatives({
          advertiserId: parsed.data.advertiserId,
          searchString: parsed.data.searchString,
          maxResults: parsed.data.maxResults,
        });
        return { result: { creatives }, isError: false };
      }

      case 'cm360_list_ads': {
        const parsed = ListAdsInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const ads = mockStore.listAds({
          campaignId: parsed.data.campaignId,
          advertiserId: parsed.data.advertiserId,
          searchString: parsed.data.searchString,
          maxResults: parsed.data.maxResults,
        });
        return { result: { ads }, isError: false };
      }

      case 'cm360_create_ad': {
        const parsed = CreateAdInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const ad = mockStore.createAd({
          campaignId: parsed.data.campaignId,
          name: parsed.data.name,
          placementIds: parsed.data.placementIds,
          creativeId: parsed.data.creativeId,
          landingPageId: parsed.data.landingPageId,
          customClickThroughUrl: parsed.data.customClickThroughUrl,
          clickThroughUrlSuffix: parsed.data.clickThroughUrlSuffix,
        });
        return { result: ad, isError: false };
      }

      case 'cm360_generate_tags': {
        const parsed = GenerateTagsInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const tags = mockStore.generateTags(
          parsed.data.campaignId,
          parsed.data.placementIds,
          parsed.data.tagFormats,
        );
        // EU AI Act Article 50(2) — prepend AI attribution to generated tag code
        const attribution = aiTagAttribution();
        const tagResults = tags.map((tag) => ({
          ...tag,
          tagData: tag.tagData.map((td) => ({
            ...td,
            impressionTag: attribution + '\n' + td.impressionTag,
            clickTag: td.clickTag,
          })),
        }));
        return { result: { placementTags: tagResults }, isError: false };
      }

      // --- Get single entity tools ---

      case 'cm360_get_campaign': {
        const parsed = GetCampaignInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const campaign = mockStore.getCampaign(parsed.data.campaignId);
        if (!campaign) {
          return { result: null, isError: true, errorMessage: `Campaign ${parsed.data.campaignId} not found` };
        }
        return { result: campaign, isError: false };
      }

      case 'cm360_get_placement': {
        const parsed = GetPlacementInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const placement = mockStore.getPlacement(parsed.data.placementId);
        if (!placement) {
          return { result: null, isError: true, errorMessage: `Placement ${parsed.data.placementId} not found` };
        }
        return { result: placement, isError: false };
      }

      case 'cm360_get_ad': {
        const parsed = GetAdInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const ad = mockStore.getAd(parsed.data.adId);
        if (!ad) {
          return { result: null, isError: true, errorMessage: `Ad ${parsed.data.adId} not found` };
        }
        return { result: ad, isError: false };
      }

      // --- Update tools ---

      case 'cm360_update_campaign': {
        const parsed = UpdateCampaignInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const updated = mockStore.updateCampaign(parsed.data.campaignId, parsed.data);
        if (!updated) {
          return { result: null, isError: true, errorMessage: `Campaign ${parsed.data.campaignId} not found` };
        }
        return { result: updated, isError: false };
      }

      case 'cm360_update_placement': {
        const parsed = UpdatePlacementInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const updated = mockStore.updatePlacement(parsed.data.placementId, parsed.data);
        if (!updated) {
          return { result: null, isError: true, errorMessage: `Placement ${parsed.data.placementId} not found` };
        }
        return { result: updated, isError: false };
      }

      case 'cm360_update_ad': {
        const parsed = UpdateAdInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const updated = mockStore.updateAd(parsed.data.adId, parsed.data);
        if (!updated) {
          return { result: null, isError: true, errorMessage: `Ad ${parsed.data.adId} not found` };
        }
        return { result: updated, isError: false };
      }

      case 'cm360_update_creative': {
        const parsed = UpdateCreativeInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const updated = mockStore.updateCreative(parsed.data.creativeId, parsed.data);
        if (!updated) {
          return { result: null, isError: true, errorMessage: `Creative ${parsed.data.creativeId} not found` };
        }
        return { result: updated, isError: false };
      }

      case 'cm360_update_landing_page': {
        const parsed = UpdateLandingPageInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const updated = mockStore.updateLandingPage(parsed.data.landingPageId, parsed.data);
        if (!updated) {
          return { result: null, isError: true, errorMessage: `Landing page ${parsed.data.landingPageId} not found` };
        }
        return { result: updated, isError: false };
      }

      // --- Phase A: CRUD gap tools ---

      case 'cm360_get_creative': {
        const parsed = GetCreativeInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const creative = mockStore.getCreative(parsed.data.creativeId);
        if (!creative) {
          return { result: null, isError: true, errorMessage: `Creative ${parsed.data.creativeId} not found` };
        }
        return { result: creative, isError: false };
      }

      case 'cm360_create_creative': {
        const parsed = CreateCreativeInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const creative = mockStore.createCreative({
          advertiserId: parsed.data.advertiserId,
          name: parsed.data.name,
          type: parsed.data.type,
          width: parsed.data.width,
          height: parsed.data.height,
          active: parsed.data.active,
        });
        return { result: creative, isError: false };
      }

      case 'cm360_get_landing_page': {
        const parsed = GetLandingPageInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const page = mockStore.getLandingPage(parsed.data.landingPageId);
        if (!page) {
          return { result: null, isError: true, errorMessage: `Landing page ${parsed.data.landingPageId} not found` };
        }
        return { result: page, isError: false };
      }

      case 'cm360_get_site': {
        const parsed = GetSiteInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const site = mockStore.getSite(parsed.data.siteId);
        if (!site) {
          return { result: null, isError: true, errorMessage: `Site ${parsed.data.siteId} not found` };
        }
        return { result: site, isError: false };
      }

      case 'cm360_list_sizes': {
        const parsed = ListSizesInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const sizes = mockStore.listSizes({
          width: parsed.data.width,
          height: parsed.data.height,
          iabStandard: parsed.data.iabStandard,
        });
        return { result: { sizes }, isError: false };
      }

      // --- Phase B: Campaign-Creative Associations + Creative Assets ---

      case 'cm360_associate_creative_campaign': {
        const parsed = AssociateCreativeCampaignInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const assoc = mockStore.associateCreativeCampaign(parsed.data.campaignId, parsed.data.creativeId);
        return { result: assoc, isError: false };
      }

      case 'cm360_list_campaign_creative_associations': {
        const parsed = ListCampaignCreativeAssociationsInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const associations = mockStore.listCampaignCreativeAssociations(parsed.data.campaignId, {
          maxResults: parsed.data.maxResults,
        });
        return { result: { campaignCreativeAssociations: associations }, isError: false };
      }

      case 'cm360_upload_creative_asset': {
        const parsed = UploadCreativeAssetInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const asset = mockStore.uploadCreativeAsset({
          advertiserId: parsed.data.advertiserId,
          assetName: parsed.data.assetName,
          assetType: parsed.data.assetType,
          assetData: parsed.data.assetData,
        });
        return { result: asset, isError: false };
      }

      // --- Phase C: Event Tags ---

      case 'cm360_list_event_tags': {
        const parsed = ListEventTagsInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const eventTags = mockStore.listEventTags(parsed.data.campaignId, {
          advertiserId: parsed.data.advertiserId,
          searchString: parsed.data.searchString,
        });
        return { result: { eventTags }, isError: false };
      }

      case 'cm360_get_event_tag': {
        const parsed = GetEventTagInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const eventTag = mockStore.getEventTag(parsed.data.eventTagId);
        if (!eventTag) {
          return { result: null, isError: true, errorMessage: `Event tag ${parsed.data.eventTagId} not found` };
        }
        return { result: eventTag, isError: false };
      }

      case 'cm360_create_event_tag': {
        const parsed = CreateEventTagInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const eventTag = mockStore.createEventTag({
          advertiserId: parsed.data.advertiserId,
          campaignId: parsed.data.campaignId,
          name: parsed.data.name,
          url: parsed.data.url,
          type: parsed.data.type,
          siteIds: parsed.data.siteIds,
          enabledByDefault: parsed.data.enabledByDefault,
        });
        return { result: eventTag, isError: false };
      }

      case 'cm360_update_event_tag': {
        const parsed = UpdateEventTagInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const updated = mockStore.updateEventTag(parsed.data.eventTagId, {
          name: parsed.data.name,
          url: parsed.data.url,
          status: parsed.data.status,
          siteIds: parsed.data.siteIds,
          enabledByDefault: parsed.data.enabledByDefault,
        });
        if (!updated) {
          return { result: null, isError: true, errorMessage: `Event tag ${parsed.data.eventTagId} not found` };
        }
        return { result: updated, isError: false };
      }

      case 'cm360_list_placement_groups': {
        const parsed = ListPlacementGroupsInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const placementGroups = mockStore.listPlacementGroups(parsed.data.campaignId, {
          advertiserId: parsed.data.advertiserId,
          searchString: parsed.data.searchString,
          maxResults: parsed.data.maxResults,
        });
        return { result: { placementGroups }, isError: false };
      }

      case 'cm360_get_placement_group': {
        const parsed = GetPlacementGroupInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const placementGroup = mockStore.getPlacementGroup(parsed.data.placementGroupId);
        if (!placementGroup) {
          return { result: null, isError: true, errorMessage: `Placement group ${parsed.data.placementGroupId} not found` };
        }
        return { result: placementGroup, isError: false };
      }

      case 'cm360_create_placement_group': {
        const parsed = CreatePlacementGroupInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const group = mockStore.createPlacementGroup({
          campaignId: parsed.data.campaignId,
          siteId: parsed.data.siteId,
          name: parsed.data.name,
          placementGroupType: parsed.data.placementGroupType,
          placementIds: parsed.data.placementIds,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        });
        // Shape parity with the live path: grouping is multi-call there (each
        // placement's placementGroupId is patched), so it reports which placements
        // were grouped and which failed. In demo every requested placement groups
        // cleanly, so failedToGroup is always empty.
        return {
          result: { group, grouped: parsed.data.placementIds ?? [], failedToGroup: [] },
          isError: false,
        };
      }

      case 'cm360_update_placement_group': {
        const parsed = UpdatePlacementGroupInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        // Snapshot membership BEFORE updating so we can diff added vs. removed —
        // mirrors the live path, where membership is reconciled per-placement.
        const reconcile = parsed.data.placementIds !== undefined;
        const before = reconcile
          ? mockStore.getPlacementGroup(parsed.data.placementGroupId)
          : null;
        const group = mockStore.updatePlacementGroup(parsed.data.placementGroupId, {
          name: parsed.data.name,
          activeStatus: parsed.data.activeStatus,
          placementIds: parsed.data.placementIds,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        });
        if (!group) {
          return { result: null, isError: true, errorMessage: `Placement group ${parsed.data.placementGroupId} not found` };
        }
        // Shape parity with the live path: when membership is reconciled, report
        // which placements were added/removed (and any that failed — never in demo).
        if (!reconcile) {
          return { result: { group }, isError: false };
        }
        const desired = parsed.data.placementIds!;
        const currentIds = before?.placementIds ?? [];
        const added = desired.filter((id) => !currentIds.includes(id));
        const removed = currentIds.filter((id) => !desired.includes(id));
        return { result: { group, added, removed, failed: [] }, isError: false };
      }

      // --- Directory Sites ---

      case 'cm360_list_directory_sites': {
        const parsed = ListDirectorySitesInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const dirSites = mockStore.listDirectorySites({
          searchString: parsed.data.searchString,
          active: parsed.data.active,
        });
        return { result: { directorySites: dirSites }, isError: false };
      }

      case 'cm360_get_directory_site': {
        const parsed = GetDirectorySiteInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const dirSite = mockStore.getDirectorySite(parsed.data.directorySiteId);
        if (!dirSite) {
          return { result: null, isError: true, errorMessage: `Directory site ${parsed.data.directorySiteId} not found` };
        }
        return { result: dirSite, isError: false };
      }

      case 'cm360_insert_directory_site': {
        const parsed = InsertDirectorySiteInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        // CM360 `directorySites.insert` returns the created DirectorySite entry —
        // it does NOT approve anything or return a Site. Match the live shape exactly.
        const directorySite = mockStore.insertDirectorySite(parsed.data.siteId);
        return { result: directorySite, isError: false };
      }

      // --- Change Logs ---

      case 'cm360_list_change_logs': {
        const parsed = ListChangeLogsInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const changeLogs = mockStore.listChangeLogs({
          objectType: parsed.data.objectType,
          objectId: parsed.data.objectId,
          action: parsed.data.action,
          minChangeTime: parsed.data.minChangeTime,
          maxChangeTime: parsed.data.maxChangeTime,
          searchString: parsed.data.searchString,
          maxResults: parsed.data.maxResults,
        });
        return { result: { changeLogs }, isError: false };
      }

      case 'cm360_get_change_log': {
        const parsed = GetChangeLogInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const changeLog = mockStore.getChangeLog(parsed.data.changeLogId);
        if (!changeLog) {
          return { result: null, isError: true, errorMessage: `Change log ${parsed.data.changeLogId} not found` };
        }
        return { result: changeLog, isError: false };
      }

      // --- Reports ---

      case 'cm360_list_reports': {
        const parsed = ListReportsInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const reports = mockStore.listReports();
        return { result: { reports, totalResults: reports.length }, isError: false };
      }

      case 'cm360_get_report': {
        const parsed = GetReportInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const report = mockStore.getReport(parsed.data.reportId);
        if (!report) {
          return { result: null, isError: true, errorMessage: `Report ${parsed.data.reportId} not found` };
        }
        return { result: report, isError: false };
      }

      case 'cm360_create_report': {
        const parsed = CreateReportInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const report = mockStore.createReport(parsed.data, parsed.data.profileId);
        return { result: report, isError: false };
      }

      case 'cm360_run_report': {
        const parsed = RunReportInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const file = mockStore.runReport(parsed.data.reportId, parsed.data.profileId);
        if (!file) {
          return { result: null, isError: true, errorMessage: `Report ${parsed.data.reportId} not found` };
        }
        return { result: file, isError: false };
      }

      case 'cm360_get_report_file': {
        const parsed = GetReportFileInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const file = mockStore.getReportFile(parsed.data.fileId);
        if (!file) {
          return { result: null, isError: true, errorMessage: `Report file ${parsed.data.fileId} not found` };
        }
        // EU AI Act Article 50(2) — attach AI-generated metadata to report file output
        const fileWithMeta = {
          ...file,
          _ai_generated: aiReportMetadata(),
        };
        return { result: fileWithMeta, isError: false };
      }

      case 'cm360_query_compatible_fields': {
        const parsed = QueryCompatibleFieldsInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const fields = mockStore.queryCompatibleFields(parsed.data.reportType);
        return { result: fields, isError: false };
      }

      // --- Floodlight Activities ---

      case 'cm360_list_floodlight_activities': {
        const parsed = ListFloodlightActivitiesInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const activities = mockStore.listFloodlightActivities(parsed.data.advertiserId, {
          floodlightActivityGroupId: parsed.data.floodlightActivityGroupId,
          searchString: parsed.data.searchString,
        });
        return { result: { floodlightActivities: activities }, isError: false };
      }

      case 'cm360_get_floodlight_activity': {
        const parsed = GetFloodlightActivityInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const activity = mockStore.getFloodlightActivity(parsed.data.floodlightActivityId);
        if (!activity) {
          return { result: null, isError: true, errorMessage: `Floodlight activity ${parsed.data.floodlightActivityId} not found` };
        }
        return { result: activity, isError: false };
      }

      case 'cm360_create_floodlight_activity': {
        const parsed = CreateFloodlightActivityInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        try {
          const newFlActivity = mockStore.createFloodlightActivity({
            advertiserId: parsed.data.advertiserId,
            floodlightActivityGroupId: parsed.data.floodlightActivityGroupId,
            name: parsed.data.name,
            type: parsed.data.type,
            countingMethod: parsed.data.countingMethod,
            tagString: parsed.data.tagString,
            tagFormat: parsed.data.tagFormat,
            expectedUrl: parsed.data.expectedUrl,
            notes: parsed.data.notes,
          });
          return { result: newFlActivity, isError: false };
        } catch (err) {
          return { result: null, isError: true, errorMessage: err instanceof Error ? err.message : 'Failed to create activity' };
        }
      }

      case 'cm360_generate_floodlight_tag': {
        const parsed = GenerateFloodlightTagInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const flMockTag = mockStore.generateFloodlightTag(parsed.data.floodlightActivityId);
        if (!flMockTag) {
          return { result: null, isError: true, errorMessage: `Floodlight activity ${parsed.data.floodlightActivityId} not found` };
        }
        // EU AI Act Article 50(2) — prepend AI attribution to generated floodlight tag snippets
        const flAttr = aiTagAttribution();
        const flTagWithAttr = {
          ...flMockTag,
          ...(flMockTag.globalSiteTagGlobalSnippet ? { globalSiteTagGlobalSnippet: flAttr + '\n' + flMockTag.globalSiteTagGlobalSnippet } : {}),
          ...(flMockTag.globalSiteTagEventSnippet ? { globalSiteTagEventSnippet: flAttr + '\n' + flMockTag.globalSiteTagEventSnippet } : {}),
          ...(flMockTag.iframeTag ? { iframeTag: flAttr + '\n' + flMockTag.iframeTag } : {}),
          ...(flMockTag.imageTag ? { imageTag: flAttr + '\n' + flMockTag.imageTag } : {}),
        };
        return { result: flTagWithAttr, isError: false };
      }

      case 'cm360_list_floodlight_activity_groups': {
        const parsed = ListFloodlightActivityGroupsInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const flGroups = mockStore.listFloodlightActivityGroups(parsed.data.advertiserId, {
          searchString: parsed.data.searchString,
        });
        return { result: { floodlightActivityGroups: flGroups }, isError: false };
      }

      case 'cm360_get_floodlight_activity_group': {
        const parsed = GetFloodlightActivityGroupInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const flGroup = mockStore.getFloodlightActivityGroup(parsed.data.floodlightActivityGroupId);
        if (!flGroup) {
          return { result: null, isError: true, errorMessage: `Floodlight activity group ${parsed.data.floodlightActivityGroupId} not found` };
        }
        return { result: flGroup, isError: false };
      }

      case 'cm360_create_floodlight_activity_group': {
        const parsed = CreateFloodlightActivityGroupInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        try {
          const newFlGroup = mockStore.createFloodlightActivityGroup({
            advertiserId: parsed.data.advertiserId,
            name: parsed.data.name,
            type: parsed.data.type,
            tagString: parsed.data.tagString,
          });
          return { result: newFlGroup, isError: false };
        } catch (err) {
          return { result: null, isError: true, errorMessage: err instanceof Error ? err.message : 'Failed to create activity group' };
        }
      }

      case 'cm360_list_floodlight_configurations': {
        const parsed = ListFloodlightConfigurationsInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const configs = mockStore.listFloodlightConfigurations(parsed.data.advertiserId);
        return { result: { floodlightConfigurations: configs }, isError: false };
      }

      // --- Pacing Analysis ---
      case 'cm360_pacing_analysis': {
        const parsed = PacingAnalysisInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const analysis = mockStore.getPacingAnalysis(parsed.data.campaignId);
        return { result: analysis, isError: false };
      }

      // ── User & Role Management (mock) ────────────────────────────
      case 'cm360_list_account_user_profiles': {
        const parsed = ListAccountUserProfilesInputSchema.safeParse(toolInput);
        if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        const data = mockStore.listAccountUserProfiles(parsed.data);
        return { result: { accountUserProfiles: data, totalResults: data.length }, isError: false };
      }
      case 'cm360_get_account_user_profile': {
        const parsed = GetAccountUserProfileInputSchema.safeParse(toolInput);
        if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        const user = mockStore.getAccountUserProfile(parsed.data.accountUserProfileId);
        if (!user) return { result: null, isError: true, errorMessage: `Account user profile ${parsed.data.accountUserProfileId} not found` };
        return { result: user, isError: false };
      }
      case 'cm360_create_account_user_profile': {
        const parsed = CreateAccountUserProfileInputSchema.safeParse(toolInput);
        if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        const { profileId: _, ...input } = parsed.data;
        const created = mockStore.createAccountUserProfile(input);
        return { result: created, isError: false };
      }
      case 'cm360_list_user_roles': {
        const parsed = ListUserRolesInputSchema.safeParse(toolInput);
        if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        const data = mockStore.listUserRoles(parsed.data);
        return { result: { userRoles: data, totalResults: data.length }, isError: false };
      }
      case 'cm360_get_user_role': {
        const parsed = GetUserRoleInputSchema.safeParse(toolInput);
        if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        const role = mockStore.getUserRole(parsed.data.userRoleId);
        if (!role) return { result: null, isError: true, errorMessage: `User role ${parsed.data.userRoleId} not found` };
        return { result: role, isError: false };
      }
      case 'cm360_create_user_role': {
        const parsed = CreateUserRoleInputSchema.safeParse(toolInput);
        if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        const { profileId: _, ...input } = parsed.data;
        const created = mockStore.createUserRole(input);
        if (!created) return { result: null, isError: true, errorMessage: `Parent role ${input.parentUserRoleId} not found` };
        return { result: created, isError: false };
      }
      case 'cm360_list_user_role_permissions': {
        const parsed = ListUserRolePermissionsInputSchema.safeParse(toolInput);
        if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        const data = mockStore.listUserRolePermissions();
        return { result: { userRolePermissions: data, totalResults: data.length }, isError: false };
      }
      case 'cm360_get_user_role_permission': {
        const parsed = GetUserRolePermissionInputSchema.safeParse(toolInput);
        if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        const perm = mockStore.getUserRolePermission(parsed.data.permissionId);
        if (!perm) return { result: null, isError: true, errorMessage: `User role permission ${parsed.data.permissionId} not found` };
        return { result: perm, isError: false };
      }
      case 'cm360_list_user_role_permission_groups': {
        const parsed = ListUserRolePermissionGroupsInputSchema.safeParse(toolInput);
        if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        const data = mockStore.listUserRolePermissionGroups();
        return { result: { userRolePermissionGroups: data, totalResults: data.length }, isError: false };
      }
      case 'cm360_get_user_role_permission_group': {
        const parsed = GetUserRolePermissionGroupInputSchema.safeParse(toolInput);
        if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        const group = mockStore.getUserRolePermissionGroup(parsed.data.permissionGroupId);
        if (!group) return { result: null, isError: true, errorMessage: `User role permission group ${parsed.data.permissionGroupId} not found` };
        return { result: group, isError: false };
      }
      case 'cm360_list_subaccounts': {
        const parsed = ListSubaccountsInputSchema.safeParse(toolInput);
        if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        const data = mockStore.listSubaccounts(parsed.data);
        return { result: { subaccounts: data, totalResults: data.length }, isError: false };
      }
      case 'cm360_get_subaccount': {
        const parsed = GetSubaccountInputSchema.safeParse(toolInput);
        if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        const sub = mockStore.getSubaccount(parsed.data.subaccountId);
        if (!sub) return { result: null, isError: true, errorMessage: `Subaccount ${parsed.data.subaccountId} not found` };
        return { result: sub, isError: false };
      }

      default:
        return { result: null, isError: true, errorMessage: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return {
      result: null,
      isError: true,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
