/**
 * Zod validation schemas for all CM360 tool executor inputs.
 * These replace unsafe `as` type casts with proper runtime validation.
 *
 * Each schema mirrors the corresponding tool definition in tool-definitions.ts
 * and validates inputs before they reach the mock data store (or the real CM360 API).
 */

import { z } from 'zod';

/** CM360 date format: YYYY-MM-DD */
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format');

/** CM360 limit: click-through URL suffixes must be less than 128 characters. */
const clickThroughUrlSuffix = z.string()
  .max(127, 'Click-through URL suffix must be under 128 characters')
  .refine(
    (v) => !v.startsWith('?') && !v.startsWith('&'),
    'Suffix should be raw query parameters (e.g. "utm_source=cm360&utm_medium=display") without a leading "?" or "&" — CM360 appends the separator automatically',
  );

// ---------------------------------------------------------------------------
// List / Read operations
// ---------------------------------------------------------------------------

export const ListProfilesInputSchema = z.object({});

export const ListAdvertisersInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  searchString: z.string().max(256).optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const GetAdvertiserInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().min(1, 'Advertiser ID is required').max(50),
});

export const ListCampaignsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().max(50).optional(),
  searchString: z.string().max(256).optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const ListSitesInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  searchString: z.string().max(256).optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const ListLandingPagesInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().min(1, 'Advertiser ID is required').max(50),
  searchString: z.string().max(256).optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const ListPlacementsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  campaignId: z.string().optional(),
  advertiserId: z.string().max(50).optional(),
  searchString: z.string().max(256).optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const ListCreativesInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().min(1, 'Advertiser ID is required').max(50),
  searchString: z.string().max(256).optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const ListAdsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  campaignId: z.string().optional(),
  advertiserId: z.string().max(50).optional(),
  searchString: z.string().max(256).optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Get (single entity) operations
// ---------------------------------------------------------------------------

export const GetCampaignInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  campaignId: z.string().min(1, 'Campaign ID is required'),
});

export const GetPlacementInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  placementId: z.string().min(1, 'Placement ID is required'),
});

export const GetAdInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  adId: z.string().min(1, 'Ad ID is required'),
});

export const GetCreativeInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  creativeId: z.string().min(1, 'Creative ID is required'),
});

export const GetLandingPageInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  landingPageId: z.string().min(1, 'Landing page ID is required'),
});

export const GetSiteInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  siteId: z.string().min(1, 'Site ID is required'),
});

export const ListSizesInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),
  iabStandard: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Update / Patch operations
// ---------------------------------------------------------------------------

export const UpdateCampaignInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  name: z.string().min(1).max(256).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  archived: z.boolean().optional(),
  defaultLandingPageId: z.string().min(1).optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) return data.endDate >= data.startDate;
    return true;
  },
  { message: 'End date must be on or after start date', path: ['endDate'] },
);

export const UpdatePlacementInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  placementId: z.string().min(1, 'Placement ID is required'),
  name: z.string().min(1).max(256).optional(),
  activeStatus: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED', 'PERMANENTLY_ARCHIVED']).optional(),
  archived: z.boolean().optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
});

export const UpdateAdInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  adId: z.string().min(1, 'Ad ID is required'),
  name: z.string().min(1).max(256).optional(),
  active: z.boolean().optional(),
  archived: z.boolean().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  placementIds: z.array(z.string().min(1)).min(1).optional(),
  creativeId: z.string().min(1).optional(),
  landingPageId: z.string().min(1).max(50).optional(),
  customClickThroughUrl: z.string().url().startsWith('https://', 'Click-through URLs must be https').max(2048).optional(),
  clickThroughUrlSuffix: clickThroughUrlSuffix.optional(),
}).refine(
  (v) => !(v.landingPageId && v.customClickThroughUrl),
  { message: 'Provide landingPageId or customClickThroughUrl, not both', path: ['customClickThroughUrl'] },
);

