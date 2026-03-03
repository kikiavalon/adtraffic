/**
 * Tool executor — dispatches Claude tool_use calls to either:
 *   1. Real CM360 API via @googleapis/dfareporting (when user has connected their account)
 *   2. Mock data store (when no userId provided, or user hasn't connected CM360)
 *
 * All inputs are validated with Zod schemas before reaching either backend.
 *
 * The userId parameter is optional to preserve backward compatibility with all
 * existing tests (875+) that call executeTool(name, input) without a userId.
 */

import { mockStore } from './mock-data-store.js';
// Real CM360 modules (token-manager, cm360-client) are dynamically imported
// to avoid DB initialization when only the mock path is used.
// errors.ts and api-rate-limiter.ts have no DB deps and can be static.
import type { CM360Client } from './cm360-client.js';
import { CM360NotConnectedError, CM360TokenRevokedError, CM360APIError } from './errors.js';
import { checkCM360RateLimit, recordCM360Request } from './api-rate-limiter.js';
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
  DeleteEventTagInputSchema,
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
}

/**
 * Execute a CM360 tool call and return the result.
 *
 * When userId is provided, attempts to use the real CM360 API.
 * Falls back to mock data if the user hasn't connected their CM360 account.
 * Returns an error if tokens have been revoked (user must reconnect).
 *
 * When userId is omitted, always uses mock data (test path).
 */
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId?: string,
): Promise<ToolResult> {
  // No userId → always mock (backward compat for tests)
  if (!userId) {
    return executeToolMock(toolName, toolInput);
  }

  // Validate the tool name first (before attempting real API)
  if (!isValidToolName(toolName)) {
    return { result: null, isError: true, errorMessage: `Unknown tool: ${toolName}` };
  }

  // Dynamically import modules with DB dependencies (avoids DB init on mock path)
  const [
    { getCM360Client },
    { CM360Client: CM360ClientClass },
  ] = await Promise.all([
    import('./token-manager.js'),
    import('./cm360-client.js'),
  ]);

  // Try real API path
  try {
    const api = await getCM360Client(userId);

    // Check rate limit before making the API call
    const rateCheck = checkCM360RateLimit(userId);
    if (!rateCheck.allowed) {
      const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 5000) / 1000);
      return {
        result: null,
        isError: true,
        errorMessage: `CM360 API rate limit reached. Please wait ${retrySeconds} seconds before trying again.`,
      };
    }

    const client = new CM360ClientClass(api);
    const result = await executeToolReal(toolName, toolInput, client, userId);
    recordCM360Request(userId);
    return result;
  } catch (err) {
    // Not connected → fall back to mock
    if (err instanceof CM360NotConnectedError) {
      return executeToolMock(toolName, toolInput);
    }

    // Token revoked → user must reconnect
    if (err instanceof CM360TokenRevokedError) {
      return {
        result: null,
        isError: true,
        errorMessage: err.message,
      };
    }

    // Google API error → surface to user
    if (err instanceof CM360APIError) {
      return {
        result: null,
        isError: true,
        errorMessage: err.message,
      };
    }

    // Unexpected error
    return {
      result: null,
      isError: true,
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

const VALID_TOOL_NAMES = new Set([
  'cm360_list_profiles',
  'cm360_list_advertisers',
  'cm360_get_advertiser',
  'cm360_list_campaigns',
  'cm360_create_campaign',
  'cm360_list_sites',
  'cm360_list_landing_pages',
  'cm360_create_landing_page',
  'cm360_list_placements',
  'cm360_create_placement',
  'cm360_list_creatives',
  'cm360_list_ads',
  'cm360_create_ad',
  'cm360_generate_tags',
  'cm360_get_campaign',
  'cm360_get_placement',
  'cm360_get_ad',
  'cm360_update_campaign',
  'cm360_update_placement',
  'cm360_update_ad',
  'cm360_update_creative',
  'cm360_update_landing_page',
  'cm360_get_creative',
  'cm360_create_creative',
  'cm360_get_landing_page',
  'cm360_get_site',
  'cm360_list_sizes',
  'cm360_associate_creative_campaign',
  'cm360_list_campaign_creative_associations',
  'cm360_upload_creative_asset',
  // Event tags
  'cm360_list_event_tags',
  'cm360_get_event_tag',
  'cm360_create_event_tag',
  'cm360_update_event_tag',
  'cm360_delete_event_tag',
  // Placement groups
  'cm360_list_placement_groups',
  'cm360_get_placement_group',
  'cm360_create_placement_group',
  'cm360_update_placement_group',
  // Directory sites
  'cm360_list_directory_sites',
  'cm360_get_directory_site',
  'cm360_insert_directory_site',
  // Change logs
  'cm360_list_change_logs',
  'cm360_get_change_log',
  // Reports
  'cm360_list_reports',
  'cm360_get_report',
  'cm360_create_report',
  'cm360_run_report',
  'cm360_get_report_file',
  'cm360_query_compatible_fields',
  // Floodlight
  'cm360_list_floodlight_activities',
  'cm360_get_floodlight_activity',
  'cm360_create_floodlight_activity',
  'cm360_generate_floodlight_tag',
  'cm360_list_floodlight_activity_groups',
  'cm360_get_floodlight_activity_group',
  'cm360_create_floodlight_activity_group',
  'cm360_list_floodlight_configurations',
  // Pacing analysis
  'cm360_pacing_analysis',
  // User & Role Management
  'cm360_list_account_user_profiles',
  'cm360_get_account_user_profile',
  'cm360_create_account_user_profile',
  'cm360_list_user_roles',
  'cm360_get_user_role',
  'cm360_create_user_role',
  'cm360_list_user_role_permissions',
  'cm360_get_user_role_permission',
  'cm360_list_user_role_permission_groups',
  'cm360_get_user_role_permission_group',
  'cm360_list_subaccounts',
  'cm360_get_subaccount',
]);

function isValidToolName(name: string): boolean {
  return VALID_TOOL_NAMES.has(name);
}

/**
 * Execute a tool call against the real CM360 API.
 *
 * The CM360Client needs a profileId for most operations. For simplicity,
 * we auto-resolve it by calling listProfiles() and using the first profile.
 * This adds one extra API call but simplifies the tool interface — users
 * don't need to know or provide their profileId.
 */
async function executeToolReal(
  toolName: string,
  toolInput: Record<string, unknown>,
  client: CM360Client,
  _userId: string,
): Promise<ToolResult> {
  switch (toolName) {
    case 'cm360_list_profiles': {
      const parsed = ListProfilesInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profiles = await client.listProfiles();
      return { result: { profiles }, isError: false };
    }

    case 'cm360_list_advertisers': {
      const parsed = ListAdvertisersInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const advertisers = await client.listAdvertisers(profileId, {
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
      const profileId = await resolveProfileId(client);
      const adv = await client.getAdvertiser(profileId, parsed.data.advertiserId);
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
      const profileId = await resolveProfileId(client);
      const campaigns = await client.listCampaigns(profileId, {
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
      const profileId = await resolveProfileId(client);
      const campaign = await client.createCampaign(profileId, {
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
      const profileId = await resolveProfileId(client);
      const sites = await client.listSites(profileId, {
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
      const profileId = await resolveProfileId(client);
      const landingPages = await client.listLandingPages(profileId, {
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
      const profileId = await resolveProfileId(client);
      const page = await client.createLandingPage(profileId, {
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
      const profileId = await resolveProfileId(client);
      const placements = await client.listPlacements(profileId, {
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
      const profileId = await resolveProfileId(client);
      const placement = await client.createPlacement(profileId, {
        campaignId: parsed.data.campaignId,
        siteId: parsed.data.siteId,
        name: parsed.data.name,
        size: { width: parsed.data.width, height: parsed.data.height },
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
      const profileId = await resolveProfileId(client);
      const creatives = await client.listCreatives(profileId, {
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
      const profileId = await resolveProfileId(client);
      const ads = await client.listAds(profileId, {
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
      const profileId = await resolveProfileId(client);
      const ad = await client.createAd(profileId, {
        campaignId: parsed.data.campaignId,
        name: parsed.data.name,
        placementIds: parsed.data.placementIds,
        creativeId: parsed.data.creativeId,
      });
      return { result: ad, isError: false };
    }

    case 'cm360_generate_tags': {
      const parsed = GenerateTagsInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const tags = await client.generateTags(
        profileId,
        parsed.data.campaignId,
        parsed.data.placementIds,
      );
      return { result: { placementTags: tags }, isError: false };
    }

    // --- Get single entity tools ---

    case 'cm360_get_campaign': {
      const parsed = GetCampaignInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const campaign = await client.getCampaign(profileId, parsed.data.campaignId);
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
      const profileId = await resolveProfileId(client);
      const placement = await client.getPlacement(profileId, parsed.data.placementId);
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
      const profileId = await resolveProfileId(client);
      const ad = await client.getAd(profileId, parsed.data.adId);
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
      const profileId = await resolveProfileId(client);
      const updated = await client.patchCampaign(profileId, parsed.data.campaignId, parsed.data);
      return { result: updated, isError: false };
    }

    case 'cm360_update_placement': {
      const parsed = UpdatePlacementInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const updated = await client.patchPlacement(profileId, parsed.data.placementId, parsed.data);
      return { result: updated, isError: false };
    }

    case 'cm360_update_ad': {
      const parsed = UpdateAdInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const updated = await client.patchAd(profileId, parsed.data.adId, parsed.data);
      return { result: updated, isError: false };
    }

    case 'cm360_update_creative': {
      const parsed = UpdateCreativeInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const updated = await client.patchCreative(profileId, parsed.data.creativeId, parsed.data);
      return { result: updated, isError: false };
    }

    case 'cm360_update_landing_page': {
      const parsed = UpdateLandingPageInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const updated = await client.patchLandingPage(profileId, parsed.data.landingPageId, parsed.data);
      return { result: updated, isError: false };
    }

    // --- Phase A: CRUD gap tools ---

    case 'cm360_get_creative': {
      const parsed = GetCreativeInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const creative = await client.getCreative(profileId, parsed.data.creativeId);
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
      const profileId = await resolveProfileId(client);
      const creative = await client.createCreative(profileId, {
        advertiserId: parsed.data.advertiserId,
        name: parsed.data.name,
        type: parsed.data.type,
        size: { width: parsed.data.width, height: parsed.data.height },
        active: parsed.data.active,
      });
      return { result: creative, isError: false };
    }

    case 'cm360_get_landing_page': {
      const parsed = GetLandingPageInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const page = await client.getLandingPage(profileId, parsed.data.landingPageId);
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
      const profileId = await resolveProfileId(client);
      const site = await client.getSite(profileId, parsed.data.siteId);
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
      const profileId = await resolveProfileId(client);
      const sizes = await client.listSizes(profileId, {
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
      const profileId = await resolveProfileId(client);
      const assoc = await client.associateCreativeCampaign(profileId, parsed.data.campaignId, parsed.data.creativeId);
      return { result: assoc, isError: false };
    }

    case 'cm360_list_campaign_creative_associations': {
      const parsed = ListCampaignCreativeAssociationsInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const associations = await client.listCampaignCreativeAssociations(profileId, parsed.data.campaignId, {
        maxResults: parsed.data.maxResults,
      });
      return { result: { campaignCreativeAssociations: associations }, isError: false };
    }

    case 'cm360_upload_creative_asset': {
      const parsed = UploadCreativeAssetInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const asset = await client.uploadCreativeAsset(
        profileId,
        parsed.data.advertiserId,
        parsed.data.assetName,
        parsed.data.assetType,
        parsed.data.assetData,
      );
      return { result: asset, isError: false };
    }

    // --- Phase C: Event Tags ---

    case 'cm360_list_event_tags': {
      const parsed = ListEventTagsInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      // TODO: Implement real CM360 API call — client.listEventTags()
      return { result: null, isError: true, errorMessage: 'Event tag tools are not implemented in live mode yet. Please use demo mode.' };
    }

    case 'cm360_get_event_tag': {
      const parsed = GetEventTagInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      return { result: null, isError: true, errorMessage: 'Event tag tools are not implemented in live mode yet. Please use demo mode.' };
    }

    case 'cm360_create_event_tag': {
      const parsed = CreateEventTagInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      return { result: null, isError: true, errorMessage: 'Event tag tools are not implemented in live mode yet. Please use demo mode.' };
    }

    case 'cm360_update_event_tag': {
      const parsed = UpdateEventTagInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      return { result: null, isError: true, errorMessage: 'Event tag tools are not implemented in live mode yet. Please use demo mode.' };
    }

    case 'cm360_delete_event_tag': {
      const parsed = DeleteEventTagInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      return { result: null, isError: true, errorMessage: 'Event tag tools are not implemented in live mode yet. Please use demo mode.' };
    }

    case 'cm360_list_placement_groups': {
      const parsed = ListPlacementGroupsInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      // TODO: Implement real CM360 API call — client.listPlacementGroups()
      return { result: null, isError: true, errorMessage: 'Placement group tools are not implemented in live mode yet. Please use demo mode.' };
    }

    case 'cm360_get_placement_group': {
      const parsed = GetPlacementGroupInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      return { result: null, isError: true, errorMessage: 'Placement group tools are not implemented in live mode yet. Please use demo mode.' };
    }

    case 'cm360_create_placement_group': {
      const parsed = CreatePlacementGroupInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      return { result: null, isError: true, errorMessage: 'Placement group tools are not implemented in live mode yet. Please use demo mode.' };
    }

    case 'cm360_update_placement_group': {
      const parsed = UpdatePlacementGroupInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      return { result: null, isError: true, errorMessage: 'Placement group tools are not implemented in live mode yet. Please use demo mode.' };
    }

    // --- Directory Sites ---

    case 'cm360_list_directory_sites': {
      const parsed = ListDirectorySitesInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      return { result: null, isError: true, errorMessage: 'Directory site tools are not implemented in live mode yet. Please use demo mode.' };
    }

    case 'cm360_get_directory_site': {
      const parsed = GetDirectorySiteInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      return { result: null, isError: true, errorMessage: 'Directory site tools are not implemented in live mode yet. Please use demo mode.' };
    }

    case 'cm360_insert_directory_site': {
      const parsed = InsertDirectorySiteInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      return { result: null, isError: true, errorMessage: 'Directory site tools are not implemented in live mode yet. Please use demo mode.' };
    }

    // --- Change Logs ---

    case 'cm360_list_change_logs': {
      const parsed = ListChangeLogsInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      return { result: null, isError: true, errorMessage: 'Change log tools are not implemented in live mode yet. Please use demo mode.' };
    }

    case 'cm360_get_change_log': {
      const parsed = GetChangeLogInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      return { result: null, isError: true, errorMessage: 'Change log tools are not implemented in live mode yet. Please use demo mode.' };
    }

    // --- Reports ---

    case 'cm360_list_reports': {
      const parsed = ListReportsInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const data = await client.listReports(profileId);
      return { result: { reports: data, totalResults: data.length }, isError: false };
    }

    case 'cm360_get_report': {
      const parsed = GetReportInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const report = await client.getReport(profileId, parsed.data.reportId);
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
      const profileId = await resolveProfileId(client);
      const report = await client.createReport(profileId, parsed.data);
      return { result: report, isError: false };
    }

    case 'cm360_run_report': {
      const parsed = RunReportInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const file = await client.runReport(profileId, parsed.data.reportId);
      return { result: file, isError: false };
    }

    case 'cm360_get_report_file': {
      const parsed = GetReportFileInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const file = await client.getReportFile(profileId, parsed.data.reportId, parsed.data.fileId, parsed.data.maxRows);
      if (!file) {
        return { result: null, isError: true, errorMessage: `Report file ${parsed.data.fileId} not found` };
      }
      return { result: file, isError: false };
    }

    case 'cm360_query_compatible_fields': {
      const parsed = QueryCompatibleFieldsInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const profileId = await resolveProfileId(client);
      const fields = await client.queryCompatibleFields(profileId, parsed.data.reportType);
      return { result: fields, isError: false };
    }

    // --- Floodlight Activities ---

    case 'cm360_list_floodlight_activities': {
      const parsed = ListFloodlightActivitiesInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const flProfileId = await resolveProfileId(client);
      const activities = await client.listFloodlightActivities(flProfileId, parsed.data.advertiserId, {
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
      const gfaProfileId = await resolveProfileId(client);
      const flActivity = await client.getFloodlightActivity(gfaProfileId, parsed.data.floodlightActivityId);
      if (!flActivity) {
        return { result: null, isError: true, errorMessage: `Floodlight activity ${parsed.data.floodlightActivityId} not found` };
      }
      return { result: flActivity, isError: false };
    }

    case 'cm360_create_floodlight_activity': {
      const parsed = CreateFloodlightActivityInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const cfaProfileId = await resolveProfileId(client);
      const newActivity = await client.createFloodlightActivity(cfaProfileId, {
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
      return { result: newActivity, isError: false };
    }

    case 'cm360_generate_floodlight_tag': {
      const parsed = GenerateFloodlightTagInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const gftProfileId = await resolveProfileId(client);
      const flTag = await client.generateFloodlightTag(gftProfileId, parsed.data.floodlightActivityId);
      return { result: flTag, isError: false };
    }

    case 'cm360_list_floodlight_activity_groups': {
      const parsed = ListFloodlightActivityGroupsInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const lagProfileId = await resolveProfileId(client);
      const groups = await client.listFloodlightActivityGroups(lagProfileId, parsed.data.advertiserId, {
        searchString: parsed.data.searchString,
      });
      return { result: { floodlightActivityGroups: groups }, isError: false };
    }

    case 'cm360_get_floodlight_activity_group': {
      const parsed = GetFloodlightActivityGroupInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const gagProfileId = await resolveProfileId(client);
      const flGroup = await client.getFloodlightActivityGroup(gagProfileId, parsed.data.floodlightActivityGroupId);
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
      const cagProfileId = await resolveProfileId(client);
      const newGroup = await client.createFloodlightActivityGroup(cagProfileId, {
        advertiserId: parsed.data.advertiserId,
        name: parsed.data.name,
        type: parsed.data.type,
        tagString: parsed.data.tagString,
      });
      return { result: newGroup, isError: false };
    }

    case 'cm360_list_floodlight_configurations': {
      const parsed = ListFloodlightConfigurationsInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const lcProfileId = await resolveProfileId(client);
      const configs = await client.listFloodlightConfigurations(lcProfileId, parsed.data.advertiserId);
      return { result: { floodlightConfigurations: configs }, isError: false };
    }

    // --- Pacing Analysis (computed from placement data) ---
    case 'cm360_pacing_analysis': {
      const parsed = PacingAnalysisInputSchema.safeParse(toolInput);
      if (!parsed.success) {
        return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      }
      const paProfileId = await resolveProfileId(client);
      // Fetch real placements for the campaign from CM360 API
      const realPlacements = await client.listPlacements(paProfileId, {
        campaignId: parsed.data.campaignId,
        maxResults: 500,
      });
      if (realPlacements.length === 0) {
        return {
          result: {
            error: `No placements found for campaign ${parsed.data.campaignId}. Pacing analysis requires placements with pricing schedules.`,
          },
          isError: true,
        };
      }
      // Also fetch the campaign for its name
      const paCampaign = await client.getCampaign(paProfileId, parsed.data.campaignId);
      if (!paCampaign) {
        return { result: { error: `Campaign ${parsed.data.campaignId} not found` }, isError: true };
      }
      // Compute time-based pacing from real placement metadata
      const analysis = computePacingFromPlacements(paCampaign.name, realPlacements);
      return { result: analysis, isError: false };
    }

    // ── User & Role Management ────────────────────────────────────
    case 'cm360_list_account_user_profiles': {
      const parsed = ListAccountUserProfilesInputSchema.safeParse(toolInput);
      if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      const profileId = await resolveProfileId(client);
      const { profileId: _, ...filter } = parsed.data;
      const data = await client.listAccountUserProfiles(profileId, filter);
      return { result: { accountUserProfiles: data, totalResults: data.length }, isError: false };
    }
    case 'cm360_get_account_user_profile': {
      const parsed = GetAccountUserProfileInputSchema.safeParse(toolInput);
      if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      const profileId = await resolveProfileId(client);
      const user = await client.getAccountUserProfile(profileId, parsed.data.accountUserProfileId);
      if (!user) return { result: null, isError: true, errorMessage: `Account user profile ${parsed.data.accountUserProfileId} not found` };
      return { result: user, isError: false };
    }
    case 'cm360_create_account_user_profile': {
      const parsed = CreateAccountUserProfileInputSchema.safeParse(toolInput);
      if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      const profileId = await resolveProfileId(client);
      const { profileId: _, ...input } = parsed.data;
      const created = await client.createAccountUserProfile(profileId, input);
      return { result: created, isError: false };
    }
    case 'cm360_list_user_roles': {
      const parsed = ListUserRolesInputSchema.safeParse(toolInput);
      if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      const profileId = await resolveProfileId(client);
      const { profileId: _, ...filter } = parsed.data;
      const data = await client.listUserRoles(profileId, filter);
      return { result: { userRoles: data, totalResults: data.length }, isError: false };
    }
    case 'cm360_get_user_role': {
      const parsed = GetUserRoleInputSchema.safeParse(toolInput);
      if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      const profileId = await resolveProfileId(client);
      const role = await client.getUserRole(profileId, parsed.data.userRoleId);
      if (!role) return { result: null, isError: true, errorMessage: `User role ${parsed.data.userRoleId} not found` };
      return { result: role, isError: false };
    }
    case 'cm360_create_user_role': {
      const parsed = CreateUserRoleInputSchema.safeParse(toolInput);
      if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      const profileId = await resolveProfileId(client);
      const { profileId: _, ...input } = parsed.data;
      const created = await client.createUserRole(profileId, input);
      return { result: created, isError: false };
    }
    case 'cm360_list_user_role_permissions': {
      const parsed = ListUserRolePermissionsInputSchema.safeParse(toolInput);
      if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      const profileId = await resolveProfileId(client);
      const data = await client.listUserRolePermissions(profileId);
      return { result: { userRolePermissions: data, totalResults: data.length }, isError: false };
    }
    case 'cm360_get_user_role_permission': {
      const parsed = GetUserRolePermissionInputSchema.safeParse(toolInput);
      if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      const profileId = await resolveProfileId(client);
      const perm = await client.getUserRolePermission(profileId, parsed.data.permissionId);
      if (!perm) return { result: null, isError: true, errorMessage: `User role permission ${parsed.data.permissionId} not found` };
      return { result: perm, isError: false };
    }
    case 'cm360_list_user_role_permission_groups': {
      const parsed = ListUserRolePermissionGroupsInputSchema.safeParse(toolInput);
      if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      const profileId = await resolveProfileId(client);
      const data = await client.listUserRolePermissionGroups(profileId);
      return { result: { userRolePermissionGroups: data, totalResults: data.length }, isError: false };
    }
    case 'cm360_get_user_role_permission_group': {
      const parsed = GetUserRolePermissionGroupInputSchema.safeParse(toolInput);
      if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      const profileId = await resolveProfileId(client);
      const group = await client.getUserRolePermissionGroup(profileId, parsed.data.permissionGroupId);
      if (!group) return { result: null, isError: true, errorMessage: `User role permission group ${parsed.data.permissionGroupId} not found` };
      return { result: group, isError: false };
    }
    case 'cm360_list_subaccounts': {
      const parsed = ListSubaccountsInputSchema.safeParse(toolInput);
      if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      const profileId = await resolveProfileId(client);
      const { profileId: _, ...filter } = parsed.data;
      const data = await client.listSubaccounts(profileId, filter);
      return { result: { subaccounts: data, totalResults: data.length }, isError: false };
    }
    case 'cm360_get_subaccount': {
      const parsed = GetSubaccountInputSchema.safeParse(toolInput);
      if (!parsed.success) return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
      const profileId = await resolveProfileId(client);
      const sub = await client.getSubaccount(profileId, parsed.data.subaccountId);
      if (!sub) return { result: null, isError: true, errorMessage: `Subaccount ${parsed.data.subaccountId} not found` };
      return { result: sub, isError: false };
    }

    default:
      return { result: null, isError: true, errorMessage: `Unknown tool: ${toolName}` };
  }
}

/**
 * Resolve the user's CM360 profile ID by listing profiles and using the first one.
 * Cached per CM360Client instance via a module-level WeakMap to avoid repeated calls.
 */
const profileCache = new WeakMap<CM360Client, string>();

async function resolveProfileId(client: CM360Client): Promise<string> {
  const cached = profileCache.get(client);
  if (cached) return cached;

  const profiles = await client.listProfiles();
  if (profiles.length === 0) {
    throw new CM360APIError('No CM360 user profiles found. Ensure your account has CM360 access.', 403);
  }

  const profileId = profiles[0]!.profileId;
  profileCache.set(client, profileId);
  return profileId;
}

/**
 * Compute pacing analysis from real CM360 placement data.
 * Uses placement flight dates and pricing schedules to compute time-based pacing.
 * Note: Actual impression delivery data requires running a CM360 report.
 * This provides time-based pacing from metadata only.
 */
function computePacingFromPlacements(campaignName: string, placements: import('@adtraffic/shared').CM360Placement[]) {
  const today = new Date();
  const analysisDate = today.toISOString().slice(0, 10);

  const pacingPlacements = placements
    .filter(p => p.pricingSchedule.pricingPeriods && p.pricingSchedule.pricingPeriods.length > 0)
    .map(p => {
      const period = p.pricingSchedule.pricingPeriods![0]!;
      const flightStart = new Date(p.pricingSchedule.startDate);
      const flightEnd = new Date(p.pricingSchedule.endDate);
      const totalFlightMs = flightEnd.getTime() - flightStart.getTime();
      const totalFlightDays = Math.max(1, Math.ceil(totalFlightMs / (1000 * 60 * 60 * 24)));

      let daysElapsed: number;
      let daysRemaining: number;
      let status: 'ahead' | 'behind' | 'on_track' | 'completed' | 'not_started';

      if (today < flightStart) {
        daysElapsed = 0;
        daysRemaining = totalFlightDays;
        status = 'not_started';
      } else if (today > flightEnd) {
        daysElapsed = totalFlightDays;
        daysRemaining = 0;
        status = 'completed';
      } else {
        const elapsedMs = today.getTime() - flightStart.getTime();
        daysElapsed = Math.ceil(elapsedMs / (1000 * 60 * 60 * 24));
        daysRemaining = totalFlightDays - daysElapsed;
        status = 'on_track';
      }

      const percentTimeElapsed = Math.round((daysElapsed / totalFlightDays) * 1000) / 10;
      const impressionsGoal = period.units;
      const impressionsExpected = Math.round(impressionsGoal * (daysElapsed / totalFlightDays));

      // Compute spend from pricing (time-based estimate since we don't have delivery data)
      const ratePerThousand = period.rateOrCostNanos / 1_000_000_000;
      const budget = Math.round((impressionsGoal / 1000) * ratePerThousand * 100) / 100;
      const spendExpected = Math.round((impressionsExpected / 1000) * ratePerThousand * 100) / 100;

      return {
        placementId: p.id,
        placementName: p.name,
        compatibility: p.compatibility,
        size: `${p.size.width}x${p.size.height}`,
        flightStart: p.pricingSchedule.startDate,
        flightEnd: p.pricingSchedule.endDate,
        daysElapsed,
        daysRemaining,
        percentTimeElapsed,
        impressionsGoal,
        impressionsExpected,
        impressionsDelivered: null as number | null,
        impressionsPacingPercent: null as number | null,
        impressionsStatus: status,
        budget,
        spendExpected,
        spend: null as number | null,
        spendPacingPercent: null as number | null,
        note: 'Delivery data (impressions/spend) requires running a CM360 report. Time-based pacing shown.',
      };
    });

  // Overall status: worst-case across placements
  const statusPriority: Record<string, number> = { behind: 0, on_track: 1, ahead: 2, not_started: 3, completed: 4 };
  const overallStatus = pacingPlacements.length === 0
    ? 'not_started' as const
    : pacingPlacements.reduce((worst, p) =>
        statusPriority[p.impressionsStatus]! < statusPriority[worst]!
          ? p.impressionsStatus
          : worst,
      'completed' as 'ahead' | 'behind' | 'on_track' | 'completed' | 'not_started');

  const summary = `Campaign "${campaignName}" pacing analysis as of ${analysisDate}: `
    + `${pacingPlacements.length} placements analyzed. `
    + `Note: Impression delivery data requires running a CM360 report (cm360_run_report). `
    + `Time-based flight pacing shown.`;

  return {
    campaignName,
    analysisDate,
    overallStatus,
    placements: pacingPlacements,
    summary,
  };
}

/**
 * Execute a tool call against the mock data store.
 * This is the original implementation preserved for backward compatibility.
 */
function executeToolMock(
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
        return { result: { placementTags: tags }, isError: false };
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
          id: parsed.data.eventTagId,
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

      case 'cm360_delete_event_tag': {
        const parsed = DeleteEventTagInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const deleted = mockStore.deleteEventTag(parsed.data.eventTagId);
        if (!deleted) {
          return { result: null, isError: true, errorMessage: `Event tag ${parsed.data.eventTagId} not found` };
        }
        return { result: { success: true, message: `Event tag ${parsed.data.eventTagId} deleted` }, isError: false };
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
        const placementGroup = mockStore.createPlacementGroup({
          campaignId: parsed.data.campaignId,
          siteId: parsed.data.siteId,
          name: parsed.data.name,
          placementGroupType: parsed.data.placementGroupType,
          placementIds: parsed.data.placementIds,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        });
        return { result: placementGroup, isError: false };
      }

      case 'cm360_update_placement_group': {
        const parsed = UpdatePlacementGroupInputSchema.safeParse(toolInput);
        if (!parsed.success) {
          return { result: { error: 'Invalid input', details: formatZodErrors(parsed.error) }, isError: true };
        }
        const updated = mockStore.updatePlacementGroup(parsed.data.placementGroupId, {
          name: parsed.data.name,
          activeStatus: parsed.data.activeStatus,
          placementIds: parsed.data.placementIds,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        });
        if (!updated) {
          return { result: null, isError: true, errorMessage: `Placement group ${parsed.data.placementGroupId} not found` };
        }
        return { result: updated, isError: false };
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
        return { result: { directorySites: dirSites, totalResults: dirSites.length }, isError: false };
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
        const site = mockStore.insertDirectorySite(parsed.data.siteId);
        return { result: { message: `Directory site approved and added as trafficking target`, site }, isError: false };
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
        return { result: { changeLogs, totalResults: changeLogs.length }, isError: false };
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
        return { result: file, isError: false };
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
        const tag = mockStore.generateFloodlightTag(parsed.data.floodlightActivityId);
        if (!tag) {
          return { result: null, isError: true, errorMessage: `Floodlight activity ${parsed.data.floodlightActivityId} not found` };
        }
        return { result: tag, isError: false };
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
