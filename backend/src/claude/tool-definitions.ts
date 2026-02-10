import type Anthropic from '@anthropic-ai/sdk';

/**
 * CM360 tool definitions for Claude's tool use.
 * These match the 10-tool MVP from CLAUDE.md.
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
];
