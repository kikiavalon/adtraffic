import type Anthropic from '@anthropic-ai/sdk';
import type { BooleanFlagName, ResolvedFlags } from '../feature-flags/flag-registry.js';

/**
 * CM360 tool definitions for Claude's tool use.
 * 71 CM360 tools: reporting + floodlight + pacing + user & role management.
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
        searchString: { type: 'string', description: 'Filter by landing page name' },
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
    description: 'Create a new ad that links a creative to one or more placements. This is the last step in the trafficking workflow. Optionally set the click-through URL (a specific landing page or a custom URL) and a click-through URL suffix for per-ad UTM tracking parameters. IMPORTANT: Always show a preview and get user confirmation before calling this tool.',
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
        landingPageId: { type: 'string', description: 'Landing page ID for the click-through URL. Mutually exclusive with customClickThroughUrl. If neither is set, the campaign default landing page is used.' },
        customClickThroughUrl: { type: 'string', description: 'Custom click-through URL (full URL). Mutually exclusive with landingPageId.' },
        clickThroughUrlSuffix: { type: 'string', description: 'Query parameters appended to the click-through URL, e.g. UTM tracking like "utm_source=cm360&utm_medium=display". No leading "?" or "&". Must be under 128 characters.' },
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
    description: 'Generate ad serving tags for one or more placements. Auto-detects VAST format for video placements, standard JavaScript for display. Returns the tag code ready to send to publishers.',
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
            enum: ['PLACEMENT_TAG_STANDARD', 'PLACEMENT_TAG_IFRAME_JAVASCRIPT', 'PLACEMENT_TAG_INTERNAL_REDIRECT', 'PLACEMENT_TAG_CLICK_COMMANDS', 'PLACEMENT_TAG_VAST_2_0'],
          },
          description: 'Tag formats to generate. If omitted, auto-detects based on placement type (VAST for video, standard for display).',
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
    description: '[WRITE] Update an ad. Can change name, active/archived status, start/end time, placement assignments, creative rotation, click-through URL (landing page or custom URL), or click-through URL suffix (per-ad UTM tracking parameters). Always preview changes and confirm with the user before executing.',
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
        landingPageId: { type: 'string', description: 'Landing page ID for the click-through URL. Mutually exclusive with customClickThroughUrl.' },
        customClickThroughUrl: { type: 'string', description: 'Custom click-through URL (full URL). Mutually exclusive with landingPageId.' },
        clickThroughUrlSuffix: { type: 'string', description: 'Query parameters appended to the click-through URL, e.g. UTM tracking like "utm_source=cm360&utm_medium=display". No leading "?" or "&". Must be under 128 characters.' },
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

  // --- Phase C: Event Tags ---

  {
    name: 'cm360_list_event_tags',
    description: 'List event tags for a campaign. Event tags are impression/click tracking pixels attached to campaigns for third-party verification (e.g., DoubleVerify, IAS, MOAT).',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        campaignId: { type: 'string', description: 'Campaign ID to list event tags for' },
        advertiserId: { type: 'string', description: 'Optional filter by advertiser ID' },
        searchString: { type: 'string', description: 'Optional filter by event tag name (case-insensitive partial match)' },
      },
      required: ['profileId', 'campaignId'],
    },
  },
  {
    name: 'cm360_get_event_tag',
    description: 'Get detailed information about a single event tag by ID, including type, URL, status, site assignments, and whether it fires by default.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        eventTagId: { type: 'string', description: 'The event tag ID to retrieve' },
      },
      required: ['profileId', 'eventTagId'],
    },
  },
  {
    name: 'cm360_create_event_tag',
    description: '[WRITE] Create a new event tag (tracking pixel) for a campaign. IMPORTANT: Always preview and confirm with the user before calling this tool. Supports impression image pixels, impression JavaScript tags, and click-through event tags for third-party verification.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'The advertiser ID' },
        campaignId: { type: 'string', description: 'The campaign ID to attach the event tag to' },
        name: { type: 'string', description: 'Event tag name (max 256 characters)' },
        url: { type: 'string', description: 'Tag URL (must be a valid URL, preferably HTTPS for SSL compliance)' },
        type: {
          type: 'string',
          enum: ['IMPRESSION_IMAGE_EVENT_TAG', 'IMPRESSION_JAVASCRIPT_EVENT_TAG', 'CLICK_THROUGH_EVENT_TAG'],
          description: 'Event tag type: image pixel (1x1 img), JavaScript tag, or click-through redirect',
        },
        siteIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: restrict this tag to specific site IDs. If omitted, applies to all sites.',
        },
        enabledByDefault: { type: 'boolean', description: 'Whether the tag fires by default on all placements in the campaign (default: false)' },
      },
      required: ['profileId', 'advertiserId', 'campaignId', 'name', 'url', 'type'],
    },
  },
  {
    name: 'cm360_update_event_tag',
    description: '[WRITE] Update an existing event tag. Can change name, URL, status (ENABLED/DISABLED), site assignments, or default firing behavior. Always preview changes and confirm with the user before executing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        eventTagId: { type: 'string', description: 'The event tag ID to update' },
        name: { type: 'string', description: 'New event tag name (1-256 characters)' },
        url: { type: 'string', description: 'New tag URL (must be a valid URL)' },
        status: { type: 'string', enum: ['ENABLED', 'DISABLED'], description: 'Enable or disable the event tag' },
        siteIds: { type: 'array', items: { type: 'string' }, description: 'New site assignments (replaces existing)' },
        enabledByDefault: { type: 'boolean', description: 'Whether the tag fires by default on all placements' },
      },
      required: ['profileId', 'eventTagId'],
    },
  },
  {
    name: 'cm360_delete_event_tag',
    description: '[WRITE] Delete an event tag. IMPORTANT: This is a destructive action — always preview and confirm with the user before executing. The tag will be permanently removed from the campaign.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        eventTagId: { type: 'string', description: 'The event tag ID to delete' },
      },
      required: ['profileId', 'eventTagId'],
    },
  },
  // --- Placement Groups ---
  {
    name: 'cm360_list_placement_groups',
    description: 'List placement groups for a campaign. Placement groups bundle placements together — PLACEMENT_PACKAGE for consolidated billing, PLACEMENT_ROADBLOCK for simultaneous delivery on a site. Returns group name, type, member placements, and schedule.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        campaignId: { type: 'string', description: 'The campaign ID to list placement groups for' },
        advertiserId: { type: 'string', description: 'Optional: filter by advertiser ID' },
        searchString: { type: 'string', description: 'Optional: filter by name (case-insensitive partial match)' },
        maxResults: { type: 'number', description: 'Maximum results to return (default 100, max 1000)' },
      },
      required: ['profileId', 'campaignId'],
    },
  },
  {
    name: 'cm360_get_placement_group',
    description: 'Get detailed information about a single placement group by ID, including group type (package or roadblock), member placement IDs, site, and pricing schedule.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        placementGroupId: { type: 'string', description: 'The placement group ID to retrieve' },
      },
      required: ['profileId', 'placementGroupId'],
    },
  },
  {
    name: 'cm360_create_placement_group',
    description: '[WRITE] Create a new placement group to bundle placements together. IMPORTANT: Always preview and confirm with the user before calling this tool. Use PLACEMENT_PACKAGE for billing bundles or PLACEMENT_ROADBLOCK for simultaneous ad delivery on a single site.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        campaignId: { type: 'string', description: 'The campaign ID to create the group under' },
        siteId: { type: 'string', description: 'The site ID for this placement group' },
        name: { type: 'string', description: 'Placement group name (max 256 characters)' },
        placementGroupType: {
          type: 'string',
          enum: ['PLACEMENT_PACKAGE', 'PLACEMENT_ROADBLOCK'],
          description: 'Group type: PLACEMENT_PACKAGE bundles placements for billing; PLACEMENT_ROADBLOCK ensures simultaneous delivery',
        },
        placementIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: placement IDs to include in this group at creation time',
        },
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
      },
      required: ['profileId', 'campaignId', 'siteId', 'name', 'placementGroupType', 'startDate', 'endDate'],
    },
  },
  {
    name: 'cm360_update_placement_group',
    description: '[WRITE] Update an existing placement group. Can change name, active status (ACTIVE/ARCHIVED), member placements, or schedule dates. Always preview changes and confirm with the user before executing. Note: group type (package/roadblock) cannot be changed after creation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        placementGroupId: { type: 'string', description: 'The placement group ID to update' },
        name: { type: 'string', description: 'New placement group name (1-256 characters)' },
        activeStatus: { type: 'string', enum: ['ACTIVE', 'ARCHIVED'], description: 'Set active or archive the group' },
        placementIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'New member placement IDs (replaces existing members)',
        },
        startDate: { type: 'string', description: 'New start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'New end date in YYYY-MM-DD format' },
      },
      required: ['profileId', 'placementGroupId'],
    },
  },

  // --- Directory Sites (browse/approve publishers from Google's directory) ---

  {
    name: 'cm360_list_directory_sites',
    description: 'Browse directory sites from Google\'s publisher catalog. These are potential sites that can be approved for ad trafficking. Use searchString to filter by name. Returns site ID, name, URL, active status, and supported tag formats.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        searchString: { type: 'string', description: 'Filter by site name (case-insensitive partial match)' },
        active: { type: 'boolean', description: 'Filter by active status (true/false)' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_get_directory_site',
    description: 'Get details of a specific directory site by ID, including its name, URL, active status, and supported tag formats (interstitial and inpage).',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        directorySiteId: { type: 'string', description: 'The directory site ID to look up' },
      },
      required: ['profileId', 'directorySiteId'],
    },
  },
  {
    name: 'cm360_insert_directory_site',
    description: 'Approve a directory site for ad trafficking. This inserts the directory site entry, which creates an approved CM360 site that can be used for placements. IMPORTANT: Always preview the directory site details and get user confirmation before inserting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        siteId: { type: 'string', description: 'The directory site ID to approve/insert' },
      },
      required: ['profileId', 'siteId'],
    },
  },

  // --- Change Logs (read-only audit trail) ---

  {
    name: 'cm360_list_change_logs',
    description: 'List change log entries — an audit trail of who changed what and when in the CM360 account. Can filter by object type (campaign, placement, ad, creative, etc.), specific object ID, action type (create, update, delete), date range, and search string. Returns newest changes first. Critical for enterprise compliance and audit-readiness.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        objectType: {
          type: 'string',
          enum: [
            'OBJECT_ADVERTISER', 'OBJECT_CAMPAIGN', 'OBJECT_PLACEMENT',
            'OBJECT_AD', 'OBJECT_CREATIVE', 'OBJECT_LANDING_PAGE',
            'OBJECT_EVENT_TAG', 'OBJECT_PLACEMENT_GROUP',
            'OBJECT_FLOODLIGHT_ACTIVITY', 'OBJECT_SITE',
          ],
          description: 'Filter by the type of object that was changed',
        },
        objectId: { type: 'string', description: 'Filter by specific object ID to see all changes to a single entity' },
        action: {
          type: 'string',
          enum: ['ACTION_CREATE', 'ACTION_UPDATE', 'ACTION_DELETE', 'ACTION_ACTIVATE', 'ACTION_DEACTIVATE', 'ACTION_ARCHIVE'],
          description: 'Filter by type of change action',
        },
        minChangeTime: { type: 'string', description: 'Only return changes after this ISO 8601 timestamp' },
        maxChangeTime: { type: 'string', description: 'Only return changes before this ISO 8601 timestamp' },
        searchString: { type: 'string', description: 'Search across field names, old/new values, object types, and actions' },
        maxResults: { type: 'number', description: 'Maximum results to return (default 100, max 1000)' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_get_change_log',
    description: 'Get details of a single change log entry by ID. Returns the full audit record including who made the change, what object was changed, the action taken, and the old/new field values.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        changeLogId: { type: 'string', description: 'The change log entry ID to retrieve' },
      },
      required: ['profileId', 'changeLogId'],
    },
  },
  // --- Reports ---
  {
    name: 'cm360_list_reports',
    description: 'List saved report definitions in the CM360 account. Reports define which dimensions, metrics, and filters are used to query campaign data. Returns report name, type (STANDARD, REACH, PATH_TO_CONVERSION, FLOODLIGHT, CROSS_MEDIA_REACH), criteria, and schedule information.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        maxResults: { type: 'number', description: 'Maximum number of results (1-100)' },
        pageToken: { type: 'string', description: 'Token for next page of results' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_get_report',
    description: 'Get detailed information about a specific saved report definition, including its dimensions, metrics, filters, date range, and schedule. Use this to understand what data a report will produce before running it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        reportId: { type: 'string', description: 'The report ID' },
      },
      required: ['profileId', 'reportId'],
    },
  },
  {
    name: 'cm360_create_report',
    description: '[WRITE] Create a new report definition with the specified dimensions, metrics, date range, and optional filters. Use cm360_query_compatible_fields FIRST to verify your dimensions and metrics are valid for the report type. After creating, use cm360_run_report to execute it and cm360_get_report_file to retrieve results. IMPORTANT: Always show a preview of what will be created and get user confirmation before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        name: { type: 'string', description: 'Human-readable name for the report' },
        type: {
          type: 'string',
          description: 'Report type',
          enum: ['STANDARD', 'REACH', 'PATH_TO_CONVERSION', 'FLOODLIGHT', 'CROSS_MEDIA_REACH'],
        },
        dimensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Dimension fields to include (e.g., campaign, site, placement, date, month)',
        },
        metricNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Metric fields to include (e.g., impressions, clicks, clickRate, totalConversions, mediaCost)',
        },
        startDate: { type: 'string', description: 'Report start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'Report end date in YYYY-MM-DD format' },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              dimensionName: { type: 'string', description: 'Dimension to filter on (e.g., campaign, advertiser)' },
              value: { type: 'string', description: 'Value to filter for' },
            },
            required: ['dimensionName', 'value'],
          },
          description: 'Optional dimension filters to narrow the report scope',
        },
      },
      required: ['profileId', 'name', 'type', 'dimensions', 'metricNames', 'startDate', 'endDate'],
    },
  },
  {
    name: 'cm360_run_report',
    description: 'Execute a saved report asynchronously. Returns a report file object with a fileId and initial status (usually PROCESSING). Use cm360_get_report_file to poll for completion and retrieve the results. Reports typically complete within a few seconds for small date ranges.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        reportId: { type: 'string', description: 'The report ID to execute' },
      },
      required: ['profileId', 'reportId'],
    },
  },
  {
    name: 'cm360_get_report_file',
    description: 'Get the results of a previously executed report. Returns the report file status, and when status is REPORT_AVAILABLE, includes parsed data rows with columns and an aggregated summary (impressions, clicks, CTR, conversions, spend). Use maxRows to limit the number of data rows returned (default 50, max 200).',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        reportId: { type: 'string', description: 'The report ID' },
        fileId: { type: 'string', description: 'The file ID returned by cm360_run_report' },
        maxRows: { type: 'number', description: 'Maximum data rows to return (1-200, default 50). Use a lower value to keep token usage manageable.' },
      },
      required: ['profileId', 'reportId', 'fileId'],
    },
  },
  {
    name: 'cm360_query_compatible_fields',
    description: 'Query which dimensions, metrics, and dimension filters are compatible with a given report type. Use this BEFORE creating or modifying reports to ensure the selected fields are valid together. Returns arrays of compatible dimensions, metrics, dimensionFilters, and pivotedActivityMetrics for the specified report type.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        reportType: {
          type: 'string',
          description: 'Report type to query compatible fields for',
          enum: ['STANDARD', 'REACH', 'PATH_TO_CONVERSION', 'FLOODLIGHT', 'CROSS_MEDIA_REACH'],
        },
      },
      required: ['profileId', 'reportType'],
    },
  },
  // --- Floodlight Activities ---
  {
    name: 'cm360_list_floodlight_activities',
    description: 'List Floodlight activities for an advertiser. Floodlight activities are conversion events (form submits, purchases, sign-ups) tracked via Floodlight tags. Filter by activity group or search by name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'Advertiser ID to list activities for' },
        floodlightActivityGroupId: { type: 'string', description: 'Optional: filter to activities in a specific group' },
        searchString: { type: 'string', description: 'Optional: filter by activity name (case-insensitive partial match)' },
      },
      required: ['profileId', 'advertiserId'],
    },
  },
  {
    name: 'cm360_get_floodlight_activity',
    description: 'Get details of a single Floodlight activity, including counting method, tag string, status, type (Counter vs Sales), and custom variables.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        floodlightActivityId: { type: 'string', description: 'The Floodlight activity ID' },
      },
      required: ['profileId', 'floodlightActivityId'],
    },
  },
  {
    name: 'cm360_create_floodlight_activity',
    description: '[WRITE] Create a new Floodlight activity (conversion event). IMPORTANT: Activity type (Counter vs Sale) cannot be changed after creation — confirm with the user first. Counter = page visits, form submits, sign-ups. Sale = purchases with revenue/item tracking. Always preview and confirm before calling.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'The advertiser ID' },
        floodlightActivityGroupId: { type: 'string', description: 'The activity group this activity belongs to' },
        name: { type: 'string', description: 'Activity name (max 256 characters)' },
        type: {
          type: 'string',
          enum: ['COUNTER', 'SALE'],
          description: 'Activity type. COUNTER: page visits, form submits, sign-ups. SALE: purchases with revenue/item tracking. IMMUTABLE after creation.',
        },
        countingMethod: {
          type: 'string',
          enum: ['STANDARD_COUNTING', 'UNIQUE_COUNTING', 'SESSION_COUNTING'],
          description: 'STANDARD: one per user per session (sign-ups, leads). UNIQUE: one per user per day (daily unique). SESSION: each qualifying event (multiple purchases).',
        },
        tagString: { type: 'string', description: 'Tag string used in tag code (letters, numbers, underscores only, e.g., "apex_newsletter_signup")' },
        tagFormat: {
          type: 'string',
          enum: ['HTML', 'XHTML', 'GLOBAL_SITE_TAG'],
          description: 'Tag format. GLOBAL_SITE_TAG (gtag.js) is recommended for modern implementations.',
        },
        expectedUrl: { type: 'string', description: 'Optional: expected URL where the tag fires (for documentation/verification)' },
        notes: { type: 'string', description: 'Optional: notes about the activity (max 1024 characters)' },
      },
      required: ['profileId', 'advertiserId', 'floodlightActivityGroupId', 'name', 'type', 'countingMethod', 'tagString'],
    },
  },
  {
    name: 'cm360_generate_floodlight_tag',
    description: 'Generate implementable Floodlight tag code (gtag.js global snippet + event snippet, iframe, and image tag) for an existing activity. Returns copyable code blocks. Does not modify anything — safe to call at any time.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        floodlightActivityId: { type: 'string', description: 'The Floodlight activity ID to generate a tag for' },
      },
      required: ['profileId', 'floodlightActivityId'],
    },
  },
  // --- Floodlight Activity Groups ---
  {
    name: 'cm360_list_floodlight_activity_groups',
    description: 'List Floodlight activity groups for an advertiser. Groups organize activities by category (e.g., "Lead Gen", "Ecommerce"). Each group has a type (Counter or Sale) that determines what activities it can contain.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'Advertiser ID to list activity groups for' },
        searchString: { type: 'string', description: 'Optional: filter by group name (case-insensitive partial match)' },
      },
      required: ['profileId', 'advertiserId'],
    },
  },
  {
    name: 'cm360_get_floodlight_activity_group',
    description: 'Get details of a single Floodlight activity group, including its type (Counter or Sale) and tag string.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        floodlightActivityGroupId: { type: 'string', description: 'The activity group ID' },
      },
      required: ['profileId', 'floodlightActivityGroupId'],
    },
  },
  {
    name: 'cm360_create_floodlight_activity_group',
    description: '[WRITE] Create a new Floodlight activity group. Groups organize conversion activities by category (e.g., "Lead Gen", "Ecommerce"). The group type (Counter or Sale) determines what activities can be added. Always preview and confirm before calling.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'The advertiser ID' },
        name: { type: 'string', description: 'Group name (max 256 characters)' },
        type: {
          type: 'string',
          enum: ['COUNTER', 'SALE'],
          description: 'Group type. COUNTER: groups page visit/form submit/sign-up activities. SALE: groups purchase/revenue activities.',
        },
        tagString: { type: 'string', description: 'Tag string for the group (letters, numbers, underscores only)' },
      },
      required: ['profileId', 'advertiserId', 'name', 'type', 'tagString'],
    },
  },
  // --- Floodlight Configurations (read-only) ---
  {
    name: 'cm360_list_floodlight_configurations',
    description: 'List account-level Floodlight configurations for an advertiser. Returns lookback windows (click-through, view-through), tag format defaults, and natural search settings. Read-only — configurations are managed in CM360 admin settings.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        advertiserId: { type: 'string', description: 'The advertiser ID to get Floodlight configuration for' },
      },
      required: ['profileId', 'advertiserId'],
    },
  },
  // --- Pacing Analysis ---
  {
    name: 'cm360_pacing_analysis',
    description: 'Analyze delivery pacing for a campaign. Compares actual impressions delivered against linear flight-date goals for each placement. Returns per-placement pacing status (ahead/behind/on_track), spend tracking for CPM placements, and an overall campaign health summary. Use this when the user asks about pacing, delivery status, under-delivery, over-delivery, or spend tracking.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'The CM360 user profile ID' },
        campaignId: { type: 'string', description: 'The campaign ID to analyze pacing for' },
        advertiserId: { type: 'string', description: 'Optional advertiser ID for scoping' },
      },
      required: ['profileId', 'campaignId'],
    },
  },

  // ── User & Role Management ──────────────────────────────────────
  {
    name: 'cm360_list_account_user_profiles',
    description: 'List account user profiles (users) with optional filters. Returns email, role, active status, and access filters for each user. Use this to audit who has access to the CM360 account.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        searchString: { type: 'string', description: 'Filter by name or email (case-insensitive)' },
        userRoleId: { type: 'string', description: 'Filter by user role ID' },
        subaccountId: { type: 'string', description: 'Filter by subaccount ID' },
        active: { type: 'boolean', description: 'Filter by active status (true = active users only, false = inactive only)' },
        maxResults: { type: 'number', description: 'Maximum results to return (default 1000)' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_get_account_user_profile',
    description: 'Get detailed information about a specific account user profile, including email, role, all 4 access filters (site, campaign, advertiser, user role), subaccount, and active status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        accountUserProfileId: { type: 'string', description: 'ID of the account user profile to retrieve' },
      },
      required: ['profileId', 'accountUserProfileId'],
    },
  },
  {
    name: 'cm360_create_account_user_profile',
    description: '[WRITE] Create a new account user profile (add a user to the CM360 account). Requires email (immutable after creation), name, and user role. Optionally set subaccount, locale, and all 4 access filters. IMPORTANT: Always preview the full access breakdown and confirm with the user before creating. Email cannot be changed after creation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        email: { type: 'string', description: 'Email address (must be linked to a Google Account, immutable after creation)' },
        name: { type: 'string', description: 'Display name (max 64 chars, no special characters)' },
        userRoleId: { type: 'string', description: 'User role ID to assign' },
        subaccountId: { type: 'string', description: 'Subaccount ID (optional)' },
        locale: { type: 'string', description: 'Locale code (default: en)', enum: ['en', 'en-GB', 'fr', 'de', 'es', 'it', 'ja', 'ko', 'pt-BR', 'ru', 'zh-CN', 'zh-TW', 'nl', 'pl', 'sv', 'tr'] },
        active: { type: 'boolean', description: 'Whether the user is active (default: true)' },
        siteFilter: { type: 'object', description: 'Site access filter: { status: "NONE"|"ALL"|"ASSIGNED", objectIds: ["siteId1"] }', properties: { status: { type: 'string', enum: ['NONE', 'ALL', 'ASSIGNED'] }, objectIds: { type: 'array', items: { type: 'string' } } } },
        campaignFilter: { type: 'object', description: 'Campaign access filter', properties: { status: { type: 'string', enum: ['NONE', 'ALL', 'ASSIGNED'] }, objectIds: { type: 'array', items: { type: 'string' } } } },
        advertiserFilter: { type: 'object', description: 'Advertiser access filter', properties: { status: { type: 'string', enum: ['NONE', 'ALL', 'ASSIGNED'] }, objectIds: { type: 'array', items: { type: 'string' } } } },
        userRoleFilter: { type: 'object', description: 'User role management filter', properties: { status: { type: 'string', enum: ['NONE', 'ALL', 'ASSIGNED'] }, objectIds: { type: 'array', items: { type: 'string' } } } },
      },
      required: ['profileId', 'email', 'name', 'userRoleId'],
    },
  },
  {
    name: 'cm360_list_user_roles',
    description: 'List available user roles (both default system roles and custom roles). Returns role name, whether it is a default role, parent role, and assigned permissions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        searchString: { type: 'string', description: 'Filter by role name (case-insensitive)' },
        subaccountId: { type: 'string', description: 'Filter by subaccount ID' },
        accountUserRoleOnly: { type: 'boolean', description: 'If true, only return account-level roles (not subaccount-specific)' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_get_user_role',
    description: 'Get detailed information about a specific user role, including all permission IDs, parent role, default status, and subaccount assignment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        userRoleId: { type: 'string', description: 'ID of the user role to retrieve' },
      },
      required: ['profileId', 'userRoleId'],
    },
  },
  {
    name: 'cm360_create_user_role',
    description: '[WRITE] Create a custom user role. Requires a parent role (permissions cannot exceed the parent). Use cm360_list_user_roles to find a suitable parent, and cm360_list_user_role_permissions to browse available permissions. IMPORTANT: Preview the role configuration, validate all permission IDs exist in the parent role, and confirm with the user before creating.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        name: { type: 'string', description: 'Role name (max 256 chars)' },
        parentUserRoleId: { type: 'string', description: 'Parent user role ID (child cannot exceed parent permissions)' },
        subaccountId: { type: 'string', description: 'Subaccount ID (optional — constrains available permissions)' },
        permissionIds: { type: 'array', items: { type: 'string' }, description: 'Array of permission IDs for this role (must be subset of parent)' },
      },
      required: ['profileId', 'name', 'parentUserRoleId'],
    },
  },
  {
    name: 'cm360_list_user_role_permissions',
    description: 'List all available user role permissions (~90 permissions). Returns permission name, group, and availability level. Use this catalog to browse permissions when creating custom roles.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_get_user_role_permission',
    description: 'Get details of a specific user role permission by ID. Returns permission name, group, and availability.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        permissionId: { type: 'string', description: 'Permission ID to retrieve' },
      },
      required: ['profileId', 'permissionId'],
    },
  },
  {
    name: 'cm360_list_user_role_permission_groups',
    description: 'List all permission groups (~15 groups like Campaigns, Placements, Floodlight, Reporting). Use these groups to present permissions in an organized way when creating custom roles.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_get_user_role_permission_group',
    description: 'Get details of a specific permission group by ID. Returns group name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        permissionGroupId: { type: 'string', description: 'Permission group ID to retrieve' },
      },
      required: ['profileId', 'permissionGroupId'],
    },
  },
  {
    name: 'cm360_list_subaccounts',
    description: 'List subaccounts in the CM360 account. Subaccounts partition the account for different clients or business units. Each subaccount has its own available permissions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        searchString: { type: 'string', description: 'Filter by subaccount name (case-insensitive)' },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'cm360_get_subaccount',
    description: 'Get details of a specific subaccount, including its name and available permission IDs. Use this to check what permissions are available when creating roles in a subaccount.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profileId: { type: 'string', description: 'CM360 user profile ID' },
        subaccountId: { type: 'string', description: 'Subaccount ID to retrieve' },
      },
      required: ['profileId', 'subaccountId'],
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
  // Event tags (read)
  cm360_list_event_tags: 'cm360.read_operations',
  cm360_get_event_tag: 'cm360.read_operations',
  // Event tags (write)
  cm360_create_event_tag: 'cm360.write_operations',
  cm360_update_event_tag: 'cm360.write_operations',
  cm360_delete_event_tag: 'cm360.write_operations',
  // Placement groups (read)
  cm360_list_placement_groups: 'cm360.read_operations',
  cm360_get_placement_group: 'cm360.read_operations',
  // Placement groups (write)
  cm360_create_placement_group: 'cm360.write_operations',
  cm360_update_placement_group: 'cm360.write_operations',
  // Directory sites (read)
  cm360_list_directory_sites: 'cm360.read_operations',
  cm360_get_directory_site: 'cm360.read_operations',
  // Directory sites (write — insert approves a site)
  cm360_insert_directory_site: 'cm360.write_operations',
  // Change logs (read-only audit trail)
  cm360_list_change_logs: 'cm360.read_operations',
  cm360_get_change_log: 'cm360.read_operations',
  // Reports (read-only report definitions and execution)
  cm360_list_reports: 'cm360.read_operations',
  cm360_get_report: 'cm360.read_operations',
  cm360_create_report: 'cm360.write_operations',
  cm360_run_report: 'cm360.read_operations',
  cm360_get_report_file: 'cm360.read_operations',
  cm360_query_compatible_fields: 'cm360.read_operations',
  // Floodlight (read)
  cm360_list_floodlight_activities: 'cm360.read_operations',
  cm360_get_floodlight_activity: 'cm360.read_operations',
  cm360_list_floodlight_activity_groups: 'cm360.read_operations',
  cm360_get_floodlight_activity_group: 'cm360.read_operations',
  cm360_list_floodlight_configurations: 'cm360.read_operations',
  cm360_generate_floodlight_tag: 'cm360.read_operations',
  // Floodlight (write)
  cm360_create_floodlight_activity: 'cm360.write_operations',
  cm360_create_floodlight_activity_group: 'cm360.write_operations',
  // User & Role Management (read)
  cm360_list_account_user_profiles: 'cm360.user_management',
  cm360_get_account_user_profile: 'cm360.user_management',
  cm360_list_user_roles: 'cm360.user_management',
  cm360_get_user_role: 'cm360.user_management',
  cm360_list_user_role_permissions: 'cm360.user_management',
  cm360_get_user_role_permission: 'cm360.user_management',
  cm360_list_user_role_permission_groups: 'cm360.user_management',
  cm360_get_user_role_permission_group: 'cm360.user_management',
  cm360_list_subaccounts: 'cm360.user_management',
  cm360_get_subaccount: 'cm360.user_management',
  // User & Role Management (write)
  cm360_create_account_user_profile: 'cm360.user_management',
  cm360_create_user_role: 'cm360.user_management',
  // Tag generation
  cm360_generate_tags: 'cm360.tag_generation',
  // Pacing analysis (read-only computed data)
  cm360_pacing_analysis: 'cm360.read_operations',
};

/**
 * Tools that only work in demo mode (stubbed implementation).
 * These should NOT be presented to Claude when the user has a live CM360 connection.
 */
export const STUBBED_TOOLS = new Set([
  'cm360_list_event_tags',
  'cm360_get_event_tag',
  'cm360_create_event_tag',
  'cm360_update_event_tag',
  'cm360_delete_event_tag',
  'cm360_list_placement_groups',
  'cm360_get_placement_group',
  'cm360_create_placement_group',
  'cm360_update_placement_group',
  'cm360_list_directory_sites',
  'cm360_get_directory_site',
  'cm360_insert_directory_site',
  'cm360_list_change_logs',
  'cm360_get_change_log',
]);

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
