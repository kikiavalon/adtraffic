/**
 * CM360 API v5 core entity types.
 * Only types needed for v1 features are included.
 * Reference: https://developers.google.com/doubleclick-advertisers/rest/v5
 */

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
  status: 'APPROVED' | 'ON_HOLD';
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
  status: string;
  pricingSchedule: {
    startDate: string;
    endDate: string;
  };
  tagFormats: string[];
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
  placementAssignments: Array<{ placementId: string }>;
  creativeRotation: {
    creativeAssignments: Array<{ creativeId: string }>;
  };
}

export interface CM360Creative {
  id: string;
  name: string;
  advertiserId: string;
  type: string;
  size: CM360Size;
  active: boolean;
}

export interface CM360PlacementTag {
  placementId: string;
  tagData: Array<{
    format: string;
    impressionTag: string;
    clickTag: string;
  }>;
}

/** Generic list response wrapper */
export interface CM360ListResponse<T> {
  items: T[];
  nextPageToken?: string;
  kind: string;
}