export const UpdateCreativeInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  creativeId: z.string().min(1, 'Creative ID is required'),
  name: z.string().min(1).max(256).optional(),
  active: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export const UpdateLandingPageInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  landingPageId: z.string().min(1, 'Landing page ID is required'),
  name: z.string().min(1).max(256).optional(),
  url: z.string().url('Must be a valid URL').optional(),
  archived: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Create / Write operations
// ---------------------------------------------------------------------------

export const CreateCampaignInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().min(1, 'Advertiser ID is required').max(50),
  name: z.string().min(1, 'Campaign name is required').max(256),
  startDate: dateString,
  endDate: dateString,
  defaultLandingPageId: z.string().min(1, 'Default landing page ID is required'),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] },
);

export const CreatePlacementInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  siteId: z.string().min(1, 'Site ID is required'),
  name: z.string().min(1, 'Placement name is required').max(256),
  width: z.number().int().min(1, 'Width must be positive'),
  height: z.number().int().min(1, 'Height must be positive'),
  startDate: dateString,
  endDate: dateString,
  paymentSource: z.enum(['PLACEMENT_AGENCY_PAID', 'PLACEMENT_PUBLISHER_PAID']).optional(),
  compatibility: z.enum(['DISPLAY', 'IN_STREAM_VIDEO', 'IN_STREAM_AUDIO']).optional(),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] },
);

export const CreateLandingPageInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().min(1, 'Advertiser ID is required').max(50),
  name: z.string().min(1, 'Landing page name is required').max(256),
  url: z.string().url('Must be a valid URL'),
});

export const CreateAdInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  name: z.string().min(1, 'Ad name is required'),
  placementIds: z.array(z.string().min(1)).min(1, 'At least one placement ID is required'),
  creativeId: z.string().min(1, 'Creative ID is required'),
  landingPageId: z.string().min(1).max(50).optional(),
  customClickThroughUrl: z.string().url().startsWith('https://', 'Click-through URLs must be https').max(2048).optional(),
  clickThroughUrlSuffix: clickThroughUrlSuffix.optional(),
}).refine(
  (v) => !(v.landingPageId && v.customClickThroughUrl),
  { message: 'Provide landingPageId or customClickThroughUrl, not both', path: ['customClickThroughUrl'] },
);

export const CreateCreativeInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().min(1, 'Advertiser ID is required').max(50),
  name: z.string().min(1, 'Creative name is required').max(256),
  type: z.enum([
    'DISPLAY', 'DISPLAY_REDIRECT', 'HTML5_BANNER', 'IMAGE',
    'INTERNAL_REDIRECT', 'RICH_MEDIA_DISPLAY_BANNER', 'RICH_MEDIA_DISPLAY_EXPANDING',
    'RICH_MEDIA_DISPLAY_INTERSTITIAL', 'RICH_MEDIA_DISPLAY_MULTI_FLOATING_INTERSTITIAL',
    'RICH_MEDIA_MOBILE_IN_APP', 'RICH_MEDIA_PEEL_DOWN', 'TRACKING',
    'VAST_REDIRECT', 'VPAID_LINEAR', 'VPAID_NON_LINEAR',
  ]),
  width: z.number().int().min(1, 'Width must be positive'),
  height: z.number().int().min(1, 'Height must be positive'),
  active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Phase B: Campaign-Creative Associations + Creative Assets
// ---------------------------------------------------------------------------

export const AssociateCreativeCampaignInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  creativeId: z.string().min(1, 'Creative ID is required'),
});

export const ListCampaignCreativeAssociationsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const UploadCreativeAssetInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().min(1, 'Advertiser ID is required').max(50),
  assetName: z.string().min(1, 'Asset filename is required').max(256),
  assetType: z.enum(['HTML', 'HTML_IMAGE', 'IMAGE', 'VIDEO', 'AUDIO', 'PARENT_AUDIO', 'PARENT_VIDEO']),
  /** Base64-encoded file content */
  assetData: z.string().min(1, 'Asset data (base64) is required').max(15_000_000),
});

