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

export const GenerateTagsInputSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  campaignId: z.string().min(1, 'Campaign ID is required'),
  placementIds: z.array(z.string().min(1)).min(1, 'At least one placement ID is required'),
  tagFormats: z.array(z.enum([
    'PLACEMENT_TAG_STANDARD',
    'PLACEMENT_TAG_IFRAME_JAVASCRIPT',
    'PLACEMENT_TAG_INTERNAL_REDIRECT',
    'PLACEMENT_TAG_CLICK_COMMANDS',
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
