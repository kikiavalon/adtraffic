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
  | 'PLACEMENT_TAG_TRACKING_JAVASCRIPT'
  | 'PLACEMENT_TAG_INSTREAM_VIDEO_PREFETCH'
  | 'PLACEMENT_TAG_INSTREAM_VIDEO_PREFETCH_VAST_3'
  | 'PLACEMENT_TAG_INSTREAM_VIDEO_PREFETCH_VAST_4'
  | 'PLACEMENT_TAG_VAST_2_0';

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
  clickThroughUrlSuffix?: string;
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
  clickThroughUrlSuffixProperties?: CM360ClickThroughUrlSuffixProperties;
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
  compatibility?: 'DISPLAY' | 'IN_STREAM_VIDEO' | 'IN_STREAM_AUDIO';
  pricingSchedule: {
    startDate: string;
    endDate: string;
    pricingType?: 'CPM' | 'CPC' | 'CPA' | 'FLAT_RATE_IMPRESSIONS' | 'FLAT_RATE_CLICKS';
    pricingPeriods?: Array<{
      startDate: string;
      endDate: string;
      rateOrCostNanos: number;
      units: number;
    }>;
  };
  tagFormats: CM360TagFormat[];
  paymentSource?: 'PLACEMENT_AGENCY_PAID' | 'PLACEMENT_PUBLISHER_PAID';
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

/** Placement group types: PLACEMENT_PACKAGE bundles for billing; PLACEMENT_ROADBLOCK for simultaneous delivery */
export type CM360PlacementGroupType = 'PLACEMENT_PACKAGE' | 'PLACEMENT_ROADBLOCK';

export interface CM360PlacementGroup {
  id: string;
  name: string;
  accountId: string;
  advertiserId: string;
  campaignId: string;
  siteId: string;
  placementGroupType: CM360PlacementGroupType;
  placementIds: string[];
  activeStatus: 'ACTIVE' | 'ARCHIVED';
  pricingSchedule: {
    startDate: string;
    endDate: string;
  };
}

export interface CM360CreatePlacementGroupInput {
  campaignId: string;
  siteId: string;
  name: string;
  placementGroupType: CM360PlacementGroupType;
  placementIds?: string[];
  startDate: string;
  endDate: string;
}

export interface CM360UpdatePlacementGroupInput {
  name?: string;
  activeStatus?: 'ACTIVE' | 'ARCHIVED';
  placementIds?: string[];
  startDate?: string;
  endDate?: string;
}

/** Click-through URL on a creative assignment (CM360 API v5 ClickThroughUrl). */
export interface CM360ClickThroughUrl {
  defaultLandingPage?: boolean;
  landingPageId?: string;
  customClickThroughUrl?: string;
  /** Read-only: the URL CM360 resolved from the precedence rules. */
  computedClickThroughUrl?: string;
}

/** URL suffix properties (campaign and ad level). Lower levels override, never append. */
export interface CM360ClickThroughUrlSuffixProperties {
  clickThroughUrlSuffix?: string;
  overrideInheritedSuffix?: boolean;
}