// ---------------------------------------------------------------------------
// Event Tags
// ---------------------------------------------------------------------------

export const ListEventTagsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  advertiserId: z.string().max(50).optional(),
  searchString: z.string().max(256).optional(),
});

export const GetEventTagInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  eventTagId: z.string().min(1, 'Event tag ID is required'),
});

export const CreateEventTagInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().min(1, 'Advertiser ID is required').max(50),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  name: z.string().min(1).max(256, 'Name must be under 256 characters'),
  url: z.string().url('Must be a valid URL').refine(
    (url) => url.startsWith('https://'),
    'Event tag URLs must use HTTPS',
  ),
  type: z.enum([
    'IMPRESSION_IMAGE_EVENT_TAG',
    'IMPRESSION_JAVASCRIPT_EVENT_TAG',
    'CLICK_THROUGH_EVENT_TAG',
  ]),
  siteIds: z.array(z.string()).optional(),
  enabledByDefault: z.boolean().optional(),
});

export const UpdateEventTagInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  eventTagId: z.string().min(1, 'Event tag ID is required'),
  name: z.string().min(1).max(256).optional(),
  url: z.string().url().refine(
    (url) => url.startsWith('https://'),
    'Event tag URLs must use HTTPS',
  ).optional(),
  status: z.enum(['ENABLED', 'DISABLED']).optional(),
  siteIds: z.array(z.string()).optional(),
  enabledByDefault: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Placement Groups
// ---------------------------------------------------------------------------

export const ListPlacementGroupsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  advertiserId: z.string().max(50).optional(),
  searchString: z.string().max(256).optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const GetPlacementGroupInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  placementGroupId: z.string().min(1, 'Placement group ID is required'),
});

export const CreatePlacementGroupInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  siteId: z.string().min(1, 'Site ID is required'),
  name: z.string().min(1, 'Placement group name is required').max(256),
  placementGroupType: z.enum(['PLACEMENT_PACKAGE', 'PLACEMENT_ROADBLOCK']),
  placementIds: z.array(z.string().min(1)).optional(),
  startDate: dateString,
  endDate: dateString,
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] },
);

export const UpdatePlacementGroupInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  placementGroupId: z.string().min(1, 'Placement group ID is required'),
  name: z.string().min(1).max(256).optional(),
  activeStatus: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  placementIds: z.array(z.string().min(1)).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) return data.endDate >= data.startDate;
    return true;
  },
  { message: 'End date must be on or after start date', path: ['endDate'] },
);

export const ListDirectorySitesInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  searchString: z.string().max(256).optional(),
  active: z.boolean().optional(),
});

export const GetDirectorySiteInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  directorySiteId: z.string().min(1, 'Directory site ID is required'),
});

export const InsertDirectorySiteInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  siteId: z.string().min(1, 'Directory site ID is required'),
});

export const GenerateTagsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  placementIds: z.array(z.string().min(1)).min(1, 'At least one placement ID is required'),
  tagFormats: z.array(z.enum([
    'PLACEMENT_TAG_STANDARD',
    'PLACEMENT_TAG_IFRAME_JAVASCRIPT',
    'PLACEMENT_TAG_INTERNAL_REDIRECT',
    'PLACEMENT_TAG_CLICK_COMMANDS',
    'PLACEMENT_TAG_VAST_2_0',
  ])).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type ListProfilesInput = z.infer<typeof ListProfilesInputSchema>;
