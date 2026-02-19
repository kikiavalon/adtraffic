import type Anthropic from '@anthropic-ai/sdk';
import type { BooleanFlagName, ResolvedFlags } from '../feature-flags/flag-registry.js';

/**
 * CM360 tool definitions for Claude's tool use.
 * 30 CM360 tools: 14 read + 6 create + 5 update + 1 tag gen + 3 search/detail + 1 upload.
 *
 * Note: Tools are defined but not executed yet.
 * When Claude returns a tool_use block, the chat service will
 * eventually forward it to the CM360 client for execution.
 */
export const CM360_TOOLS: Anthropic.Tool[] = [
  {
    name: 'cm360_list_profiles',
    description: 'List all CM360 user profiles available to the authenticated user. Use this first to get the profileId needed for all other operations.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'cm360_list_advertisers',
    description: 'List advertisers in the CM360 account. Can filter by search string. Returns advertiser id, name, and status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        searchString: { type: 'string', description: 'Optional filter by advertiser name (case-insensitive partial match)' },
        maxResults: { type: 'number', description: 'Maximum results to return (default 100, max 1000)' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_get_advertiser',
    description: 'Get details for a specific advertiser by ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'The advertiser ID to look up' },
      },
      required: ['profileId', 'advertiserId'],
    },
  },
  {
    name: 'cm360_list_campaigns',
    description: 'List campaigns, optionally filtered by advertiser. Returns campaign id, name, dates, and status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'Filter by advertiser ID' },
        searchString: { type: 'string', description: 'Filter by campaign name' },
        maxResults: { type: 'number', description: 'Maximum results to return (default 100, max 1000)' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_create_campaign',
    description: 'Create a new campaign. IMPORTANT: Always show a preview of what will be created and get user confirmation before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'The advertiser ID this campaign belongs to' },
        name: { type: 'string', description: 'Campaign name' },
        startDate: { type: 'string', description: 'Campaign start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'Campaign end date in YYYY-MM-DD format' },
        defaultLandingPageId: { type: 'string', description: 'Default landing page ID (required by CM360)' },
      },
      required: ['profileId', 'advertiserId', 'name', 'startDate', 'endDate', 'defaultLandingPageId'],
    },
  },
  {
    name: 'cm360_list_sites',
    description: 'List available sites (publishers) in the CM360 account. Sites are where placements are trafficked to.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        searchString: { type: 'string', description: 'Filter by site name' },
        maxResults: { type: 'number', description: 'Maximum results to return (default 100, max 1000)' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_list_landing_pages',
    description: 'List landing pages for an advertiser. Landing pages are required when creating campaigns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'Filter by advertiser ID' },
        maxResults: { type: 'number', description: 'Maximum results to return (default 100, max 1000)' },
      },
      required: ['profileId', 'advertiserId'],
    },
  },
  {
    name: 'cm360_list_placements',
    description: 'List placements, optionally filtered by campaign and/or advertiser.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        campaignId: { type: 'string', description: 'Filter by campaign ID' },
        advertiserId: { type: 'string', description: 'Filter by advertiser ID' },
        searchString: { type: 'string', description: 'Filter by placement name' },
        maxResults: { type: 'number', description: 'Maximum results to return (default 100, max 1000)' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_create_placement',
    description: 'Create a new placement in a campaign. IMPORTANT: Always show a preview and get user confirmation before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        campaignId: { type: 'string', description: 'Campaign ID to create the placement in' },
        siteId: { type: 'string', description: 'Site (publisher) ID' },
        name: { type: 'string', description: 'Placement name (follow agency naming conventions)' },
        width: { type: 'number', description: 'Ad width in pixels (e.g., 300, 728, 970)' },
        height: { type: 'number', description: 'Ad height in pixels (e.g., 250, 90, 250)' },
        startDate: { type: 'string', description: 'Placement start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'Placement end date in YYYY-MM-DD format' },
        paymentSource: { type: 'string', enum: ['PLACEMENT_AGENCY_PAID', 'PLACEMENT_PUBLISHER_PAID'], description: 'Who pays for the placement (default: PLACEMENT_AGENCY_PAID)' },
        compatibility: { type: 'string', enum: ['DISPLAY', 'IN_STREAM_VIDEO', 'IN_STREAM_AUDIO'], description: 'Placement type (default: DISPLAY)' },
      },
      required: ['profileId', 'campaignId', 'siteId', 'name', 'width', 'height', 'startDate', 'endDate'],
    },
  },
  {
    name: 'cm360_list_creatives',
    description: 'List creatives for an advertiser. Creatives are the actual ad assets (images, HTML5, video) that get assigned to ads.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'Filter by advertiser ID' },
        searchString: { type: 'string', description: 'Filter by creative name' },
        maxResults: { type: 'number', description: 'Maximum results to return (default 100, max 1000)' },
      },
      required: ['profileId', 'advertiserId'],
    },
  },
  {
    name: 'cm360_list_ads',
    description: 'List ads in a campaign. Ads link creatives to placements — they are the final "glue" in the trafficking workflow.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        campaignId: { type: 'string', description: 'Filter by campaign ID' },
        advertiserId: { type: 'string', description: 'Filter by advertiser ID' },
        searchString: { type: 'string', description: 'Filter by ad name' },
        maxResults: { type: 'number', description: 'Maximum results to return (default 100, max 1000)' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_create_ad',
    description: 'Create a new ad that links a creative to one or more placements. This is the last step in the trafficking workflow. IMPORTANT: Always show a preview and get user confirmation before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        campaignId: { type: 'string', description: 'Campaign ID the ad belongs to' },
        name: { type: 'string', description: 'Ad name' },
        placementIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of placement IDs to assign to this ad',
        },
        creativeId: { type: 'string', description: 'Creative ID to assign to this ad' },
      },
      required: ['profileId', 'campaignId', 'name', 'placementIds', 'creativeId'],
    },
  },
  {
    name: 'cm360_create_landing_page',
    description: 'Create a new landing page for an advertiser. Landing pages are required when creating campaigns (as the default landing page). IMPORTANT: Always show a preview and get user confirmation before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'Advertiser ID this landing page belongs to' },
        name: { type: 'string', description: 'Landing page name (max 256 characters)' },
        url: { type: 'string', description: 'Landing page URL (must be a valid URL)' },
      },
      required: ['profileId', 'advertiserId', 'name', 'url'],
    },
  },
  {
    name: 'cm360_generate_tags',
    description: 'Generate ad serving tags (JavaScript, iframe, etc.) for one or more placements. Returns the tag code ready to send to publishers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        campaignId: { type: 'string', description: 'Campaign ID' },
        placementIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of placement IDs to generate tags for',
        },
        tagFormats: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['PLACEMENT_TAG_STANDARD', 'PLACEMENT_TAG_IFRAME_JAVASCRIPT', 'PLACEMENT_TAG_INTERNAL_REDIRECT', 'PLACEMENT_TAG_CLICK_COMMANDS'],
          },
          description: 'Tag formats to generate (default: PLACEMENT_TAG_STANDARD)',
        },
      },
      required: ['profileId', 'campaignId', 'placementIds'],
    },
  },
  // ---------- Get (single entity) ----------
  {
    name: 'cm360_get_creative',
    description: 'Get detailed information about a single creative by ID, including type, size, active status, and archived status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        creativeId: { type: 'string', description: 'The creative ID to retrieve' },
      },
      required: ['profileId', 'creativeId'],
    },
  },
  {
    name: 'cm360_get_landing_page',
    description: 'Get detailed information about a single landing page by ID, including name, URL, and archived status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        landingPageId: { type: 'string', description: 'The landing page ID to retrieve' },
      },
      required: ['profileId', 'landingPageId'],
    },
  },
  {
    name: 'cm360_get_site',
    description: 'Get detailed information about a single site (publisher) by ID, including name, approval status, and directory site association.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        siteId: { type: 'string', description: 'The site ID to retrieve' },
      },
      required: ['profileId', 'siteId'],
    },
  },
  {
    name: 'cm360_list_sizes',
    description: 'List available ad sizes in CM360. Can filter by width, height, or IAB standard sizes only. Useful when creating placements or creatives to know valid dimensions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        width: { type: 'number', description: 'Filter by exact width in pixels' },
        height: { type: 'number', description: 'Filter by exact height in pixels' },
        iabStandard: { type: 'boolean', description: 'If true, only return IAB standard sizes' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_create_creative',
    description: 'Register a new creative (ad asset placeholder) in CM360. IMPORTANT: Always show a preview of what will be created and get user confirmation before calling this tool. Note: This creates the creative metadata — actual asset upload is a separate step.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'The advertiser ID this creative belongs to' },
        name: { type: 'string', description: 'Creative name (max 256 characters)' },
        type: {
          type: 'string',
          enum: [
            'DISPLAY', 'DISPLAY_REDIRECT', 'HTML5_BANNER', 'IMAGE',
            'INTERNAL_REDIRECT', 'RICH_MEDIA_DISPLAY_BANNER', 'RICH_MEDIA_DISPLAY_EXPANDING',
            'RICH_MEDIA_DISPLAY_INTERSTITIAL', 'RICH_MEDIA_DISPLAY_MULTI_FLOATING_INTERSTITIAL',
            'RICH_MEDIA_MOBILE_IN_APP', 'RICH_MEDIA_PEEL_DOWN', 'TRACKING',
            'VAST_REDIRECT', 'VPAID_LINEAR', 'VPAID_NON_LINEAR',
          ],
          description: 'Creative type (most common: DISPLAY, IMAGE, HTML5_BANNER)',
        },
        width: { type: 'number', description: 'Creative width in pixels (e.g., 300, 728, 970)' },
        height: { type: 'number', description: 'Creative height in pixels (e.g., 250, 90, 250)' },
        active: { type: 'boolean', description: 'Whether the creative is active (default: true)' },
      },
      required: ['profileId', 'advertiserId', 'name', 'type', 'width', 'height'],
    },
  },
  {
    name: 'cm360_get_campaign',
    description: 'Get detailed information about a single campaign by ID, including dates, default landing page, and archived status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        campaignId: { type: 'string', description: 'The campaign ID to retrieve' },
      },
      required: ['profileId', 'campaignId'],
    },
  },
  {
    name: 'cm360_get_placement',
    description: 'Get detailed information about a single placement by ID, including size, status, active status, and pricing schedule.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        placementId: { type: 'string', description: 'The placement ID to retrieve' },
      },
      required: ['profileId', 'placementId'],
    },
  },
  {
    name: 'cm360_get_ad',
    description: 'Get detailed information about a single ad by ID, including placement assignments, creative rotation, and active/archived status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        adId: { type: 'string', description: 'The ad ID to retrieve' },
      },
      required: ['profileId', 'adId'],
    },
  },
  // ---------- Update / Patch ----------
  {
    name: 'cm360_update_campaign',
    description: '[WRITE] Update a campaign. Can change name, dates, default landing page, or archive status. Only include fields you want to change. Always preview changes and confirm with the user before executing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        campaignId: { type: 'string', description: 'The campaign ID to update' },
        name: { type: 'string', description: 'New campaign name (1-256 characters)' },
        startDate: { type: 'string', description: 'New start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'New end date (YYYY-MM-DD)' },
        archived: { type: 'boolean', description: 'Set to true to archive, false to unarchive' },
        defaultLandingPageId: { type: 'string', description: 'New default landing page ID' },
      },
      required: ['profileId', 'campaignId'],
    },
  },
  {
    name: 'cm360_update_placement',
    description: '[WRITE] Update a placement. Can change name, active status, archive status, or pricing schedule dates. Size, site, and compatibility cannot be changed after creation. Always preview changes and confirm with the user before executing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        placementId: { type: 'string', description: 'The placement ID to update' },
        name: { type: 'string', description: 'New placement name (1-256 characters)' },
        activeStatus: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED', 'PERMANENTLY_ARCHIVED'], description: 'Operational status' },
        archived: { type: 'boolean', description: 'Set to true to archive, false to unarchive' },
        startDate: { type: 'string', description: 'New pricing schedule start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'New pricing schedule end date (YYYY-MM-DD)' },
      },
      required: ['profileId', 'placementId'],
    },
  },
  {
    name: 'cm360_update_ad',
    description: '[WRITE] Update an ad. Can change name, active/archived status, start/end time, placement assignments, or creative rotation. Always preview changes and confirm with the user before executing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        adId: { type: 'string', description: 'The ad ID to update' },
        name: { type: 'string', description: 'New ad name (1-256 characters)' },
        active: { type: 'boolean', description: 'Set to true to activate, false to deactivate' },
        archived: { type: 'boolean', description: 'Set to true to archive, false to unarchive' },
        startTime: { type: 'string', description: 'Ad start time (ISO 8601)' },
        endTime: { type: 'string', description: 'Ad end time (ISO 8601)' },
        placementIds: { type: 'array', items: { type: 'string' }, description: 'New placement assignments (replaces existing)' },
        creativeId: { type: 'string', description: 'New creative ID (replaces existing rotation)' },
      },
      required: ['profileId', 'adId'],
    },
  },
  {
    name: 'cm360_update_creative',
    description: '[WRITE] Update a creative. Can change name, active status, or archive status. Type and size cannot be changed after creation. Always preview changes and confirm with the user before executing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        creativeId: { type: 'string', description: 'The creative ID to update' },
        name: { type: 'string', description: 'New creative name (1-256 characters)' },
        active: { type: 'boolean', description: 'Set to true to activate, false to deactivate' },
        archived: { type: 'boolean', description: 'Set to true to archive, false to unarchive' },
      },
      required: ['profileId', 'creativeId'],
    },
  },
  {
    name: 'cm360_update_landing_page',
    description: '[WRITE] Update a landing page. Can change name, URL, or archive status. Always preview changes and confirm with the user before executing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        landingPageId: { type: 'string', description: 'The landing page ID to update' },
        name: { type: 'string', description: 'New landing page name (1-256 characters)' },
        url: { type: 'string', description: 'New URL (must be a valid URL)' },
        archived: { type: 'boolean', description: 'Set to true to archive, false to unarchive' },
      },
      required: ['profileId', 'landingPageId'],
    },
  },

  // --- Phase B: Campaign-Creative Associations + Creative Assets ---

  {
    name: 'cm360_associate_creative_campaign',
    description: 'Associate a creative with a campaign. IMPORTANT: Always preview and confirm with the user before calling this tool. This is a prerequisite for creating ads — a creative must be associated with the campaign before it can be assigned to placements via an ad.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        campaignId: { type: 'string', description: 'The campaign ID to associate the creative with' },
        creativeId: { type: 'string', description: 'The creative ID to associate' },
      },
      required: ['profileId', 'campaignId', 'creativeId'],
    },
  },
  {
    name: 'cm360_list_campaign_creative_associations',
    description: 'List all creatives associated with a campaign. Returns the creative IDs that have been linked to the specified campaign. Use this to verify which creatives are available for ad creation within a campaign.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        campaignId: { type: 'string', description: 'The campaign ID to list associations for' },
        maxResults: { type: 'number', description: 'Maximum results to return (default 100, max 1000)' },
      },
      required: ['profileId', 'campaignId'],
    },
  },
  {
    name: 'cm360_upload_creative_asset',
    description: 'Upload a creative asset (image, HTML5, video, or audio file) for an advertiser. IMPORTANT: Always preview and confirm with the user before calling this tool. The asset is uploaded and can then be referenced when creating or updating creatives. Accepts base64-encoded file data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'The advertiser ID to upload the asset for' },
        assetName: { type: 'string', description: 'Filename for the asset (e.g., "hero-banner.png")' },
        assetType: {
          type: 'string',
          enum: ['HTML', 'HTML_IMAGE', 'IMAGE', 'VIDEO', 'AUDIO', 'PARENT_AUDIO', 'PARENT_VIDEO'],
          description: 'Type of creative asset being uploaded',
        },
        assetData: { type: 'string', description: 'Base64-encoded file content' },
      },
      required: ['profileId', 'advertiserId', 'assetName', 'assetType', 'assetData'],
    },
  },
];

