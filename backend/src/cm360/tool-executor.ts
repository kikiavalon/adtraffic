/**
 * Tool executor — dispatches Claude tool_use calls to CM360 client functions.
 * Returns mock data until the CM360 client is connected to a real account.
 */

export interface ToolResult {
  result: unknown;
  isError: boolean;
  errorMessage?: string;
}

// Mock data for development (replaced by real CM360 client later)
const MOCK_PROFILES = [
  { profileId: '12345', accountId: '67890', accountName: 'Demo Agency', userName: 'demo@agency.com', etag: '"abc"' },
];

const MOCK_ADVERTISERS = [
  { id: '100', name: 'Toyota USA', accountId: '67890', status: 'APPROVED' },
  { id: '101', name: 'Honda Motors', accountId: '67890', status: 'APPROVED' },
  { id: '102', name: 'BMW North America', accountId: '67890', status: 'APPROVED' },
];

const MOCK_CAMPAIGNS = [
  { id: '1001', name: 'Toyota Q1 2026 Display', advertiserId: '100', startDate: '2026-01-01', endDate: '2026-03-31', defaultLandingPageId: '5001', archived: false },
  { id: '1002', name: 'Toyota Summer Launch', advertiserId: '100', startDate: '2026-06-01', endDate: '2026-08-31', defaultLandingPageId: '5001', archived: false },
];

const MOCK_SITES = [
  { id: '200', name: 'ESPN.com', accountId: '67890', approved: true },
  { id: '201', name: 'CNN.com', accountId: '67890', approved: true },
  { id: '202', name: 'NYTimes.com', accountId: '67890', approved: true },
];

const MOCK_LANDING_PAGES = [
  { id: '5001', name: 'Toyota Homepage', advertiserId: '100', url: 'https://www.toyota.com', archived: false },
  { id: '5002', name: 'Toyota Offers', advertiserId: '100', url: 'https://www.toyota.com/offers', archived: false },
];

const MOCK_PLACEMENTS = [
  { id: '3001', name: 'ESPN_Toyota_300x250_Q1', campaignId: '1001', siteId: '200', size: { width: 300, height: 250 }, status: 'ACTIVE' },
  { id: '3002', name: 'CNN_Toyota_728x90_Q1', campaignId: '1001', siteId: '201', size: { width: 728, height: 90 }, status: 'ACTIVE' },
];

/**
 * Execute a CM360 tool call and return the result.
 * Currently uses mock data — will be replaced with real @googleapis/dfareporting calls.
 */
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'cm360_list_profiles':
        return { result: { profiles: MOCK_PROFILES }, isError: false };

      case 'cm360_list_advertisers': {
        let advertisers = MOCK_ADVERTISERS;
        const search = toolInput.searchString as string | undefined;
        if (search) {
          advertisers = advertisers.filter((a) =>
            a.name.toLowerCase().includes(search.toLowerCase()),
          );
        }
        return { result: { advertisers }, isError: false };
      }

      case 'cm360_get_advertiser': {
        const adv = MOCK_ADVERTISERS.find((a) => a.id === toolInput.advertiserId);
        if (!adv) {
          return { result: null, isError: true, errorMessage: `Advertiser ${toolInput.advertiserId} not found` };
        }
        return { result: adv, isError: false };
      }

      case 'cm360_list_campaigns': {
        let campaigns = MOCK_CAMPAIGNS;
        if (toolInput.advertiserId) {
          campaigns = campaigns.filter((c) => c.advertiserId === toolInput.advertiserId);
        }
        return { result: { campaigns }, isError: false };
      }

      case 'cm360_create_campaign':
        return {
          result: {
            id: `camp-${Date.now()}`,
            name: toolInput.name,
            advertiserId: toolInput.advertiserId,
            startDate: toolInput.startDate,
            endDate: toolInput.endDate,
            defaultLandingPageId: toolInput.defaultLandingPageId,
            archived: false,
            _mock: true,
          },
          isError: false,
        };

      case 'cm360_list_sites': {
        let sites = MOCK_SITES;
        const siteSearch = toolInput.searchString as string | undefined;
        if (siteSearch) {
          sites = sites.filter((s) =>
            s.name.toLowerCase().includes(siteSearch.toLowerCase()),
          );
        }
        return { result: { sites }, isError: false };
      }

      case 'cm360_list_landing_pages':
        return { result: { landingPages: MOCK_LANDING_PAGES }, isError: false };

      case 'cm360_list_placements': {
        let placements = MOCK_PLACEMENTS;
        if (toolInput.campaignId) {
          placements = placements.filter((p) => p.campaignId === toolInput.campaignId);
        }
        return { result: { placements }, isError: false };
      }

      case 'cm360_create_placement':
        return {
          result: {
            id: `plc-${Date.now()}`,
            name: toolInput.name,
            campaignId: toolInput.campaignId,
            siteId: toolInput.siteId,
            size: { width: toolInput.width, height: toolInput.height },
            status: 'DRAFT',
            _mock: true,
          },
          isError: false,
        };

      case 'cm360_generate_tags':
        return {
          result: {
            placementTags: (toolInput.placementIds as string[]).map((id) => ({
              placementId: id,
              tagData: [{
                format: 'PLACEMENT_TAG_STANDARD',
                impressionTag: `<script src="https://ad.doubleclick.net/ddm/trackimp/N67890.DEMO/${id};dc_trk_aid=mock;dc_trk_cid=mock;ord=[timestamp]"></script>`,
                clickTag: `https://ad.doubleclick.net/ddm/trackclk/N67890.DEMO/${id};dc_trk_aid=mock;dc_trk_cid=mock`,
              }],
            })),
            _mock: true,
          },
          isError: false,
        };

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