export type ListAdvertisersInput = z.infer<typeof ListAdvertisersInputSchema>;
export type GetAdvertiserInput = z.infer<typeof GetAdvertiserInputSchema>;
export type ListCampaignsInput = z.infer<typeof ListCampaignsInputSchema>;
export type ListSitesInput = z.infer<typeof ListSitesInputSchema>;
export type ListLandingPagesInput = z.infer<typeof ListLandingPagesInputSchema>;
export type ListPlacementsInput = z.infer<typeof ListPlacementsInputSchema>;
export type ListCreativesInput = z.infer<typeof ListCreativesInputSchema>;
export type ListAdsInput = z.infer<typeof ListAdsInputSchema>;
export type CreateCampaignInput = z.infer<typeof CreateCampaignInputSchema>;
export type CreatePlacementInput = z.infer<typeof CreatePlacementInputSchema>;
export type CreateLandingPageInput = z.infer<typeof CreateLandingPageInputSchema>;
export type CreateAdInput = z.infer<typeof CreateAdInputSchema>;
export type GenerateTagsInput = z.infer<typeof GenerateTagsInputSchema>;
export type GetCampaignInput = z.infer<typeof GetCampaignInputSchema>;
export type GetPlacementInput = z.infer<typeof GetPlacementInputSchema>;
export type GetAdInput = z.infer<typeof GetAdInputSchema>;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignInputSchema>;
export type UpdatePlacementInput = z.infer<typeof UpdatePlacementInputSchema>;
export type UpdateAdInput = z.infer<typeof UpdateAdInputSchema>;
export type UpdateCreativeInput = z.infer<typeof UpdateCreativeInputSchema>;
export type UpdateLandingPageInput = z.infer<typeof UpdateLandingPageInputSchema>;
export type GetCreativeInput = z.infer<typeof GetCreativeInputSchema>;
export type GetLandingPageInput = z.infer<typeof GetLandingPageInputSchema>;
export type GetSiteInput = z.infer<typeof GetSiteInputSchema>;
export type ListSizesInput = z.infer<typeof ListSizesInputSchema>;
export type CreateCreativeInput = z.infer<typeof CreateCreativeInputSchema>;
export type AssociateCreativeCampaignInput = z.infer<typeof AssociateCreativeCampaignInputSchema>;
export type ListCampaignCreativeAssociationsInput = z.infer<typeof ListCampaignCreativeAssociationsInputSchema>;
export type UploadCreativeAssetInput = z.infer<typeof UploadCreativeAssetInputSchema>;
export type ListEventTagsInput = z.infer<typeof ListEventTagsInputSchema>;
export type GetEventTagInput = z.infer<typeof GetEventTagInputSchema>;
export type CreateEventTagInput = z.infer<typeof CreateEventTagInputSchema>;
export type UpdateEventTagInput = z.infer<typeof UpdateEventTagInputSchema>;
export type ListPlacementGroupsInput = z.infer<typeof ListPlacementGroupsInputSchema>;
export type GetPlacementGroupInput = z.infer<typeof GetPlacementGroupInputSchema>;
export type CreatePlacementGroupInput = z.infer<typeof CreatePlacementGroupInputSchema>;
export type UpdatePlacementGroupInput = z.infer<typeof UpdatePlacementGroupInputSchema>;
export type ListDirectorySitesInput = z.infer<typeof ListDirectorySitesInputSchema>;
export type GetDirectorySiteInput = z.infer<typeof GetDirectorySiteInputSchema>;
export type InsertDirectorySiteInput = z.infer<typeof InsertDirectorySiteInputSchema>;

// ---------------------------------------------------------------------------
// Floodlight Activities
// ---------------------------------------------------------------------------

export const ListFloodlightActivitiesInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().min(1, 'Advertiser ID is required').max(50),
  floodlightActivityGroupId: z.string().optional(),
  searchString: z.string().max(256).optional(),
});

export const GetFloodlightActivityInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  floodlightActivityId: z.string().min(1, 'Floodlight activity ID is required'),
});