export interface CM360Ad {
  id: string;
  name: string;
  campaignId: string;
  advertiserId: string;
  type: CM360AdType;
  active: boolean;
  archived: boolean;
  startTime?: string;
  endTime?: string;
  clickThroughUrlSuffixProperties?: CM360ClickThroughUrlSuffixProperties;
  placementAssignments: Array<{ placementId: string }>;
  creativeRotation: {
    type: CM360CreativeRotationType;
    creativeAssignments: Array<{ creativeId: string; clickThroughUrl?: CM360ClickThroughUrl }>;
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
// Create input types (non-standard entities)
// ---------------------------------------------------------------------------

export interface CM360CreateCreativeInput {
  advertiserId: string;
  name: string;
  type: CM360CreativeType;
  size: { width: number; height: number };
  active?: boolean;
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
  landingPageId?: string;
  customClickThroughUrl?: string;
  /** Ad-level suffix override (stored as clickThroughUrlSuffixProperties with
   * overrideInheritedSuffix; blank clears the inherited suffix). Under 128 chars. */
  clickThroughUrlSuffix?: string;
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

// ---------------------------------------------------------------------------
// Campaign-Creative Associations (Phase B)
// ---------------------------------------------------------------------------

/** Represents a creative assigned to a campaign. Required before an ad can reference the creative. */
export interface CM360CampaignCreativeAssociation {
  creativeId: string;
  kind?: string;
}

// ---------------------------------------------------------------------------
// Creative Assets (Phase B)
// ---------------------------------------------------------------------------

/** Creative asset types supported by CM360 */
export type CM360CreativeAssetType = 'HTML' | 'HTML_IMAGE' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'PARENT_AUDIO' | 'PARENT_VIDEO';

/** Result of uploading a creative asset to CM360 */
export interface CM360CreativeAssetMetadata {
  assetIdentifier: {
    name: string;
    type: CM360CreativeAssetType;
  };
  id: string;
  /** File size in bytes */
  fileSize?: number;
  /** Detected dimensions (images/video) */
  detectedFeatures?: string[];
}

/** Creative rotation strategy for ads with multiple creatives */
export type CM360CreativeRotationType =
  | 'CREATIVE_ROTATION_TYPE_RANDOM'
  | 'CREATIVE_ROTATION_TYPE_SEQUENTIAL'
  | 'CREATIVE_ROTATION_TYPE_CUSTOM';

/** Ad serving type */
export type CM360AdType =
  | 'AD_SERVING_DEFAULT_AD'
  | 'AD_SERVING_CLICK_TRACKER'
  | 'AD_SERVING_TRACKING'
  | 'AD_SERVING_BRAND_SAFE_AD';

// --- Event Tags ---

export type CM360EventTagType =
  | 'IMPRESSION_IMAGE_EVENT_TAG'
  | 'IMPRESSION_JAVASCRIPT_EVENT_TAG'
  | 'CLICK_THROUGH_EVENT_TAG';

export type CM360EventTagStatus = 'ENABLED' | 'DISABLED';

export interface CM360EventTag {
  id: string;
  accountId: string;
  advertiserId: string;
  campaignId: string;
  name: string;
  url: string;
  type: CM360EventTagType;
  status: CM360EventTagStatus;
  siteIds: string[];
  enabledByDefault: boolean;
  excludeFromAdxRequests: boolean;
  sslCompliant: boolean;
}

export interface CM360CreateEventTagInput {
  advertiserId: string;
  campaignId: string;
  name: string;
  url: string;
  type: CM360EventTagType;
  siteIds?: string[];
  enabledByDefault?: boolean;
}

export interface CM360UpdateEventTagInput {
  id: string;
  name?: string;
  url?: string;
  status?: CM360EventTagStatus;
  siteIds?: string[];
  enabledByDefault?: boolean;
}

// ---------------------------------------------------------------------------
// Change Logs — audit trail tracking who changed what and when
// ---------------------------------------------------------------------------

export type CM360ChangeLogObjectType =
  | 'OBJECT_ADVERTISER'
  | 'OBJECT_CAMPAIGN'
  | 'OBJECT_PLACEMENT'
  | 'OBJECT_AD'
  | 'OBJECT_CREATIVE'
  | 'OBJECT_LANDING_PAGE'
  | 'OBJECT_EVENT_TAG'
  | 'OBJECT_PLACEMENT_GROUP'
  | 'OBJECT_FLOODLIGHT_ACTIVITY'
  | 'OBJECT_SITE';

export type CM360ChangeLogAction =
  | 'ACTION_CREATE'
  | 'ACTION_UPDATE'
  | 'ACTION_DELETE'
  | 'ACTION_ACTIVATE'
  | 'ACTION_DEACTIVATE'
  | 'ACTION_ARCHIVE';

export interface CM360ChangeLog {
  id: string;
  userProfileId: string;
  userProfileName: string;
  objectType: CM360ChangeLogObjectType;
  objectId: string;
  action: CM360ChangeLogAction;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  changeTime: string;
}

// ---------------------------------------------------------------------------
// Directory Sites — Google's publisher catalog for site discovery
// ---------------------------------------------------------------------------

/** A site entry from Google's publisher directory. */
export interface CM360DirectorySite {
  id: string;
  name: string;
  url: string;
  active: boolean;
  interstitialTagFormats: CM360TagFormat[];
  inpageTagFormats: CM360TagFormat[];
}

/** Input for inserting (approving) a directory site as a CM360 trafficking target. */
export interface CM360InsertDirectorySiteInput {
  siteId: string;
}

// ---------------------------------------------------------------------------
// Reporting — basic list/get for saved reports
// ---------------------------------------------------------------------------

/** CM360 report types */
export type CM360ReportType =
  | 'STANDARD'
  | 'REACH'
  | 'PATH_TO_CONVERSION'
  | 'FLOODLIGHT'
  | 'CROSS_MEDIA_REACH';

/** A CM360 saved report definition */
export interface CM360Report {
  id: string;
  name: string;
  type: CM360ReportType;
  accountId: string;
  ownerProfileId: string;
  criteria: {
    dateRange: { startDate: string; endDate: string; relativeDateRange?: string };
    dimensions: string[];
    metricNames: string[];
    filters?: Array<{ dimensionName: string; value: string }>;
  };
  schedule?: {
    active: boolean;
    repeats: string;
    every: number;
  };
  lastModifiedTime: string;
}

// ---------------------------------------------------------------------------
// Reporting — report execution and compatible fields
// ---------------------------------------------------------------------------

/** Status of a report file after execution */
export type CM360ReportFileStatus = 'PROCESSING' | 'REPORT_AVAILABLE' | 'CANCELLED' | 'FAILED';

/** A report file — the result of running a report */
export interface CM360ReportFile {
  reportId: string;
  fileId: string;
  status: CM360ReportFileStatus;
  fileName?: string;
  /** ISO date string when the file was last modified */
  dateRange?: { startDate: string; endDate: string };
  /** Parsed report data (only present when status is REPORT_AVAILABLE) */
  totalRows?: number;
  rowsReturned?: number;
  truncated?: boolean;
  columns?: string[];
  rows?: Array<Record<string, string>>;
  summary?: {
    totalImpressions?: number;
    totalClicks?: number;
    averageCTR?: number;
    totalConversions?: number;
    totalSpend?: number;
    totalVideoViews?: number;
    totalVideoCompletions?: number;
  };
  cm360Link: string;
  message?: string;
}

/** Compatible fields response for a given report type */
export interface CM360CompatibleFields {
  reportType: CM360ReportType;
  dimensions: string[];
  metrics: string[];
  dimensionFilters: string[];
  pivotedActivityMetrics: string[];
}

/** Input for creating a new report definition */
export interface CM360CreateReportInput {
  name: string;
  type: CM360ReportType;
  dimensions: string[];
  metricNames: string[];
  startDate: string;
  endDate: string;
  filters?: Array<{ dimensionName: string; value: string }>;
}

// ---------------------------------------------------------------------------
// Floodlight — conversion tracking (activities, groups, configurations)
// ---------------------------------------------------------------------------

/** Floodlight activity type — determines available counting methods. Immutable after creation. */
export type CM360FloodlightActivityType = 'COUNTER' | 'SALE';

/** Counting method for Counter activities */
export type CM360FloodlightCountingMethod =
  | 'STANDARD_COUNTING'
  | 'UNIQUE_COUNTING'
  | 'SESSION_COUNTING';

/** Tag format for Floodlight tags */
export type CM360FloodlightTagFormat =
  | 'HTML'
  | 'XHTML'
  | 'GLOBAL_SITE_TAG';

/** Floodlight activity status */
export type CM360FloodlightActivityStatus = 'ACTIVE' | 'ARCHIVED_AND_DISABLED';

/** A single Floodlight activity (conversion event) */
export interface CM360FloodlightActivity {
  id: string;
  name: string;
  accountId: string;
  advertiserId: string;
  floodlightConfigurationId: string;
  floodlightActivityGroupId: string;
  floodlightActivityGroupName: string;
  floodlightActivityGroupType: CM360FloodlightActivityType;
  /** Activity type — Counter (page visits, form submits) or Sale (purchases with revenue). Immutable after creation. */
  type: CM360FloodlightActivityType;
  countingMethod: CM360FloodlightCountingMethod;
  /** Tag string used in tag code (e.g., "apex_newsletter_signup") */
  tagString: string;
  tagFormat: CM360FloodlightTagFormat;
  /** Expected URL where the tag fires */
  expectedUrl?: string;
  /** Custom Floodlight variables (u1-u100) */
  customFloodlightVariables?: Array<{ type: string; value: string }>;
  /** Whether this activity is synced from SA360 */
  floodlightTagType?: 'GLOBAL_SITE_TAG' | 'IFRAME' | 'IMAGE';
  cacheBustingType?: 'JAVASCRIPT' | 'ACTIVE_SERVER_PAGE' | 'JSP' | 'PHP' | 'COLD_FUSION';
  status: CM360FloodlightActivityStatus;
  /** Whether synced from SA360 (shared activity) */
  sslRequired: boolean;
  /** Notes for the activity */
  notes?: string;
}

/** Input for creating a new Floodlight activity */
export interface CM360CreateFloodlightActivityInput {
  advertiserId: string;
  floodlightActivityGroupId: string;
  name: string;
  type: CM360FloodlightActivityType;
  countingMethod: CM360FloodlightCountingMethod;
  tagString: string;
  tagFormat?: CM360FloodlightTagFormat;
  expectedUrl?: string;
  notes?: string;
}

/** Floodlight activity group — organizational container for activities */
export interface CM360FloodlightActivityGroup {
  id: string;
  name: string;
  accountId: string;
  advertiserId: string;
  floodlightConfigurationId: string;
  /** Group type determines what kinds of activities can be in this group */
  type: CM360FloodlightActivityType;
  tagString: string;
}

/** Input for creating a new Floodlight activity group */
export interface CM360CreateFloodlightActivityGroupInput {
  advertiserId: string;
  name: string;
  type: CM360FloodlightActivityType;
  tagString: string;
}

/** Account-level Floodlight configuration (read-only in Kiki) */
export interface CM360FloodlightConfiguration {
  id: string;
  accountId: string;
  advertiserId: string;
  /** Click-through lookback window in days */
  lookbackClickDays: number;
  /** View-through lookback window in days */
  lookbackImpressionDays: number;
  /** Default tag format for new activities */
  naturalSearchConversionAttributionOption: string;
  tagSettings: {
    dynamicTagEnabled: boolean;
    imageTagEnabled: boolean;
  };
}

/** Generated Floodlight tag (gtag.js / iframe / image snippet) */
export interface CM360FloodlightTag {
  globalSiteTagGlobalSnippet?: string;
  globalSiteTagEventSnippet?: string;
  iframeTag?: string;
  imageTag?: string;
}

// ---------------------------------------------------------------------------
// User & Role Management
// ---------------------------------------------------------------------------

/** ObjectFilter status — controls user access to entities */
export type CM360ObjectFilterStatus = 'NONE' | 'ALL' | 'ASSIGNED';

/** An ObjectFilter controlling user access to a category of entities */
export interface CM360ObjectFilter {
  status: CM360ObjectFilterStatus;
  objectIds: string[];
}

/** Locale for user profile (subset of supported locales) */
export type CM360UserLocale =
  | 'en' | 'en-GB' | 'fr' | 'de' | 'es' | 'it' | 'ja' | 'ko'
  | 'pt-BR' | 'ru' | 'zh-CN' | 'zh-TW' | 'nl' | 'pl' | 'sv' | 'tr';

/** A CM360 account user profile */
export interface CM360AccountUserProfile {
  id: string;
  accountId: string;
  subaccountId?: string;
  email: string;
  name: string;
  userRoleId: string;
  userRoleName?: string;
  active: boolean;
  locale: CM360UserLocale;
  /** Read-only — set by Google based on account relationship */
  userAccessType?: string;
  /** Read-only — set by Google based on account relationship */
  traffickerType?: string;
  siteFilter: CM360ObjectFilter;
  campaignFilter: CM360ObjectFilter;
  advertiserFilter: CM360ObjectFilter;
  userRoleFilter: CM360ObjectFilter;
}

/** Input for creating a new account user profile */
export interface CM360CreateAccountUserProfileInput {
  email: string;
  name: string;
  userRoleId: string;
  subaccountId?: string;
  locale?: CM360UserLocale;
  active?: boolean;
  siteFilter?: CM360ObjectFilter;
  campaignFilter?: CM360ObjectFilter;
  advertiserFilter?: CM360ObjectFilter;
  userRoleFilter?: CM360ObjectFilter;
}

/** A CM360 user role */
export interface CM360UserRole {
  id: string;
  accountId: string;
  subaccountId?: string;
  name: string;
  defaultUserRole: boolean;
  parentUserRoleId?: string;
  parentUserRoleName?: string;
  permissionIds: string[];
}

/** Input for creating a new user role */
export interface CM360CreateUserRoleInput {
  name: string;
  parentUserRoleId: string;
  subaccountId?: string;
  permissionIds?: string[];
}

/** A CM360 user role permission */
export interface CM360UserRolePermission {
  id: string;
  name: string;
  permissionGroupId: string;
  availability: 'ACCOUNT_ALWAYS' | 'ACCOUNT_BY_DEFAULT' | 'SUBACCOUNT_AND_ACCOUNT';
}

/** A CM360 user role permission group */
export interface CM360UserRolePermissionGroup {
  id: string;
  name: string;
}

/** A CM360 subaccount */
export interface CM360Subaccount {
  id: string;
  accountId: string;
  name: string;
  availablePermissionIds: string[];
}

/** Generic list response wrapper */
export interface CM360ListResponse<T> {
  items: T[];
  nextPageToken?: string;
  kind: string;
}
