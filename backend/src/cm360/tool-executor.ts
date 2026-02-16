/**
 * Tool executor — dispatches Claude tool_use calls to the mock CM360 data store.
 * Will be replaced with real @googleapis/dfareporting calls when a CM360 account is connected.
 */

import { mockStore } from './mock-data-store.js';

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
      case 'cm360_list_profiles':
        return { result: { profiles: mockStore.listProfiles() }, isError: false };

      case 'cm360_list_advertisers': {
        const advertisers = mockStore.listAdvertisers({
          searchString: toolInput.searchString as string | undefined,
          maxResults: toolInput.maxResults as number | undefined,
        });
        return { result: { advertisers }, isError: false };
      }

      case 'cm360_get_advertiser': {
        const adv = mockStore.getAdvertiser(toolInput.advertiserId as string);
        if (!adv) {
          return { result: null, isError: true, errorMessage: `Advertiser ${toolInput.advertiserId} not found` };
        }
        return { result: adv, isError: false };
      }

      case 'cm360_list_campaigns': {
        const campaigns = mockStore.listCampaigns({
          advertiserId: toolInput.advertiserId as string | undefined,
          searchString: toolInput.searchString as string | undefined,
          maxResults: toolInput.maxResults as number | undefined,
        });
        return { result: { campaigns }, isError: false };
      }

      case 'cm360_create_campaign': {
        const campaign = mockStore.createCampaign({
          advertiserId: toolInput.advertiserId as string,
          name: toolInput.name as string,
          startDate: toolInput.startDate as string,
          endDate: toolInput.endDate as string,
          defaultLandingPageId: toolInput.defaultLandingPageId as string,
        });
        return { result: campaign, isError: false };
      }

      case 'cm360_list_sites': {
        const sites = mockStore.listSites({
          searchString: toolInput.searchString as string | undefined,
          maxResults: toolInput.maxResults as number | undefined,
        });
        return { result: { sites }, isError: false };
      }

      case 'cm360_list_landing_pages': {
        const landingPages = mockStore.listLandingPages({
          advertiserId: toolInput.advertiserId as string | undefined,
          searchString: toolInput.searchString as string | undefined,
          maxResults: toolInput.maxResults as number | undefined,
        });
        return { result: { landingPages }, isError: false };
      }

      case 'cm360_create_landing_page': {
        const page = mockStore.createLandingPage({
          advertiserId: toolInput.advertiserId as string,
          name: toolInput.name as string,
          url: toolInput.url as string,
        });
        return { result: page, isError: false };
      }

      case 'cm360_list_placements': {
        const placements = mockStore.listPlacements({
          campaignId: toolInput.campaignId as string | undefined,
          advertiserId: toolInput.advertiserId as string | undefined,
          searchString: toolInput.searchString as string | undefined,
          maxResults: toolInput.maxResults as number | undefined,
        });
        return { result: { placements }, isError: false };
      }

      case 'cm360_create_placement': {
        const placement = mockStore.createPlacement({
          campaignId: toolInput.campaignId as string,
          siteId: toolInput.siteId as string,
          name: toolInput.name as string,
          width: toolInput.width as number,
          height: toolInput.height as number,
          startDate: toolInput.startDate as string,
          endDate: toolInput.endDate as string,
          paymentSource: toolInput.paymentSource as string | undefined,
          compatibility: toolInput.compatibility as string | undefined,
        });
        return { result: placement, isError: false };
      }

      case 'cm360_list_creatives': {
        const creatives = mockStore.listCreatives({
          advertiserId: toolInput.advertiserId as string | undefined,
          searchString: toolInput.searchString as string | undefined,
          maxResults: toolInput.maxResults as number | undefined,
        });
        return { result: { creatives }, isError: false };
      }

      case 'cm360_list_ads': {
        const ads = mockStore.listAds({
          campaignId: toolInput.campaignId as string | undefined,
          advertiserId: toolInput.advertiserId as string | undefined,
          searchString: toolInput.searchString as string | undefined,
          maxResults: toolInput.maxResults as number | undefined,
        });
        return { result: { ads }, isError: false };
      }

      case 'cm360_create_ad': {
        const ad = mockStore.createAd({
          campaignId: toolInput.campaignId as string,
          name: toolInput.name as string,
          placementIds: toolInput.placementIds as string[],
          creativeId: toolInput.creativeId as string,
        });
        return { result: ad, isError: false };
      }

      case 'cm360_generate_tags': {
        const tags = mockStore.generateTags(
          toolInput.campaignId as string,
          toolInput.placementIds as string[],
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