export const CreateFloodlightActivityInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().min(1, 'Advertiser ID is required').max(50),
  floodlightActivityGroupId: z.string().min(1, 'Activity group ID is required'),
  name: z.string().min(1).max(256, 'Name must be under 256 characters'),
  type: z.enum(['COUNTER', 'SALE']),
  countingMethod: z.enum(['STANDARD_COUNTING', 'UNIQUE_COUNTING', 'SESSION_COUNTING']),
  tagString: z.string().min(1).max(256, 'Tag string must be under 256 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Tag string may only contain letters, numbers, and underscores'),
  tagFormat: z.enum(['HTML', 'XHTML', 'GLOBAL_SITE_TAG']).optional(),
  expectedUrl: z.string().url().optional(),
  notes: z.string().max(1024).optional(),
}).refine(
  (data) => {
    // GLOBAL_SITE_TAG is only valid for COUNTER activities
    if (data.tagFormat === 'GLOBAL_SITE_TAG' && data.type === 'SALE') {
      return false;
    }
    return true;
  },
  { message: 'GLOBAL_SITE_TAG format is not compatible with SALE activity type', path: ['tagFormat'] },
);

export const GenerateFloodlightTagInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  floodlightActivityId: z.string().min(1, 'Floodlight activity ID is required'),
});

// ---------------------------------------------------------------------------
// Floodlight Activity Groups
// ---------------------------------------------------------------------------

export const ListFloodlightActivityGroupsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().min(1, 'Advertiser ID is required').max(50),
  searchString: z.string().max(256).optional(),
});

export const GetFloodlightActivityGroupInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  floodlightActivityGroupId: z.string().min(1, 'Activity group ID is required'),
});

export const CreateFloodlightActivityGroupInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().min(1, 'Advertiser ID is required').max(50),
  name: z.string().min(1).max(256, 'Name must be under 256 characters'),
  type: z.enum(['COUNTER', 'SALE']),
  tagString: z.string().min(1).max(256, 'Tag string must be under 256 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Tag string may only contain letters, numbers, and underscores'),
});

// ---------------------------------------------------------------------------
// Floodlight Configurations (read-only)
// ---------------------------------------------------------------------------

export const ListFloodlightConfigurationsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  advertiserId: z.string().min(1, 'Advertiser ID is required').max(50),
});

export type ListFloodlightActivitiesInput = z.infer<typeof ListFloodlightActivitiesInputSchema>;
export type GetFloodlightActivityInput = z.infer<typeof GetFloodlightActivityInputSchema>;
export type CreateFloodlightActivityInput = z.infer<typeof CreateFloodlightActivityInputSchema>;
export type GenerateFloodlightTagInput = z.infer<typeof GenerateFloodlightTagInputSchema>;
export type ListFloodlightActivityGroupsInput = z.infer<typeof ListFloodlightActivityGroupsInputSchema>;
export type GetFloodlightActivityGroupInput = z.infer<typeof GetFloodlightActivityGroupInputSchema>;
export type CreateFloodlightActivityGroupInput = z.infer<typeof CreateFloodlightActivityGroupInputSchema>;
export type ListFloodlightConfigurationsInput = z.infer<typeof ListFloodlightConfigurationsInputSchema>;

// ---------------------------------------------------------------------------
// Change Logs (read-only audit trail)
// ---------------------------------------------------------------------------

