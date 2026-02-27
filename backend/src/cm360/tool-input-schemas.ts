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

// ---------------------------------------------------------------------------
// List / Read operations
// ---------------------------------------------------------------------------

export const ListProfilesInputSchema = z.object({});

export const ListAdvertisersInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  searchString: z.string().optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const GetAdvertiserInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  advertiserId: z.string().min(1, 'Advertiser ID is required'),
});

export const ListCampaignsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  advertiserId: z.string().optional(),
  searchString: z.string().optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const ListSitesInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  searchString: z.string().optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const ListLandingPagesInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  advertiserId: z.string().min(1, 'Advertiser ID is required'),
  searchString: z.string().optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const ListPlacementsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  campaignId: z.string().optional(),
  advertiserId: z.string().optional(),
  searchString: z.string().optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const ListCreativesInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  advertiserId: z.string().min(1, 'Advertiser ID is required'),
  searchString: z.string().optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const ListAdsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  campaignId: z.string().optional(),
  advertiserId: z.string().optional(),
  searchString: z.string().optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Get (single entity) operations
// ---------------------------------------------------------------------------

export const GetCampaignInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  campaignId: z.string().min(1, 'Campaign ID is required'),
});

export const GetPlacementInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  placementId: z.string().min(1, 'Placement ID is required'),
});

export const GetAdInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  adId: z.string().min(1, 'Ad ID is required'),
});

export const GetCreativeInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  creativeId: z.string().min(1, 'Creative ID is required'),
});

export const GetLandingPageInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  landingPageId: z.string().min(1, 'Landing page ID is required'),
});

export const GetSiteInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  siteId: z.string().min(1, 'Site ID is required'),
});

export const ListSizesInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),
  iabStandard: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Update / Patch operations
// ---------------------------------------------------------------------------

export const UpdateCampaignInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
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
  profileId: z.string().min(1, 'Profile ID is required'),
  placementId: z.string().min(1, 'Placement ID is required'),
  name: z.string().min(1).max(256).optional(),
  activeStatus: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED', 'PERMANENTLY_ARCHIVED']).optional(),
  archived: z.boolean().optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
});

export const UpdateAdInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  adId: z.string().min(1, 'Ad ID is required'),
  name: z.string().min(1).max(256).optional(),
  active: z.boolean().optional(),
  archived: z.boolean().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  placementIds: z.array(z.string().min(1)).min(1).optional(),
  creativeId: z.string().min(1).optional(),
});

export const UpdateCreativeInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  creativeId: z.string().min(1, 'Creative ID is required'),
  name: z.string().min(1).max(256).optional(),
  active: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export const UpdateLandingPageInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  landingPageId: z.string().min(1, 'Landing page ID is required'),
  name: z.string().min(1).max(256).optional(),
  url: z.string().url('Must be a valid URL').optional(),
  archived: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Create / Write operations
// ---------------------------------------------------------------------------

export const CreateCampaignInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  advertiserId: z.string().min(1, 'Advertiser ID is required'),
  name: z.string().min(1, 'Campaign name is required').max(256),
  startDate: dateString,
  endDate: dateString,
  defaultLandingPageId: z.string().min(1, 'Default landing page ID is required'),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] },
);

export const CreatePlacementInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
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
  profileId: z.string().min(1, 'Profile ID is required'),
  advertiserId: z.string().min(1, 'Advertiser ID is required'),
  name: z.string().min(1, 'Landing page name is required').max(256),
  url: z.string().url('Must be a valid URL'),
});

export const CreateAdInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  name: z.string().min(1, 'Ad name is required'),
  placementIds: z.array(z.string().min(1)).min(1, 'At least one placement ID is required'),
  creativeId: z.string().min(1, 'Creative ID is required'),
});

export const CreateCreativeInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  advertiserId: z.string().min(1, 'Advertiser ID is required'),
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
  profileId: z.string().min(1, 'Profile ID is required'),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  creativeId: z.string().min(1, 'Creative ID is required'),
});

export const ListCampaignCreativeAssociationsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const UploadCreativeAssetInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  advertiserId: z.string().min(1, 'Advertiser ID is required'),
  assetName: z.string().min(1, 'Asset filename is required').max(256),
  assetType: z.enum(['HTML', 'HTML_IMAGE', 'IMAGE', 'VIDEO', 'AUDIO', 'PARENT_AUDIO', 'PARENT_VIDEO']),
  /** Base64-encoded file content */
  assetData: z.string().min(1, 'Asset data (base64) is required'),
});

// ---------------------------------------------------------------------------
// Event Tags
// ---------------------------------------------------------------------------

export const ListEventTagsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  advertiserId: z.string().optional(),
  searchString: z.string().optional(),
});

export const GetEventTagInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  eventTagId: z.string().min(1, 'Event tag ID is required'),
});

export const CreateEventTagInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  advertiserId: z.string().min(1, 'Advertiser ID is required'),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  name: z.string().min(1).max(256, 'Name must be under 256 characters'),
  url: z.string().url('Must be a valid URL'),
  type: z.enum([
    'IMPRESSION_IMAGE_EVENT_TAG',
    'IMPRESSION_JAVASCRIPT_EVENT_TAG',
    'CLICK_THROUGH_EVENT_TAG',
  ]),
  siteIds: z.array(z.string()).optional(),
  enabledByDefault: z.boolean().optional(),
});

export const UpdateEventTagInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  eventTagId: z.string().min(1, 'Event tag ID is required'),
  name: z.string().min(1).max(256).optional(),
  url: z.string().url().optional(),
  status: z.enum(['ENABLED', 'DISABLED']).optional(),
  siteIds: z.array(z.string()).optional(),
  enabledByDefault: z.boolean().optional(),
});

export const DeleteEventTagInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  eventTagId: z.string().min(1, 'Event tag ID is required'),
});

// ---------------------------------------------------------------------------
// Placement Groups
// ---------------------------------------------------------------------------

export const ListPlacementGroupsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  advertiserId: z.string().optional(),
  searchString: z.string().optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
});

export const GetPlacementGroupInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  placementGroupId: z.string().min(1, 'Placement group ID is required'),
});

export const CreatePlacementGroupInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
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
  profileId: z.string().min(1, 'Profile ID is required'),
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
  profileId: z.string().min(1, 'Profile ID is required'),
  searchString: z.string().max(256).optional(),
  active: z.boolean().optional(),
});

export const GetDirectorySiteInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  directorySiteId: z.string().min(1, 'Directory site ID is required'),
});

export const InsertDirectorySiteInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  siteId: z.string().min(1, 'Directory site ID is required'),
});

export const GenerateTagsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
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
export type DeleteEventTagInput = z.infer<typeof DeleteEventTagInputSchema>;
export type ListPlacementGroupsInput = z.infer<typeof ListPlacementGroupsInputSchema>;
export type GetPlacementGroupInput = z.infer<typeof GetPlacementGroupInputSchema>;
export type CreatePlacementGroupInput = z.infer<typeof CreatePlacementGroupInputSchema>;
export type UpdatePlacementGroupInput = z.infer<typeof UpdatePlacementGroupInputSchema>;
export type ListDirectorySitesInput = z.infer<typeof ListDirectorySitesInputSchema>;
export type GetDirectorySiteInput = z.infer<typeof GetDirectorySiteInputSchema>;
export type InsertDirectorySiteInput = z.infer<typeof InsertDirectorySiteInputSchema>;

// ---------------------------------------------------------------------------
// Change Logs (read-only audit trail)
// ---------------------------------------------------------------------------

export const ListChangeLogsInputSchema = z.object({
  profileId: z.string().min(1),
  objectType: z.enum([
    'OBJECT_ADVERTISER', 'OBJECT_CAMPAIGN', 'OBJECT_PLACEMENT',
    'OBJECT_AD', 'OBJECT_CREATIVE', 'OBJECT_LANDING_PAGE',
    'OBJECT_EVENT_TAG', 'OBJECT_PLACEMENT_GROUP',
    'OBJECT_FLOODLIGHT_ACTIVITY', 'OBJECT_SITE',
  ]).optional(),
  objectId: z.string().optional(),
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
  profileId: z.string().min(1),
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