/**
 * Maps each tool name to the boolean feature flag that gates it.
 * If the flag is false, the tool is excluded from the Claude API call.
 */
export const TOOL_FLAG_MAP: Record<string, BooleanFlagName> = {
  // Read tools
  cm360_list_profiles: 'cm360.read_operations',
  cm360_list_advertisers: 'cm360.read_operations',
  cm360_get_advertiser: 'cm360.read_operations',
  cm360_list_campaigns: 'cm360.read_operations',
  cm360_list_sites: 'cm360.read_operations',
  cm360_list_landing_pages: 'cm360.read_operations',
  cm360_list_placements: 'cm360.read_operations',
  cm360_list_creatives: 'cm360.read_operations',
  cm360_list_ads: 'cm360.read_operations',
  cm360_get_campaign: 'cm360.read_operations',
  cm360_get_placement: 'cm360.read_operations',
  cm360_get_ad: 'cm360.read_operations',
  cm360_get_creative: 'cm360.read_operations',
  cm360_get_landing_page: 'cm360.read_operations',
  cm360_get_site: 'cm360.read_operations',
  cm360_list_sizes: 'cm360.read_operations',
  cm360_list_campaign_creative_associations: 'cm360.read_operations',
  // Write tools
  cm360_create_campaign: 'cm360.write_operations',
  cm360_create_placement: 'cm360.write_operations',
  cm360_create_ad: 'cm360.write_operations',
  cm360_create_landing_page: 'cm360.write_operations',
  cm360_create_creative: 'cm360.write_operations',
  cm360_update_campaign: 'cm360.write_operations',
  cm360_update_placement: 'cm360.write_operations',
  cm360_update_ad: 'cm360.write_operations',
  cm360_update_creative: 'cm360.write_operations',
  cm360_update_landing_page: 'cm360.write_operations',
  cm360_associate_creative_campaign: 'cm360.write_operations',
  cm360_upload_creative_asset: 'cm360.write_operations',
  // Tag generation
  cm360_generate_tags: 'cm360.tag_generation',
};

/**
 * Filter CM360_TOOLS based on the user's resolved feature flags.
 * Returns only the tools whose gating flag is enabled.
 */
export function getEnabledTools(flags: ResolvedFlags): Anthropic.Tool[] {
  return CM360_TOOLS.filter((tool) => {
    const flagName = TOOL_FLAG_MAP[tool.name];
    if (!flagName) return true; // No flag mapping = always enabled
    return flags[flagName];
  });
}