export const ListChangeLogsInputSchema = z.object({
  profileId: z.string().min(1).max(50),
  objectType: z.enum([
    'OBJECT_ADVERTISER', 'OBJECT_CAMPAIGN', 'OBJECT_PLACEMENT',
    'OBJECT_AD', 'OBJECT_CREATIVE', 'OBJECT_LANDING_PAGE',
    'OBJECT_EVENT_TAG', 'OBJECT_PLACEMENT_GROUP',
    'OBJECT_FLOODLIGHT_ACTIVITY', 'OBJECT_SITE',
  ]).optional(),
  objectId: z.string().max(50).optional(),
  action: z.enum([
    'ACTION_CREATE', 'ACTION_UPDATE', 'ACTION_DELETE',
    'ACTION_ACTIVATE', 'ACTION_DEACTIVATE', 'ACTION_ARCHIVE',
  ]).optional(),
  minChangeTime: z.string().optional(),
  maxChangeTime: z.string().optional(),
  searchString: z.string().max(256).optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const GetChangeLogInputSchema = z.object({
  profileId: z.string().min(1).max(50),
  changeLogId: z.string().min(1),
});

export type ListChangeLogsInput = z.infer<typeof ListChangeLogsInputSchema>;
export type GetChangeLogInput = z.infer<typeof GetChangeLogInputSchema>;

// ---------------------------------------------------------------------------
// Reports (read-only saved report definitions)
// ---------------------------------------------------------------------------

export const ListReportsInputSchema = z.object({
  profileId: z.string().max(50),
  maxResults: z.number().min(1).max(100).optional(),
  pageToken: z.string().max(500).optional(),
});

export const GetReportInputSchema = z.object({
  profileId: z.string().max(50),
  reportId: z.string().max(50),
});

export type ListReportsInput = z.infer<typeof ListReportsInputSchema>;
export type GetReportInput = z.infer<typeof GetReportInputSchema>;

// Report execution and file retrieval

export const RunReportInputSchema = z.object({
  profileId: z.string().max(50),
  reportId: z.string().max(50),
});

export const GetReportFileInputSchema = z.object({
  profileId: z.string().max(50),
  reportId: z.string().max(50),
  fileId: z.string().max(50),
  maxRows: z.number().min(1).max(200).optional(),
});

export const QueryCompatibleFieldsInputSchema = z.object({
  profileId: z.string().max(50),
  reportType: z.enum(['STANDARD', 'REACH', 'PATH_TO_CONVERSION', 'FLOODLIGHT', 'CROSS_MEDIA_REACH']),
});

export type RunReportInput = z.infer<typeof RunReportInputSchema>;
export type GetReportFileInput = z.infer<typeof GetReportFileInputSchema>;
export type QueryCompatibleFieldsInput = z.infer<typeof QueryCompatibleFieldsInputSchema>;

export const CreateReportInputSchema = z.object({
  profileId: z.string().max(50),
  name: z.string().min(1).max(200),
  type: z.enum(['STANDARD', 'REACH', 'PATH_TO_CONVERSION', 'FLOODLIGHT', 'CROSS_MEDIA_REACH']),
  dimensions: z.array(z.string().max(100)).min(1).max(20),
  metricNames: z.array(z.string().max(100)).min(1).max(20),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  filters: z.array(z.object({
    dimensionName: z.string().max(100),
    value: z.string().max(500),
  })).max(20).optional(),
});

export type CreateReportInput = z.infer<typeof CreateReportInputSchema>;

// ---------------------------------------------------------------------------
// Pacing Analysis
// ---------------------------------------------------------------------------

export const PacingAnalysisInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required').max(50),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  advertiserId: z.string().max(50).optional(),
});

export type PacingAnalysisInput = z.infer<typeof PacingAnalysisInputSchema>;

// ---------------------------------------------------------------------------
// User & Role Management
// ---------------------------------------------------------------------------

export const ListAccountUserProfilesInputSchema = z.object({
  profileId: z.string().max(50),
  searchString: z.string().max(200).optional(),
  userRoleId: z.string().max(50).optional(),
  subaccountId: z.string().max(50).optional(),
  active: z.boolean().optional(),
  maxResults: z.number().min(1).max(1000).optional(),
});

export const GetAccountUserProfileInputSchema = z.object({
  profileId: z.string().max(50),
  accountUserProfileId: z.string().max(50),
});

