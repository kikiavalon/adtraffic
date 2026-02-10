import { z } from 'zod';

/** Date format: YYYY-MM-DD */
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format');

export const CreateCampaignSchema = z.object({
  advertiserId: z.string().min(1, 'Advertiser ID is required'),
  name: z.string().min(1, 'Campaign name is required').max(256),
  startDate: dateString,
  endDate: dateString,
  defaultLandingPageId: z.string().min(1, 'Default landing page ID is required'),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

export const CreatePlacementSchema = z.object({
  campaignId: z.string().min(1, 'Campaign ID is required'),
  siteId: z.string().min(1, 'Site ID is required'),
  name: z.string().min(1, 'Placement name is required').max(256),
  size: z.object({
    width: z.number().int().min(1).max(32767),
    height: z.number().int().min(1).max(32767),
  }),
  startDate: dateString,
  endDate: dateString,
  paymentSource: z.enum(['PLACEMENT_AGENCY_PAID', 'PLACEMENT_PUBLISHER_PAID']).optional(),
  compatibility: z.enum(['DISPLAY', 'IN_STREAM_VIDEO', 'IN_STREAM_AUDIO']).optional(),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

export const CreateLandingPageSchema = z.object({
  advertiserId: z.string().min(1, 'Advertiser ID is required'),
  name: z.string().min(1, 'Landing page name is required').max(256),
  url: z.string().url('Must be a valid URL'),
});

export const ListFilterSchema = z.object({
  advertiserId: z.string().optional(),
  campaignId: z.string().optional(),
  searchString: z.string().optional(),
  maxResults: z.number().int().min(1).max(1000).optional().default(100),
  pageToken: z.string().optional(),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
export type CreatePlacementInput = z.infer<typeof CreatePlacementSchema>;
export type CreateLandingPageInput = z.infer<typeof CreateLandingPageSchema>;
export type ListFilter = z.infer<typeof ListFilterSchema>;
