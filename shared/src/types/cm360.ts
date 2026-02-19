/**
 * CM360 API v5 core entity types.
 * Only types needed for v1 features are included.
 * Reference: https://developers.google.com/doubleclick-advertisers/rest/v5
 */

/** CM360 placement status values per API v5 (publisher-facing status) */
export type CM360PlacementStatus =
  | 'PENDING_REVIEW'
  | 'PAYMENT_ACCEPTED'
  | 'PAYMENT_REJECTED'
  | 'ACKNOWLEDGE_REJECTION'
  | 'ACKNOWLEDGE_ACCEPTANCE'
  | 'DRAFT';

/** CM360 placement active status (operational status, separate from publisher-facing status) */
export type CM360PlacementActiveStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ARCHIVED'
  | 'PERMANENTLY_ARCHIVED';

/** CM360 creative type values per API v5 */
export type CM360CreativeType =
  | 'DISPLAY'
  | 'DISPLAY_REDIRECT'
  | 'HTML5_BANNER'
  | 'IMAGE'
  | 'INTERNAL_REDIRECT'
  | 'RICH_MEDIA_DISPLAY_BANNER'
  | 'RICH_MEDIA_DISPLAY_EXPANDING'
  | 'RICH_MEDIA_DISPLAY_INTERSTITIAL'
  | 'RICH_MEDIA_DISPLAY_MULTI_FLOATING_INTERSTITIAL'
  | 'RICH_MEDIA_MOBILE_IN_APP'
  | 'RICH_MEDIA_PEEL_DOWN'
  | 'TRACKING'
  | 'VAST_REDIRECT'
  | 'VPAID_LINEAR'
  | 'VPAID_NON_LINEAR';

/** CM360 placement tag format values per API v5 */
export type CM360TagFormat =
  | 'PLACEMENT_TAG_STANDARD'
  | 'PLACEMENT_TAG_IFRAME_JAVASCRIPT'
  | 'PLACEMENT_TAG_IFRAME_JAVASCRIPT_LEGACY'
  | 'PLACEMENT_TAG_INTERNAL_REDIRECT'
  | 'PLACEMENT_TAG_JAVASCRIPT'
  | 'PLACEMENT_TAG_INTERSTITIAL_IFRAME_JAVASCRIPT'
  | 'PLACEMENT_TAG_INTERSTITIAL_INTERNAL_REDIRECT'
  | 'PLACEMENT_TAG_INTERSTITIAL_JAVASCRIPT'
  | 'PLACEMENT_TAG_CLICK_COMMANDS'
  | 'PLACEMENT_TAG_TRACKING'
  | 'PLACEMENT_TAG_TRACKING_IFRAME'
  | 'PLACEMENT_TAG_TRACKING_JAVASCRIPT';

/** CM360 advertiser status values per API v5 */
export type CM360AdvertiserStatus = 'APPROVED' | 'ON_HOLD' | 'ARCHIVED';

/** CM360 build operation resource types */
export type CM360BuildResource = 'campaign' | 'placement' | 'ad' | 'creative' | 'landingPage' | 'site';

export interface CM360UserProfile {
  profileId: string;
  accountId: string;
  accountName: string;
  userName: string;
  etag: string;
}

export interface CM360Advertiser {
  id: string;
  name: string;
  accountId: string;
  status: CM360AdvertiserStatus;
  floodlightConfigurationId?: string;
}

export interface CM360Campaign {
  id: string;
  name: string;
  accountId: string;
  advertiserId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  defaultLandingPageId: string;
  archived: boolean;
}

export interface CM360CreateCampaignInput {
  advertiserId: string;
  name: string;
  startDate: string;
  endDate: string;
  defaultLandingPageId: string;
}

export interface CM360Site {
  id: string;
  name: string;
  accountId: string;
  approved: boolean;
  directorySiteId?: string;
}

export interface CM360Size {
  id: string;
  width: number;
  height: number;
  iab: boolean;
}

export interface CM360LandingPage {
  id: string;
  name: string;
  advertiserId: string;
  url: string;
  archived: boolean;
}

export interface CM360CreateLandingPageInput {
  advertiserId: string;
  name: string;
  url: string;
}

export interface CM360Placement {
  id: string;
  name: string;
  accountId: string;
  advertiserId: string;
  campaignId: string;
  siteId: string;
  size: CM360Size;
  status: CM360PlacementStatus;
  activeStatus: CM360PlacementActiveStatus;
  pricingSchedule: {
    startDate: string;
    endDate: string;
  };
  tagFormats: CM360TagFormat[];
  archived?: boolean;
}

export interface CM360CreatePlacementInput {
  campaignId: string;
  siteId: string;
  name: string;
  size: { width: number; height: number };
  startDate: string;
  endDate: string;
  paymentSource?: 'PLACEMENT_AGENCY_PAID' | 'PLACEMENT_PUBLISHER_PAID';
  compatibility?: 'DISPLAY' | 'IN_STREAM_VIDEO' | 'IN_STREAM_AUDIO';
}

export interface CM360PlacementGroup {
  id: string;
  name: string;
  accountId?: string;
  advertiserId?: string;
  campaignId: string;
  siteId: string;
  placementGroupType: 'PLACEMENT_PACKAGE' | 'PLACEMENT_ROADBLOCK';
  pricingSchedule: {
    startDate: string;
    endDate: string;
  };
}

export interface CM360Ad {
  id: string;
  name: string;
  campaignId: string;
  advertiserId: string;
  active: boolean;
  archived: boolean;
  startTime?: string;
  endTime?: string;
  placementAssignments: Array<{ placementId: string }>;
  creativeRotation: {
    creativeAssignments: Array<{ creativeId: string }>;
  };
}

export interface CM360Creative {
  id: string;
  name: string;
  advertiserId: string;
  type: CM360CreativeType;
  size: CM360Size;
  active: boolean;
  archived: boolean;
}

export interface CM360PlacementTag {
  placementId: string;
  tagData: Array<{
    format: CM360TagFormat;
    impressionTag: string;
    clickTag: string;
  }>;
}

// ---------------------------------------------------------------------------
// Update / Patch input types
// ---------------------------------------------------------------------------

export interface CM360UpdateCampaignInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  archived?: boolean;
  defaultLandingPageId?: string;
}

export interface CM360UpdatePlacementInput {
  name?: string;
  activeStatus?: CM360PlacementActiveStatus;
  archived?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface CM360UpdateAdInput {
  name?: string;
  active?: boolean;
  archived?: boolean;
  startTime?: string;
  endTime?: string;
  placementIds?: string[];
  creativeId?: string;
}

export interface CM360UpdateCreativeInput {
  name?: string;
  active?: boolean;
  archived?: boolean;
}

export interface CM360UpdateLandingPageInput {
  name?: string;
  url?: string;
  archived?: boolean;
}

/** Generic list response wrapper */
export interface CM360ListResponse<T> {
  items: T[];
  nextPageToken?: string;
  kind: string;
}