export const CreateAccountUserProfileInputSchema = z.object({
  profileId: z.string().max(50),
  email: z.string().email().max(200),
  name: z.string().min(1).max(64).regex(/^[^&;<>"#%,\s]+$/, 'Name must not contain &, ;, <, >, ", #, %, comma, or whitespace'),
  userRoleId: z.string().max(50),
  subaccountId: z.string().max(50).optional(),
  locale: z.enum(['en', 'en-GB', 'fr', 'de', 'es', 'it', 'ja', 'ko', 'pt-BR', 'ru', 'zh-CN', 'zh-TW', 'nl', 'pl', 'sv', 'tr']).optional(),
  active: z.boolean().optional(),
  siteFilter: z.object({
    status: z.enum(['NONE', 'ALL', 'ASSIGNED']),
    objectIds: z.array(z.string().max(50)).default([]),
  }).optional(),
  campaignFilter: z.object({
    status: z.enum(['NONE', 'ALL', 'ASSIGNED']),
    objectIds: z.array(z.string().max(50)).default([]),
  }).optional(),
  advertiserFilter: z.object({
    status: z.enum(['NONE', 'ALL', 'ASSIGNED']),
    objectIds: z.array(z.string().max(50)).default([]),
  }).optional(),
  userRoleFilter: z.object({
    status: z.enum(['NONE', 'ALL', 'ASSIGNED']),
    objectIds: z.array(z.string().max(50)).default([]),
  }).optional(),
});

export const ListUserRolesInputSchema = z.object({
  profileId: z.string().max(50),
  searchString: z.string().max(200).optional(),
  subaccountId: z.string().max(50).optional(),
  accountUserRoleOnly: z.boolean().optional(),
});

export const GetUserRoleInputSchema = z.object({
  profileId: z.string().max(50),
  userRoleId: z.string().max(50),
});

export const CreateUserRoleInputSchema = z.object({
  profileId: z.string().max(50),
  name: z.string().min(1).max(256),
  parentUserRoleId: z.string().max(50),
  subaccountId: z.string().max(50).optional(),
  permissionIds: z.array(z.string().max(50)).optional(),
});

export const ListUserRolePermissionsInputSchema = z.object({
  profileId: z.string().max(50),
});

export const GetUserRolePermissionInputSchema = z.object({
  profileId: z.string().max(50),
  permissionId: z.string().max(50),
});

export const ListUserRolePermissionGroupsInputSchema = z.object({
  profileId: z.string().max(50),
});

export const GetUserRolePermissionGroupInputSchema = z.object({
  profileId: z.string().max(50),
  permissionGroupId: z.string().max(50),
});

export const ListSubaccountsInputSchema = z.object({
  profileId: z.string().max(50),
  searchString: z.string().max(200).optional(),
});

export const GetSubaccountInputSchema = z.object({
  profileId: z.string().max(50),
  subaccountId: z.string().max(50),
});

export type ListAccountUserProfilesInput = z.infer<typeof ListAccountUserProfilesInputSchema>;
export type GetAccountUserProfileInput = z.infer<typeof GetAccountUserProfileInputSchema>;
export type CreateAccountUserProfileInput = z.infer<typeof CreateAccountUserProfileInputSchema>;
export type ListUserRolesInput = z.infer<typeof ListUserRolesInputSchema>;
export type GetUserRoleInput = z.infer<typeof GetUserRoleInputSchema>;
export type CreateUserRoleInput = z.infer<typeof CreateUserRoleInputSchema>;
export type ListUserRolePermissionsInput = z.infer<typeof ListUserRolePermissionsInputSchema>;
export type GetUserRolePermissionInput = z.infer<typeof GetUserRolePermissionInputSchema>;
export type ListUserRolePermissionGroupsInput = z.infer<typeof ListUserRolePermissionGroupsInputSchema>;
export type GetUserRolePermissionGroupInput = z.infer<typeof GetUserRolePermissionGroupInputSchema>;
export type ListSubaccountsInput = z.infer<typeof ListSubaccountsInputSchema>;
export type GetSubaccountInput = z.infer<typeof GetSubaccountInputSchema>;

// ---------------------------------------------------------------------------
// Helper: format Zod errors into a readable string
// ---------------------------------------------------------------------------

export function formatZodErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
}
