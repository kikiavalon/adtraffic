/**
 * Tool executor — dispatches Claude tool_use calls to the mock CM360 data store.
 * All inputs are validated with Zod schemas before reaching the data store.
 * Will be replaced with real @googleapis/dfareporting calls when a CM360 account is connected.
 */

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
  formatZodErrors,
} from './tool-input-schemas.js';

export interface ToolResult {
  result: unknown;
  isError: boolean;
  errorMessage?: string;
}

/**
 * Execute a CM360 tool call and return the result.
 */
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<ToolResult> {
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
        );
        return { result: { placementTags: tags }, isError: false };
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
