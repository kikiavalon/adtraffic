/**
 * MockDataStore — generates and manages realistic CM360 mock data using seeded faker.
 * Data persists in memory within a session. Resets on server restart.
 *
 * NOTE: Mock data writes (create* methods) are per-process.
 * In a multi-instance deployment, entities created on one instance
 * are not visible on others. This is an accepted limitation of demo mode.
 * Once users connect real CM360 accounts, all data flows through the
 * CM360 API (external, shared by nature).
 */

import { faker } from '@faker-js/faker';
import type {
  CM360UserProfile,
  CM360Advertiser,
  CM360Campaign,
  CM360Site,
  CM360Size,
  CM360LandingPage,
  CM360Placement,
  CM360Ad,
  CM360Creative,
  CM360PlacementTag,
  CM360CreativeType,
  CM360CampaignCreativeAssociation,
  CM360CreativeAssetMetadata,
  CM360CreativeAssetType,
  CM360CreativeRotationType,
  CM360AdType,
  CM360UpdateCampaignInput,
  CM360UpdatePlacementInput,
  CM360UpdateAdInput,
  CM360UpdateCreativeInput,
  CM360UpdateLandingPageInput,
  CM360TagFormat,
  CM360EventTag,
  CM360CreateEventTagInput,
  CM360UpdateEventTagInput,
  CM360EventTagType,
  CM360PlacementGroup,
  CM360PlacementGroupType,
  CM360CreatePlacementGroupInput,
  CM360UpdatePlacementGroupInput,
  CM360ChangeLog,
  CM360ChangeLogObjectType,
  CM360ChangeLogAction,
  CM360Report,
  CM360ReportType,
  CM360ReportFile,
  CM360ReportFileStatus,
  CM360CompatibleFields,
  CM360CreateReportInput,
  CM360FloodlightActivity,
  CM360FloodlightActivityType,
  CM360FloodlightCountingMethod,
  CM360FloodlightActivityGroup,
  CM360FloodlightConfiguration,
  CM360CreateFloodlightActivityInput,
  CM360CreateFloodlightActivityGroupInput,
  CM360FloodlightTag,
} from '@adtraffic/shared';
import { randomUUID } from 'crypto';

const ACCOUNT_ID = '67890';

const IAB_SIZES = [
  { width: 300, height: 250 },
  { width: 728, height: 90 },
  { width: 970, height: 250 },
  { width: 160, height: 600 },
  { width: 320, height: 50 },
  { width: 300, height: 600 },
  { width: 336, height: 280 },  // Large Rectangle
  { width: 970, height: 90 },   // Super Leaderboard
  { width: 320, height: 480 },  // Mobile Interstitial
  { width: 300, height: 50 },   // Mobile Banner Small
  { width: 468, height: 60 },   // Full Banner
  { width: 250, height: 250 },  // Square
];

interface ListFilter {
  advertiserId?: string;
  campaignId?: string;
  searchString?: string;
  maxResults?: number;
}

class MockDataStore {
  private profiles: CM360UserProfile[] = [];
  private advertisers = new Map<string, CM360Advertiser>();
  private campaigns = new Map<string, CM360Campaign>();
  private sites = new Map<string, CM360Site>();
  private landingPages = new Map<string, CM360LandingPage>();
  private placements = new Map<string, CM360Placement>();
  private ads = new Map<string, CM360Ad>();
  private creatives = new Map<string, CM360Creative>();
  /** Maps campaignId → Set of creativeIds */
  private campaignCreativeAssociations = new Map<string, Set<string>>();
  private creativeAssets = new Map<string, CM360CreativeAssetMetadata>();
  private eventTags = new Map<string, CM360EventTag>();
  private placementGroups = new Map<string, CM360PlacementGroup>();
  private changeLogs: CM360ChangeLog[] = [];
  private reports = new Map<string, CM360Report>();
  private reportFiles = new Map<string, CM360ReportFile>();
  private floodlightActivities = new Map<string, CM360FloodlightActivity>();
  private floodlightActivityGroups = new Map<string, CM360FloodlightActivityGroup>();
  private floodlightConfigurations = new Map<string, CM360FloodlightConfiguration>();
  private directorySites = new Map<string, {
    id: string;
    name: string;
    url: string;
    active: boolean;
    interstitialTagFormats: string[];
    inpageTagFormats: string[];
  }>();
  private nextId = 90000;

  constructor() {
    this.seed();
  }

  private genId(): string {
    return String(this.nextId++);
  }

  private seed(): void {
    faker.seed(42);

    // --- Profile ---
    this.profiles = [{
      profileId: '12345',
      accountId: ACCOUNT_ID,
      accountName: 'Demo Agency',
      userName: 'demo@agency.com',
      etag: '"mock-etag-1"',
    }];

    // --- Advertisers (7 fictional brands by vertical) ---
    const advertiserDefs = [
      { name: 'Apex Motors', vertical: 'automotive' },
      { name: 'Luminance Beauty', vertical: 'beauty' },
      { name: 'Meridian Financial', vertical: 'finance' },
      { name: 'NovaTech Solutions', vertical: 'technology' },
      { name: 'Vanguard Athletics', vertical: 'sports' },
      { name: 'Crestview Hotels', vertical: 'travel' },
      { name: 'Harvest Organics', vertical: 'food' },
    ];

    const advertiserIds: string[] = [];
    for (const def of advertiserDefs) {
      const id = this.genId();
      advertiserIds.push(id);
      this.advertisers.set(id, {
        id,
        name: def.name,
        accountId: ACCOUNT_ID,
        status: 'APPROVED',
      });
    }

    // --- Sites (16 real publisher names — display, video, and audio) ---
    const siteDefs = [
      'ESPN.com', 'CNN.com', 'Forbes.com', 'Bloomberg.com', 'NYTimes.com',
      'WashingtonPost.com', 'TheVerge.com', 'TechCrunch.com', 'Hulu.com', 'Spotify.com',
      'Pandora.com', 'SiriusXM.com', 'YouTube.com', 'Peacock.com', 'CNET.com', 'Wired.com',
    ];
    const siteIds: string[] = [];
    for (const siteName of siteDefs) {
      const id = this.genId();
      siteIds.push(id);
      this.sites.set(id, {
        id,
        name: siteName,
        accountId: ACCOUNT_ID,
        approved: true,
      });
    }

    // --- Landing Pages (~20 total, 2-4 per advertiser) ---
    const landingPagesByAdvertiser = new Map<string, string[]>();
    for (let ai = 0; ai < advertiserIds.length; ai++) {
      const advId = advertiserIds[ai]!;
      const advName = advertiserDefs[ai]!.name;
      const domain = advName.toLowerCase().replace(/\s+/g, '') + '.com';
      const count = faker.number.int({ min: 2, max: 4 });
      const pageIds: string[] = [];

      const pageSuffixes = ['', '/offers', '/products', '/signup', '/promo', '/landing'];
      // Advertisers 0-2 (Apex, Luminance, Meridian) get UTM parameters on landing page URLs
      const utmAdvertiserIndices = [0, 1, 2];
      const advSlug = advName.toLowerCase().replace(/\s+/g, '-');
      for (let p = 0; p < count; p++) {
        const id = this.genId();
        pageIds.push(id);
        const suffix = pageSuffixes[p] ?? `/${faker.lorem.slug(1)}`;
        const baseUrl = `https://www.${domain}${suffix}`;
        const utmSuffix = utmAdvertiserIndices.includes(ai)
          ? `?utm_source=cm360&utm_medium=display&utm_campaign=${advSlug}${suffix ? suffix.replace('/', '-') : '-homepage'}`
          : '';
        this.landingPages.set(id, {
          id,
          name: p === 0 ? `${advName} Homepage` : `${advName} ${suffix.slice(1).charAt(0).toUpperCase() + suffix.slice(2)}`,
          advertiserId: advId,
          url: `${baseUrl}${utmSuffix}`,
          archived: false,
        });
      }
      landingPagesByAdvertiser.set(advId, pageIds);
    }

    // --- Campaigns (~25 total, 3-4 per advertiser) ---
    const channels = ['Display', 'Video', 'Mobile', 'Cross-Platform'];
    const objectives = ['Awareness', 'Conversions', 'Retargeting', 'Launch', 'Seasonal'];
    const quarters = [
      { label: 'Q1 2026', start: '2026-01-01', end: '2026-03-31' },
      { label: 'Q2 2026', start: '2026-04-01', end: '2026-06-30' },
      { label: 'Q3 2026', start: '2026-07-01', end: '2026-09-30' },
      { label: 'Q4 2026', start: '2026-10-01', end: '2026-12-31' },
    ];
    const campaignsByAdvertiser = new Map<string, string[]>();

    for (let ai = 0; ai < advertiserIds.length; ai++) {
      const advId = advertiserIds[ai]!;
      const advName = advertiserDefs[ai]!.name.split(' ')[0]!; // First word for brevity
      const lpIds = landingPagesByAdvertiser.get(advId) ?? [];
      const campCount = faker.number.int({ min: 3, max: 4 });
      const campIds: string[] = [];

      for (let c = 0; c < campCount; c++) {
        const id = this.genId();
        campIds.push(id);
        const quarter = quarters[c % quarters.length]!;
        const channel = faker.helpers.arrayElement(channels);
        const objective = faker.helpers.arrayElement(objectives);
        this.campaigns.set(id, {
          id,
          name: `${advName} ${quarter.label} ${channel} ${objective}`,
          accountId: ACCOUNT_ID,
          advertiserId: advId,
          startDate: quarter.start,
          endDate: quarter.end,
          defaultLandingPageId: lpIds[0] ?? '',
          archived: false,
        });
      }
      campaignsByAdvertiser.set(advId, campIds);
    }

    // --- Creatives (~14, 2 per advertiser) ---
    const creativesByAdvertiser = new Map<string, string[]>();
    for (let ai = 0; ai < advertiserIds.length; ai++) {
      const advId = advertiserIds[ai]!;
      const advName = advertiserDefs[ai]!.name.split(' ')[0]!;
      const crIds: string[] = [];

      for (let cr = 0; cr < 2; cr++) {
        const id = this.genId();
        crIds.push(id);
        const size = IAB_SIZES[cr % IAB_SIZES.length]!;
        this.creatives.set(id, {
          id,
          name: `${advName}_${size.width}x${size.height}_v${cr + 1}`,
          advertiserId: advId,
          type: 'DISPLAY',
          size: {
            id: `size-${size.width}x${size.height}`,
            width: size.width,
            height: size.height,
            iab: true,
          },
          active: true,
          archived: false,
        });
      }
      creativesByAdvertiser.set(advId, crIds);
    }

    // --- Video Creatives (8 total — VAST and VPAID across advertisers) ---
    const videoCreativeDefs = [
      { advIdx: 0, name: 'Apex_PreRoll_640x360_v1', width: 640, height: 360, type: 'VAST_REDIRECT' as CM360CreativeType },
      { advIdx: 0, name: 'Apex_PreRoll_1920x1080_v1', width: 1920, height: 1080, type: 'VAST_REDIRECT' as CM360CreativeType },
      { advIdx: 0, name: 'Apex_VPAID_Interactive_640x360_v1', width: 640, height: 360, type: 'VPAID_LINEAR' as CM360CreativeType },
      { advIdx: 1, name: 'Luminance_PreRoll_640x360_v1', width: 640, height: 360, type: 'VAST_REDIRECT' as CM360CreativeType },
      { advIdx: 1, name: 'Luminance_PreRoll_1920x1080_v1', width: 1920, height: 1080, type: 'VAST_REDIRECT' as CM360CreativeType },
      { advIdx: 3, name: 'NovaTech_InStream_640x360_v1', width: 640, height: 360, type: 'VAST_REDIRECT' as CM360CreativeType },
      { advIdx: 3, name: 'NovaTech_VPAID_Interactive_1920x1080_v1', width: 1920, height: 1080, type: 'VPAID_LINEAR' as CM360CreativeType },
      { advIdx: 4, name: 'Vanguard_PreRoll_640x360_v1', width: 640, height: 360, type: 'VAST_REDIRECT' as CM360CreativeType },
    ];
    const videoCreativeIds: string[] = [];
    for (const vcDef of videoCreativeDefs) {
      const id = this.genId();
      videoCreativeIds.push(id);
      const advId = advertiserIds[vcDef.advIdx]!;
      const existingCrIds = creativesByAdvertiser.get(advId) ?? [];
      existingCrIds.push(id);
      creativesByAdvertiser.set(advId, existingCrIds);
      this.creatives.set(id, {
        id,
        name: vcDef.name,
        advertiserId: advId,
        type: vcDef.type,
        size: {
          id: `size-${vcDef.width}x${vcDef.height}`,
          width: vcDef.width,
          height: vcDef.height,
          iab: false,
        },
        active: true,
        archived: false,
      });
    }

    // --- Audio Creatives (VAST redirects for audio ads) ---
    const audioCreativeDefs = [
      { advIdx: 0, name: 'Apex_Audio_30s_v1' },
      { advIdx: 1, name: 'Luminance_Audio_30s_v1' },
      { advIdx: 3, name: 'NovaTech_Audio_30s_v1' },
      { advIdx: 4, name: 'Vanguard_Audio_15s_v1' },
      { advIdx: 5, name: 'Crestview_Audio_30s_v1' },
    ];
    for (const acDef of audioCreativeDefs) {
      const id = this.genId();
      const advId = advertiserIds[acDef.advIdx]!;
      const existingCrIds = creativesByAdvertiser.get(advId) ?? [];
      existingCrIds.push(id);
      creativesByAdvertiser.set(advId, existingCrIds);
      this.creatives.set(id, {
        id,
        name: acDef.name,
        advertiserId: advId,
        type: 'VAST_REDIRECT',
        size: { id: 'size-1x1', width: 1, height: 1, iab: true },
        active: true,
        archived: false,
      });
    }

    // --- 1x1 Tracking Creatives (for site-served placements) ---
    const trackingCreativeDefs = [
      { advIdx: 0, name: 'Apex_Tracking_1x1' },
      { advIdx: 1, name: 'Luminance_Tracking_1x1' },
      { advIdx: 3, name: 'NovaTech_Tracking_1x1' },
      { advIdx: 4, name: 'Vanguard_Tracking_1x1' },
    ];
    for (const tcDef of trackingCreativeDefs) {
      const id = this.genId();
      const advId = advertiserIds[tcDef.advIdx]!;
      const existingCrIds = creativesByAdvertiser.get(advId) ?? [];
      existingCrIds.push(id);
      creativesByAdvertiser.set(advId, existingCrIds);
      this.creatives.set(id, {
        id,
        name: tcDef.name,
        advertiserId: advId,
        type: 'TRACKING',
        size: { id: 'size-1x1', width: 1, height: 1, iab: true },
        active: true,
        archived: false,
      });
    }

    // --- Placements (~160+ total, spread across campaigns and sites) ---
    const placementTypes = ['Standard', 'Roadblock', 'Interstitial', 'Native', 'HighImpact'];
    for (let ai = 0; ai < advertiserIds.length; ai++) {
      const advId = advertiserIds[ai]!;
      const advName = advertiserDefs[ai]!.name.split(' ')[0]!;
      const campIds = campaignsByAdvertiser.get(advId) ?? [];

      for (const campId of campIds) {
        const camp = this.campaigns.get(campId)!;
        const placementCount = faker.number.int({ min: 4, max: 7 });

        for (let p = 0; p < placementCount; p++) {
          const id = this.genId();
          const siteIdx = faker.number.int({ min: 0, max: siteIds.length - 1 });
          const siteId = siteIds[siteIdx]!;
          const site = this.sites.get(siteId)!;
          const size = faker.helpers.arrayElement(IAB_SIZES);
          const type = faker.helpers.arrayElement(placementTypes);
          const siteName = site.name.replace('.com', '');

          this.placements.set(id, {
            id,
            name: `${siteName}_${advName}_${size.width}x${size.height}_${camp.startDate.slice(5, 7)}${camp.startDate.slice(2, 4)}_${type}`,
            accountId: ACCOUNT_ID,
            advertiserId: advId,
            campaignId: campId,
            siteId,
            size: {
              id: `size-${size.width}x${size.height}`,
              width: size.width,
              height: size.height,
              iab: true,
            },
            status: faker.helpers.arrayElement(['PAYMENT_ACCEPTED', 'PAYMENT_ACCEPTED', 'PAYMENT_ACCEPTED', 'DRAFT'] as const),
            pricingSchedule: {
              startDate: camp.startDate,
              endDate: camp.endDate,
              pricingType: 'CPM' as const,
              pricingPeriods: [{
                startDate: camp.startDate,
                endDate: camp.endDate,
                rateOrCostNanos: faker.number.int({ min: 3, max: 15 }) * 1_000_000_000,
                units: faker.number.int({ min: 100_000, max: 1_000_000 }),
              }],
            },
            activeStatus: 'ACTIVE',
            compatibility: 'DISPLAY',
            tagFormats: ['PLACEMENT_TAG_STANDARD'],
          });
        }
      }
    }

    // --- Video Placements (12 total across 4 advertisers, multiple sites and sizes) ---
    const videoPlacementDefs = [
      // Apex Motors — Q1 campaign (campIdx 0)
      { advIdx: 0, campRelIdx: 0, siteIdx: 8, name: 'Apex_Hulu_PreRoll_640x360', w: 640, h: 360 },
      { advIdx: 0, campRelIdx: 0, siteIdx: 9, name: 'Apex_Spotify_InStream_640x360', w: 640, h: 360 },
      { advIdx: 0, campRelIdx: 0, siteIdx: 12, name: 'Apex_YouTube_PreRoll_1920x1080', w: 1920, h: 1080 },
      { advIdx: 0, campRelIdx: 0, siteIdx: 13, name: 'Apex_Peacock_MidRoll_640x360', w: 640, h: 360 },
      // NovaTech Solutions — last campaign
      { advIdx: 3, campRelIdx: -1, siteIdx: 8, name: 'NovaTech_Hulu_PreRoll_640x360', w: 640, h: 360 },
      { advIdx: 3, campRelIdx: -1, siteIdx: 9, name: 'NovaTech_Spotify_InStream_640x360', w: 640, h: 360 },
      { advIdx: 3, campRelIdx: -1, siteIdx: 12, name: 'NovaTech_YouTube_MidRoll_1920x1080', w: 1920, h: 1080 },
      // Luminance Beauty — Q1 campaign
      { advIdx: 1, campRelIdx: 0, siteIdx: 8, name: 'Luminance_Hulu_PreRoll_640x360', w: 640, h: 360 },
      { advIdx: 1, campRelIdx: 0, siteIdx: 13, name: 'Luminance_Peacock_PreRoll_1920x1080', w: 1920, h: 1080 },
      // Vanguard Athletics — Q1 campaign
      { advIdx: 4, campRelIdx: 0, siteIdx: 12, name: 'Vanguard_YouTube_PreRoll_640x360', w: 640, h: 360 },
      { advIdx: 4, campRelIdx: 0, siteIdx: 8, name: 'Vanguard_Hulu_MidRoll_1920x1080', w: 1920, h: 1080 },
      // Crestview Hotels — Q1 campaign
      { advIdx: 5, campRelIdx: 0, siteIdx: 13, name: 'Crestview_Peacock_PreRoll_640x360', w: 640, h: 360 },
    ];
    const videoPlacementIds: string[] = [];
    for (const vpDef of videoPlacementDefs) {
      const id = this.genId();
      videoPlacementIds.push(id);
      const advId = advertiserIds[vpDef.advIdx]!;
      const campIds = campaignsByAdvertiser.get(advId) ?? [];
      const campId = vpDef.campRelIdx === -1
        ? campIds[campIds.length - 1]!
        : campIds[vpDef.campRelIdx]!;
      const siteId = siteIds[vpDef.siteIdx]!;
      const camp = this.campaigns.get(campId)!;

      this.placements.set(id, {
        id,
        name: vpDef.name,
        accountId: ACCOUNT_ID,
        advertiserId: advId,
        campaignId: campId,
        siteId,
        size: {
          id: `size-${vpDef.w}x${vpDef.h}`,
          width: vpDef.w,
          height: vpDef.h,
          iab: false,
        },
        status: 'PAYMENT_ACCEPTED',
        activeStatus: 'ACTIVE',
        compatibility: 'IN_STREAM_VIDEO',
        pricingSchedule: {
          startDate: camp.startDate,
          endDate: camp.endDate,
          pricingType: 'CPM' as const,
          pricingPeriods: [{
            startDate: camp.startDate,
            endDate: camp.endDate,
            rateOrCostNanos: faker.number.int({ min: 10, max: 30 }) * 1_000_000_000,
            units: faker.number.int({ min: 50_000, max: 500_000 }),
          }],
        },
        tagFormats: [vpDef.w >= 1920 ? 'PLACEMENT_TAG_INSTREAM_VIDEO_PREFETCH_VAST_3' : 'PLACEMENT_TAG_VAST_2_0'],
      });
    }

    // --- 1x1 Site-Served Tracking Placements (8 total, publisher-paid) ---
    const trackingPlacementDefs = [
      // Apex Motors — Q1 campaign, site-served on major publishers
      { advIdx: 0, campRelIdx: 0, siteIdx: 0, name: 'Apex_ESPN_SiteServed_1x1' },
      { advIdx: 0, campRelIdx: 0, siteIdx: 1, name: 'Apex_CNN_SiteServed_1x1' },
      { advIdx: 0, campRelIdx: 0, siteIdx: 3, name: 'Apex_Bloomberg_SiteServed_1x1' },
      // Luminance Beauty
      { advIdx: 1, campRelIdx: 0, siteIdx: 2, name: 'Luminance_Forbes_SiteServed_1x1' },
      { advIdx: 1, campRelIdx: 0, siteIdx: 4, name: 'Luminance_NYTimes_SiteServed_1x1' },
      // NovaTech Solutions
      { advIdx: 3, campRelIdx: 0, siteIdx: 6, name: 'NovaTech_TheVerge_SiteServed_1x1' },
      { advIdx: 3, campRelIdx: 0, siteIdx: 7, name: 'NovaTech_TechCrunch_SiteServed_1x1' },
      // Vanguard Athletics
      { advIdx: 4, campRelIdx: 0, siteIdx: 0, name: 'Vanguard_ESPN_SiteServed_1x1' },
    ];
    for (const tpDef of trackingPlacementDefs) {
      const id = this.genId();
      const advId = advertiserIds[tpDef.advIdx]!;
      const campIds = campaignsByAdvertiser.get(advId) ?? [];
      const campId = campIds[tpDef.campRelIdx]!;
      const siteId = siteIds[tpDef.siteIdx]!;
      const camp = this.campaigns.get(campId)!;
      this.placements.set(id, {
        id,
        name: tpDef.name,
        accountId: ACCOUNT_ID,
        advertiserId: advId,
        campaignId: campId,
        siteId,
        size: { id: 'size-1x1', width: 1, height: 1, iab: true },
        status: 'PAYMENT_ACCEPTED',
        activeStatus: 'ACTIVE',
        compatibility: 'DISPLAY',
        paymentSource: 'PLACEMENT_PUBLISHER_PAID',
        pricingSchedule: {
          startDate: camp.startDate,
          endDate: camp.endDate,
          pricingType: 'CPM' as const,
          pricingPeriods: [{
            startDate: camp.startDate,
            endDate: camp.endDate,
            rateOrCostNanos: faker.number.int({ min: 1, max: 5 }) * 1_000_000_000,
            units: faker.number.int({ min: 50_000, max: 200_000 }),
          }],
        },
        tagFormats: ['PLACEMENT_TAG_TRACKING'],
      });
    }

    // --- Audio Placements (IN_STREAM_AUDIO — Spotify, Pandora, SiriusXM) ---
    const audioPlacementDefs = [
      // Apex Motors — Q1 campaign
      { advIdx: 0, campRelIdx: 0, siteIdx: 9, name: 'Apex_Spotify_Audio_30s' },
      { advIdx: 0, campRelIdx: 0, siteIdx: 10, name: 'Apex_Pandora_Audio_30s' },
      { advIdx: 0, campRelIdx: 0, siteIdx: 11, name: 'Apex_SiriusXM_Audio_15s' },
      // Luminance Beauty — Q1 campaign
      { advIdx: 1, campRelIdx: 0, siteIdx: 9, name: 'Luminance_Spotify_Audio_30s' },
      { advIdx: 1, campRelIdx: 0, siteIdx: 10, name: 'Luminance_Pandora_Audio_15s' },
      // NovaTech Solutions — last campaign
      { advIdx: 3, campRelIdx: -1, siteIdx: 9, name: 'NovaTech_Spotify_Audio_30s' },
      { advIdx: 3, campRelIdx: -1, siteIdx: 11, name: 'NovaTech_SiriusXM_Audio_30s' },
      // Vanguard Athletics — Q1 campaign
      { advIdx: 4, campRelIdx: 0, siteIdx: 9, name: 'Vanguard_Spotify_Audio_15s' },
      // Crestview Hotels — Q1 campaign
      { advIdx: 5, campRelIdx: 0, siteIdx: 10, name: 'Crestview_Pandora_Audio_30s' },
    ];
    for (const apDef of audioPlacementDefs) {
      const id = this.genId();
      const advId = advertiserIds[apDef.advIdx]!;
      const campIds = campaignsByAdvertiser.get(advId) ?? [];
      const campId = apDef.campRelIdx === -1
        ? campIds[campIds.length - 1]!
        : campIds[apDef.campRelIdx]!;
      const siteId = siteIds[apDef.siteIdx]!;
      const camp = this.campaigns.get(campId)!;
      this.placements.set(id, {
        id,
        name: apDef.name,
        accountId: ACCOUNT_ID,
        advertiserId: advId,
        campaignId: campId,
        siteId,
        size: { id: 'size-1x1', width: 1, height: 1, iab: true },
        status: 'PAYMENT_ACCEPTED',
        activeStatus: 'ACTIVE',
        compatibility: 'IN_STREAM_AUDIO',
        pricingSchedule: {
          startDate: camp.startDate,
          endDate: camp.endDate,
          pricingType: 'CPM' as const,
          pricingPeriods: [{
            startDate: camp.startDate,
            endDate: camp.endDate,
            rateOrCostNanos: faker.number.int({ min: 8, max: 20 }) * 1_000_000_000,
            units: faker.number.int({ min: 100_000, max: 500_000 }),
          }],
        },
        tagFormats: ['PLACEMENT_TAG_VAST_2_0'],
      });
    }

    // --- Ads (~40 total, subset linking creatives to placements) ---
    for (let ai = 0; ai < advertiserIds.length; ai++) {
      const advId = advertiserIds[ai]!;
      const advName = advertiserDefs[ai]!.name.split(' ')[0]!;
      const campIds = campaignsByAdvertiser.get(advId) ?? [];
      const crIds = creativesByAdvertiser.get(advId) ?? [];

      for (const campId of campIds) {
        // Get placements for this campaign
        const campPlacements = [...this.placements.values()]
          .filter((pl) => pl.campaignId === campId);

        // Create 1-2 ads per campaign
        const adCount = Math.min(faker.number.int({ min: 1, max: 2 }), campPlacements.length);
        for (let a = 0; a < adCount; a++) {
          const id = this.genId();
          const placement = campPlacements[a]!;
          const creativeId = crIds[a % crIds.length]!;

          this.ads.set(id, {
            id,
            name: `${advName}_Ad_${placement.size.width}x${placement.size.height}_${a + 1}`,
            campaignId: campId,
            advertiserId: advId,
            type: 'AD_SERVING_DEFAULT_AD' as CM360AdType,
            active: true,
            archived: false,
            placementAssignments: [{ placementId: placement.id }],
            creativeRotation: {
              type: 'CREATIVE_ROTATION_TYPE_RANDOM' as CM360CreativeRotationType,
              creativeAssignments: [{ creativeId }],
            },
          });
        }
      }
    }

    // --- Video Ads (linking video creatives to video placements) ---
    // Video ad 1: Apex Motors - Hulu PreRoll (videoPlacementIds[0])
    {
      const id = this.genId();
      const advId = advertiserIds[0]!;
      const campIds = campaignsByAdvertiser.get(advId) ?? [];
      const campId = campIds[0]!;
      this.ads.set(id, {
        id,
        name: 'Apex_VideoAd_Hulu_PreRoll_1',
        campaignId: campId,
        advertiserId: advId,
        type: 'AD_SERVING_DEFAULT_AD' as CM360AdType,
        active: true,
        archived: false,
        placementAssignments: [{ placementId: videoPlacementIds[0]! }],
        creativeRotation: {
          type: 'CREATIVE_ROTATION_TYPE_RANDOM' as CM360CreativeRotationType,
          creativeAssignments: [{ creativeId: videoCreativeIds[0]! }],
        },
      });
    }
    // Video ad 2: Apex Motors - YouTube PreRoll (videoPlacementIds[2])
    {
      const id = this.genId();
      const advId = advertiserIds[0]!;
      const campIds = campaignsByAdvertiser.get(advId) ?? [];
      const campId = campIds[0]!;
      this.ads.set(id, {
        id,
        name: 'Apex_VideoAd_YouTube_PreRoll_1',
        campaignId: campId,
        advertiserId: advId,
        type: 'AD_SERVING_DEFAULT_AD' as CM360AdType,
        active: true,
        archived: false,
        placementAssignments: [{ placementId: videoPlacementIds[2]! }],
        creativeRotation: {
          type: 'CREATIVE_ROTATION_TYPE_RANDOM' as CM360CreativeRotationType,
          creativeAssignments: [{ creativeId: videoCreativeIds[1]! }],
        },
      });
    }
    // Video ad 3: NovaTech - Hulu PreRoll (videoPlacementIds[4])
    {
      const id = this.genId();
      const advId = advertiserIds[3]!;
      const campIds = campaignsByAdvertiser.get(advId) ?? [];
      const campId = campIds[campIds.length - 1]!;
      this.ads.set(id, {
        id,
        name: 'NovaTech_VideoAd_Hulu_PreRoll_1',
        campaignId: campId,
        advertiserId: advId,
        type: 'AD_SERVING_DEFAULT_AD' as CM360AdType,
        active: true,
        archived: false,
        placementAssignments: [{ placementId: videoPlacementIds[4]! }],
        creativeRotation: {
          type: 'CREATIVE_ROTATION_TYPE_RANDOM' as CM360CreativeRotationType,
          creativeAssignments: [{ creativeId: videoCreativeIds[5]! }],
        },
      });
    }
    // Video ad 4: Luminance - Hulu PreRoll (videoPlacementIds[7])
    {
      const id = this.genId();
      const advId = advertiserIds[1]!;
      const campIds = campaignsByAdvertiser.get(advId) ?? [];
      const campId = campIds[0]!;
      this.ads.set(id, {
        id,
        name: 'Luminance_VideoAd_Hulu_PreRoll_1',
        campaignId: campId,
        advertiserId: advId,
        type: 'AD_SERVING_DEFAULT_AD' as CM360AdType,
        active: true,
        archived: false,
        placementAssignments: [{ placementId: videoPlacementIds[7]! }],
        creativeRotation: {
          type: 'CREATIVE_ROTATION_TYPE_RANDOM' as CM360CreativeRotationType,
          creativeAssignments: [{ creativeId: videoCreativeIds[3]! }],
        },
      });
    }

    // --- Campaign-Creative Associations (seed from ad data) ---
    for (const ad of this.ads.values()) {
      const assocSet = this.campaignCreativeAssociations.get(ad.campaignId) ?? new Set<string>();
      for (const ca of ad.creativeRotation.creativeAssignments) {
        assocSet.add(ca.creativeId);
      }
      this.campaignCreativeAssociations.set(ad.campaignId, assocSet);
    }

    // --- Event Tags (6 tags across campaigns at advertiser indices 0, 3, 6) ---
    const eventTagDefs: Array<{
      advIdx: number;
      campRelIdx: number;
      name: string;
      url: string;
      type: CM360EventTagType;
      enabledByDefault: boolean;
    }> = [
      {
        advIdx: 0, campRelIdx: 0,
        name: 'Apex DV Impression Tracker',
        url: 'https://cdn.doubleverify.com/dvtp_src.js?ctx=1234567&cmp=DV_CAMPAIGN',
        type: 'IMPRESSION_JAVASCRIPT_EVENT_TAG',
        enabledByDefault: true,
      },
      {
        advIdx: 0, campRelIdx: 0,
        name: 'Apex IAS Viewability Pixel',
        url: 'https://pixel.adsafeprotected.com/rjss/st/12345/67890/skeleton.js',
        type: 'IMPRESSION_JAVASCRIPT_EVENT_TAG',
        enabledByDefault: true,
      },
      {
        advIdx: 3, campRelIdx: 0,
        name: 'NovaTech Adobe Click Tracker',
        url: 'https://metrics.example.com/b/ss/novatech-clicktag/1/JS-2.0/s123456',
        type: 'CLICK_THROUGH_EVENT_TAG',
        enabledByDefault: false,
      },
      {
        advIdx: 3, campRelIdx: 1,
        name: 'NovaTech MOAT Attention Pixel',
        url: 'https://z.moatads.com/novatechpixel123456/moatad.js',
        type: 'IMPRESSION_JAVASCRIPT_EVENT_TAG',
        enabledByDefault: true,
      },
      {
        advIdx: 6, campRelIdx: 0,
        name: 'Harvest Impression Pixel',
        url: 'https://secure.adnxs.com/imptr?id=9876543&t=1',
        type: 'IMPRESSION_IMAGE_EVENT_TAG',
        enabledByDefault: true,
      },
      {
        advIdx: 6, campRelIdx: 0,
        name: 'Harvest Click Redirect',
        url: 'https://track.harvestorganics.com/click?cid=harvest-q1-2026',
        type: 'CLICK_THROUGH_EVENT_TAG',
        enabledByDefault: false,
      },
    ];

    for (const etDef of eventTagDefs) {
      const id = this.genId();
      const advId = advertiserIds[etDef.advIdx]!;
      const campIds = campaignsByAdvertiser.get(advId) ?? [];
      const campId = campIds[etDef.campRelIdx] ?? campIds[0]!;
      this.eventTags.set(id, {
        id,
        accountId: ACCOUNT_ID,
        advertiserId: advId,
        campaignId: campId,
        name: etDef.name,
        url: etDef.url,
        type: etDef.type,
        status: 'ENABLED',
        siteIds: [],
        enabledByDefault: etDef.enabledByDefault,
        excludeFromAdxRequests: false,
        sslCompliant: etDef.url.startsWith('https'),
      });
    }

    // --- Placement Groups (4 groups across advertiser indices 0 and 3) ---
    const placementGroupDefs: Array<{
      advIdx: number;
      campRelIdx: number;
      name: string;
      groupType: CM360PlacementGroupType;
    }> = [
      {
        advIdx: 0, campRelIdx: 0,
        name: 'Apex Motors Display Package Q1',
        groupType: 'PLACEMENT_PACKAGE',
      },
      {
        advIdx: 0, campRelIdx: 0,
        name: 'Apex Motors Homepage Roadblock',
        groupType: 'PLACEMENT_ROADBLOCK',
      },
      {
        advIdx: 3, campRelIdx: 0,
        name: 'NovaTech Standard Display Bundle',
        groupType: 'PLACEMENT_PACKAGE',
      },
      {
        advIdx: 3, campRelIdx: 1,
        name: 'NovaTech Takeover Roadblock',
        groupType: 'PLACEMENT_ROADBLOCK',
      },
    ];

    for (const pgDef of placementGroupDefs) {
      const id = this.genId();
      const advId = advertiserIds[pgDef.advIdx]!;
      const campIds = campaignsByAdvertiser.get(advId) ?? [];
      const campId = campIds[pgDef.campRelIdx] ?? campIds[0]!;
      const camp = this.campaigns.get(campId)!;

      // Collect first 2 placements that belong to this campaign + advertiser
      const matchingPlacements = [...this.placements.values()]
        .filter((pl) => pl.campaignId === campId && pl.advertiserId === advId)
        .slice(0, 2)
        .map((pl) => pl.id);

      // Use first placement's siteId, or fall back to first site
      const siteId = matchingPlacements.length > 0
        ? this.placements.get(matchingPlacements[0]!)!.siteId
        : siteIds[0]!;

      this.placementGroups.set(id, {
        id,
        name: pgDef.name,
        accountId: ACCOUNT_ID,
        advertiserId: advId,
        campaignId: campId,
        siteId,
        placementGroupType: pgDef.groupType,
        placementIds: matchingPlacements,
        activeStatus: 'ACTIVE',
        pricingSchedule: {
          startDate: camp.startDate,
          endDate: camp.endDate,
        },
      });
    }

    // --- Directory Sites (15 publishers from Google's directory, not yet approved) ---
    const directorySiteDefs: Array<{ name: string; url: string }> = [
      { name: 'BuzzFeed', url: 'https://www.buzzfeed.com' },
      { name: 'Mashable', url: 'https://mashable.com' },
      { name: 'Vox Media', url: 'https://www.voxmedia.com' },
      { name: 'Wired', url: 'https://www.wired.com' },
      { name: 'The Guardian', url: 'https://www.theguardian.com' },
      { name: 'Business Insider', url: 'https://www.businessinsider.com' },
      { name: 'Axios', url: 'https://www.axios.com' },
      { name: 'Politico', url: 'https://www.politico.com' },
      { name: 'Vice', url: 'https://www.vice.com' },
      { name: 'The Atlantic', url: 'https://www.theatlantic.com' },
      { name: 'Slate', url: 'https://slate.com' },
      { name: 'The Daily Beast', url: 'https://www.thedailybeast.com' },
      { name: 'Engadget', url: 'https://www.engadget.com' },
      { name: 'Ars Technica', url: 'https://arstechnica.com' },
      { name: 'Gizmodo', url: 'https://gizmodo.com' },
    ];
    const tagFormats = [
      'PLACEMENT_TAG_STANDARD',
      'PLACEMENT_TAG_IFRAME_JAVASCRIPT',
      'PLACEMENT_TAG_INTERNAL_REDIRECT',
      'PLACEMENT_TAG_JAVASCRIPT',
    ];
    for (const ds of directorySiteDefs) {
      const id = this.genId();
      this.directorySites.set(id, {
        id,
        name: ds.name,
        url: ds.url,
        active: true,
        interstitialTagFormats: [tagFormats[0]!, tagFormats[1]!],
        inpageTagFormats: [...tagFormats],
      });
    }

    // --- Change Logs (20 audit trail entries referencing real entity IDs) ---
    const allCampaignIds = [...this.campaigns.keys()];
    const allPlacementIds = [...this.placements.keys()];
    const allAdIds = [...this.ads.keys()];
    const allCreativeIds = [...this.creatives.keys()];
    const allEventTagIds = [...this.eventTags.keys()];
    const allPlacementGroupIds = [...this.placementGroups.keys()];

    const changeLogDefs: Array<{
      objectType: CM360ChangeLogObjectType;
      objectId: string;
      action: CM360ChangeLogAction;
      fieldName?: string;
      oldValue?: string;
      newValue?: string;
      daysAgo: number;
    }> = [
      // Campaign changes
      { objectType: 'OBJECT_CAMPAIGN', objectId: allCampaignIds[0]!, action: 'ACTION_CREATE', daysAgo: 30 },
      { objectType: 'OBJECT_CAMPAIGN', objectId: allCampaignIds[0]!, action: 'ACTION_UPDATE', fieldName: 'name', oldValue: 'Q1 Launch Draft', newValue: 'Q1 Launch', daysAgo: 28 },
      { objectType: 'OBJECT_CAMPAIGN', objectId: allCampaignIds[1]!, action: 'ACTION_CREATE', daysAgo: 25 },
      { objectType: 'OBJECT_CAMPAIGN', objectId: allCampaignIds[2]!, action: 'ACTION_CREATE', daysAgo: 20 },
      { objectType: 'OBJECT_CAMPAIGN', objectId: allCampaignIds[2]!, action: 'ACTION_ARCHIVE', daysAgo: 5 },
      // Placement changes
      { objectType: 'OBJECT_PLACEMENT', objectId: allPlacementIds[0]!, action: 'ACTION_CREATE', daysAgo: 29 },
      { objectType: 'OBJECT_PLACEMENT', objectId: allPlacementIds[0]!, action: 'ACTION_ACTIVATE', daysAgo: 27 },
      { objectType: 'OBJECT_PLACEMENT', objectId: allPlacementIds[1]!, action: 'ACTION_CREATE', daysAgo: 24 },
      { objectType: 'OBJECT_PLACEMENT', objectId: allPlacementIds[2]!, action: 'ACTION_UPDATE', fieldName: 'activeStatus', oldValue: 'ACTIVE', newValue: 'INACTIVE', daysAgo: 10 },
      // Ad changes
      { objectType: 'OBJECT_AD', objectId: allAdIds[0]!, action: 'ACTION_CREATE', daysAgo: 26 },
      { objectType: 'OBJECT_AD', objectId: allAdIds[0]!, action: 'ACTION_UPDATE', fieldName: 'name', oldValue: 'Ad Draft 1', newValue: 'Homepage Hero Ad', daysAgo: 23 },
      { objectType: 'OBJECT_AD', objectId: allAdIds[1]!, action: 'ACTION_DEACTIVATE', daysAgo: 8 },
      // Creative changes
      { objectType: 'OBJECT_CREATIVE', objectId: allCreativeIds[0]!, action: 'ACTION_CREATE', daysAgo: 28 },
      { objectType: 'OBJECT_CREATIVE', objectId: allCreativeIds[1]!, action: 'ACTION_CREATE', daysAgo: 22 },
      { objectType: 'OBJECT_CREATIVE', objectId: allCreativeIds[1]!, action: 'ACTION_UPDATE', fieldName: 'name', oldValue: 'Banner v1', newValue: 'Banner v2 Final', daysAgo: 15 },
      // Event tag changes
      { objectType: 'OBJECT_EVENT_TAG', objectId: allEventTagIds[0]!, action: 'ACTION_CREATE', daysAgo: 27 },
      { objectType: 'OBJECT_EVENT_TAG', objectId: allEventTagIds[1]!, action: 'ACTION_UPDATE', fieldName: 'url', oldValue: 'https://old-tracker.com/px', newValue: 'https://pixel.adsafeprotected.com/rjss/st/12345/67890/skeleton.js', daysAgo: 12 },
      // Placement group changes
      { objectType: 'OBJECT_PLACEMENT_GROUP', objectId: allPlacementGroupIds[0]!, action: 'ACTION_CREATE', daysAgo: 26 },
      // Advertiser changes
      { objectType: 'OBJECT_ADVERTISER', objectId: advertiserIds[0]!, action: 'ACTION_UPDATE', fieldName: 'status', oldValue: 'ON_HOLD', newValue: 'APPROVED', daysAgo: 31 },
      // Landing page change
      { objectType: 'OBJECT_LANDING_PAGE', objectId: [...this.landingPages.keys()][0]!, action: 'ACTION_CREATE', daysAgo: 30 },
    ];

    const now = Date.now();
    for (const clDef of changeLogDefs) {
      const changeTime = new Date(now - clDef.daysAgo * 86_400_000).toISOString();
      this.changeLogs.push({
        id: randomUUID(),
        userProfileId: '12345',
        userProfileName: 'demo@agency.com',
        objectType: clDef.objectType,
        objectId: clDef.objectId,
        action: clDef.action,
        ...(clDef.fieldName !== undefined && { fieldName: clDef.fieldName }),
        ...(clDef.oldValue !== undefined && { oldValue: clDef.oldValue }),
        ...(clDef.newValue !== undefined && { newValue: clDef.newValue }),
        changeTime,
      });
    }

    // --- Reports (5 saved report definitions) ---
    const reportDefs: Array<{
      name: string;
      type: CM360ReportType;
      dimensions: string[];
      metricNames: string[];
      schedule?: { active: boolean; repeats: string; every: number };
    }> = [
      { name: 'Campaign Performance Summary', type: 'STANDARD', dimensions: ['campaign', 'date'], metricNames: ['impressions', 'clicks', 'CTR'] },
      { name: 'Placement Delivery Report', type: 'STANDARD', dimensions: ['placement', 'site'], metricNames: ['impressions', 'reach', 'frequency'] },
      { name: 'Creative Breakdown', type: 'STANDARD', dimensions: ['creative', 'ad'], metricNames: ['impressions', 'clicks', 'conversions'] },
      { name: 'Audience Reach Analysis', type: 'REACH', dimensions: ['campaign'], metricNames: ['totalReach', 'averageFrequency'] },
      { name: 'Monthly Site Summary', type: 'STANDARD', dimensions: ['site', 'placement'], metricNames: ['impressions', 'clicks'], schedule: { active: true, repeats: 'MONTHLY', every: 1 } },
    ];
    for (let i = 0; i < reportDefs.length; i++) {
      const def = reportDefs[i]!;
      const rptId = `rpt-${i + 1}`;
      this.reports.set(rptId, {
        id: rptId,
        name: def.name,
        type: def.type,
        accountId: ACCOUNT_ID,
        ownerProfileId: '12345',
        criteria: {
          dateRange: { startDate: '2026-01-01', endDate: '2026-03-31' },
          dimensions: def.dimensions,
          metricNames: def.metricNames,
        },
        ...(def.schedule && { schedule: def.schedule }),
        lastModifiedTime: new Date(now - (i + 1) * 86_400_000).toISOString(),
      });
    }

    // --- Floodlight Configurations (one per advertiser, tied to floodlightConfigurationId) ---
    for (const advId of advertiserIds) {
      const adv = this.advertisers.get(advId)!;
      const configId = adv.floodlightConfigurationId ?? this.genId();
      this.floodlightConfigurations.set(configId, {
        id: configId,
        accountId: ACCOUNT_ID,
        advertiserId: advId,
        lookbackClickDays: 30,
        lookbackImpressionDays: 7,
        naturalSearchConversionAttributionOption: 'INCLUDE_NATURAL_SEARCH_CONVERSIONS_IN_FLOODLIGHT_REPORTING',
        tagSettings: {
          dynamicTagEnabled: true,
          imageTagEnabled: true,
        },
      });
    }

    // --- Floodlight Activity Groups (2-3 per advertiser indices 0, 3, 6) ---
    const flGroupDefs: Array<{
      advIdx: number;
      name: string;
      type: CM360FloodlightActivityType;
      tagString: string;
    }> = [
      { advIdx: 0, name: 'Apex Lead Gen', type: 'COUNTER', tagString: 'apex_lead_gen' },
      { advIdx: 0, name: 'Apex Ecommerce', type: 'SALE', tagString: 'apex_ecommerce' },
      { advIdx: 3, name: 'NovaTech Signups', type: 'COUNTER', tagString: 'novatech_signups' },
      { advIdx: 3, name: 'NovaTech Revenue', type: 'SALE', tagString: 'novatech_revenue' },
      { advIdx: 6, name: 'Harvest Conversions', type: 'COUNTER', tagString: 'harvest_conversions' },
    ];

    const groupIdsByAdvIdx = new Map<number, string[]>();
    for (const gDef of flGroupDefs) {
      const id = this.genId();
      const advId = advertiserIds[gDef.advIdx]!;
      const adv = this.advertisers.get(advId)!;
      const configId = adv.floodlightConfigurationId ?? [...this.floodlightConfigurations.values()].find(c => c.advertiserId === advId)!.id;
      this.floodlightActivityGroups.set(id, {
        id,
        name: gDef.name,
        accountId: ACCOUNT_ID,
        advertiserId: advId,
        floodlightConfigurationId: configId,
        type: gDef.type,
        tagString: gDef.tagString,
      });
      const existing = groupIdsByAdvIdx.get(gDef.advIdx) ?? [];
      existing.push(id);
      groupIdsByAdvIdx.set(gDef.advIdx, existing);
    }

    // --- Floodlight Activities (2-3 per group) ---
    const flActivityDefs: Array<{
      advIdx: number;
      groupRelIdx: number;
      name: string;
      countingMethod: CM360FloodlightCountingMethod;
      tagString: string;
      expectedUrl?: string;
      notes?: string;
    }> = [
      { advIdx: 0, groupRelIdx: 0, name: 'Form Submit', countingMethod: 'STANDARD_COUNTING', tagString: 'apex_form_submit', expectedUrl: 'https://www.apexmotors.com/thank-you', notes: 'Fires on thank-you page after lead form submission' },
      { advIdx: 0, groupRelIdx: 0, name: 'Phone Click', countingMethod: 'UNIQUE_COUNTING', tagString: 'apex_phone_click', notes: 'Unique daily — tracks click-to-call on mobile' },
      { advIdx: 0, groupRelIdx: 0, name: 'Newsletter Signup', countingMethod: 'STANDARD_COUNTING', tagString: 'apex_newsletter_signup' },
      { advIdx: 0, groupRelIdx: 1, name: 'Vehicle Purchase', countingMethod: 'STANDARD_COUNTING', tagString: 'apex_purchase', expectedUrl: 'https://www.apexmotors.com/order-confirmation', notes: 'Sales activity — tracks revenue and order ID' },
      { advIdx: 0, groupRelIdx: 1, name: 'Add to Cart', countingMethod: 'SESSION_COUNTING', tagString: 'apex_add_to_cart' },
      { advIdx: 3, groupRelIdx: 0, name: 'Free Trial Signup', countingMethod: 'STANDARD_COUNTING', tagString: 'novatech_trial', expectedUrl: 'https://novatech.io/welcome' },
      { advIdx: 3, groupRelIdx: 0, name: 'Demo Request', countingMethod: 'UNIQUE_COUNTING', tagString: 'novatech_demo' },
      { advIdx: 3, groupRelIdx: 1, name: 'SaaS Purchase', countingMethod: 'STANDARD_COUNTING', tagString: 'novatech_purchase', expectedUrl: 'https://novatech.io/success' },
      { advIdx: 6, groupRelIdx: 0, name: 'Recipe Download', countingMethod: 'STANDARD_COUNTING', tagString: 'harvest_recipe_download' },
      { advIdx: 6, groupRelIdx: 0, name: 'Store Locator Click', countingMethod: 'UNIQUE_COUNTING', tagString: 'harvest_store_locator' },
    ];

    for (const aDef of flActivityDefs) {
      const id = this.genId();
      const advId = advertiserIds[aDef.advIdx]!;
      const adv = this.advertisers.get(advId)!;
      const configId = adv.floodlightConfigurationId ?? [...this.floodlightConfigurations.values()].find(c => c.advertiserId === advId)!.id;
      const groupIds = groupIdsByAdvIdx.get(aDef.advIdx) ?? [];
      const groupId = groupIds[aDef.groupRelIdx] ?? groupIds[0]!;
      const group = this.floodlightActivityGroups.get(groupId)!;
      this.floodlightActivities.set(id, {
        id,
        name: aDef.name,
        accountId: ACCOUNT_ID,
        advertiserId: advId,
        floodlightConfigurationId: configId,
        floodlightActivityGroupId: groupId,
        floodlightActivityGroupName: group.name,
        floodlightActivityGroupType: group.type,
        type: group.type,
        countingMethod: aDef.countingMethod,
        tagString: aDef.tagString,
        tagFormat: 'GLOBAL_SITE_TAG',
        expectedUrl: aDef.expectedUrl,
        notes: aDef.notes,
        status: 'ACTIVE',
        sslRequired: true,
      });
    }
  }

  // --- Public API ---

  listProfiles(): CM360UserProfile[] {
    return [...this.profiles];
  }

  listAdvertisers(filter?: ListFilter): CM360Advertiser[] {
    let results = [...this.advertisers.values()];
    if (filter?.searchString) {
      const search = filter.searchString.toLowerCase();
      results = results.filter((a) => a.name.toLowerCase().includes(search));
    }
    const max = filter?.maxResults ?? 100;
    return results.slice(0, max);
  }

  getAdvertiser(id: string): CM360Advertiser | undefined {
    return this.advertisers.get(id);
  }

  listCampaigns(filter?: ListFilter): CM360Campaign[] {
    let results = [...this.campaigns.values()];
    if (filter?.advertiserId) {
      results = results.filter((c) => c.advertiserId === filter.advertiserId);
    }
    if (filter?.searchString) {
      const search = filter.searchString.toLowerCase();
      results = results.filter((c) => c.name.toLowerCase().includes(search));
    }
    const max = filter?.maxResults ?? 100;
    return results.slice(0, max);
  }

  createCampaign(input: {
    advertiserId: string;
    name: string;
    startDate: string;
    endDate: string;
    defaultLandingPageId: string;
  }): CM360Campaign {
    const id = this.genId();
    const campaign: CM360Campaign = {
      id,
      name: input.name,
      accountId: ACCOUNT_ID,
      advertiserId: input.advertiserId,
      startDate: input.startDate,
      endDate: input.endDate,
      defaultLandingPageId: input.defaultLandingPageId,
      archived: false,
    };
    this.campaigns.set(id, campaign);
    return campaign;
  }

  listSites(filter?: ListFilter): CM360Site[] {
    let results = [...this.sites.values()];
    if (filter?.searchString) {
      const search = filter.searchString.toLowerCase();
      results = results.filter((s) => s.name.toLowerCase().includes(search));
    }
    const max = filter?.maxResults ?? 100;
    return results.slice(0, max);
  }

  listLandingPages(filter?: ListFilter): CM360LandingPage[] {
    let results = [...this.landingPages.values()];
    if (filter?.advertiserId) {
      results = results.filter((lp) => lp.advertiserId === filter.advertiserId);
    }
    if (filter?.searchString) {
      const search = filter.searchString.toLowerCase();
      results = results.filter((lp) => lp.name.toLowerCase().includes(search));
    }
    const max = filter?.maxResults ?? 100;
    return results.slice(0, max);
  }

  createLandingPage(input: {
    advertiserId: string;
    name: string;
    url: string;
  }): CM360LandingPage {
    const id = this.genId();
    const page: CM360LandingPage = {
      id,
      name: input.name,
      advertiserId: input.advertiserId,
      url: input.url,
      archived: false,
    };
    this.landingPages.set(id, page);
    return page;
  }

  listPlacements(filter?: ListFilter): CM360Placement[] {
    let results = [...this.placements.values()];
    if (filter?.campaignId) {
      results = results.filter((p) => p.campaignId === filter.campaignId);
    }
    if (filter?.advertiserId) {
      results = results.filter((p) => p.advertiserId === filter.advertiserId);
    }
    if (filter?.searchString) {
      const search = filter.searchString.toLowerCase();
      results = results.filter((p) => p.name.toLowerCase().includes(search));
    }
    const max = filter?.maxResults ?? 100;
    return results.slice(0, max);
  }

  createPlacement(input: {
    campaignId: string;
    siteId: string;
    name: string;
    width: number;
    height: number;
    startDate: string;
    endDate: string;
    paymentSource?: string;
    compatibility?: string;
  }): CM360Placement {
    const id = this.genId();
    // Resolve advertiserId from campaign
    const campaign = this.campaigns.get(input.campaignId);
    const compatibility = (input.compatibility as CM360Placement['compatibility']) ?? 'DISPLAY';
    const defaultTagFormat: CM360TagFormat = compatibility === 'IN_STREAM_VIDEO' || compatibility === 'IN_STREAM_AUDIO'
      ? 'PLACEMENT_TAG_VAST_2_0'
      : 'PLACEMENT_TAG_STANDARD';

    const placement: CM360Placement = {
      id,
      name: input.name,
      accountId: ACCOUNT_ID,
      advertiserId: campaign?.advertiserId ?? '',
      campaignId: input.campaignId,
      siteId: input.siteId,
      size: {
        id: `size-${input.width}x${input.height}`,
        width: input.width,
        height: input.height,
        iab: IAB_SIZES.some((s) => s.width === input.width && s.height === input.height),
      },
      status: 'DRAFT',
      activeStatus: 'ACTIVE',
      compatibility,
      pricingSchedule: {
        startDate: input.startDate,
        endDate: input.endDate,
      },
      tagFormats: [defaultTagFormat],
    };
    this.placements.set(id, placement);
    return placement;
  }

  listAds(filter?: ListFilter): CM360Ad[] {
    let results = [...this.ads.values()];
    if (filter?.campaignId) {
      results = results.filter((a) => a.campaignId === filter.campaignId);
    }
    if (filter?.advertiserId) {
      results = results.filter((a) => a.advertiserId === filter.advertiserId);
    }
    if (filter?.searchString) {
      const search = filter.searchString.toLowerCase();
      results = results.filter((a) => a.name.toLowerCase().includes(search));
    }
    const max = filter?.maxResults ?? 100;
    return results.slice(0, max);
  }

  createAd(input: {
    campaignId: string;
    name: string;
    placementIds: string[];
    creativeId: string;
  }): CM360Ad {
    const id = this.genId();
    const campaign = this.campaigns.get(input.campaignId);
    const ad: CM360Ad = {
      id,
      name: input.name,
      campaignId: input.campaignId,
      advertiserId: campaign?.advertiserId ?? '',
      type: 'AD_SERVING_DEFAULT_AD',
      active: true,
      archived: false,
      placementAssignments: input.placementIds.map((pid) => ({ placementId: pid })),
      creativeRotation: {
        type: 'CREATIVE_ROTATION_TYPE_RANDOM',
        creativeAssignments: [{ creativeId: input.creativeId }],
      },
    };
    this.ads.set(id, ad);
    return ad;
  }

  listCreatives(filter?: ListFilter): CM360Creative[] {
    let results = [...this.creatives.values()];
    if (filter?.advertiserId) {
      results = results.filter((c) => c.advertiserId === filter.advertiserId);
    }
    if (filter?.searchString) {
      const search = filter.searchString.toLowerCase();
      results = results.filter((c) => c.name.toLowerCase().includes(search));
    }
    const max = filter?.maxResults ?? 100;
    return results.slice(0, max);
  }

  generateTags(campaignId: string, placementIds: string[], tagFormats?: string[]): CM360PlacementTag[] {
    return placementIds.map((pid) => {
      const placement = this.placements.get(pid);

      // Auto-detect format based on placement compatibility
      let defaultFormat: CM360TagFormat = 'PLACEMENT_TAG_STANDARD';
      if (placement?.compatibility === 'IN_STREAM_VIDEO' || placement?.compatibility === 'IN_STREAM_AUDIO') {
        defaultFormat = 'PLACEMENT_TAG_VAST_2_0';
      }

      const formats = tagFormats ?? [defaultFormat];

      return {
        placementId: pid,
        tagData: formats.map((fmt) => {
          const isVast = fmt.includes('VAST');
          return {
            format: fmt as CM360TagFormat,
            impressionTag: isVast
              ? `<VAST version="2.0"><Ad id="${pid}"><InLine><AdSystem>CM360</AdSystem><AdTitle>${placement?.name ?? 'Unknown'}</AdTitle><Impression><![CDATA[https://ad.doubleclick.net/ddm/trackimp/N${ACCOUNT_ID}.DEMO/${pid};dc_trk_cid=${campaignId};ord=[timestamp]]]></Impression><Creatives><Creative><Linear><MediaFiles></MediaFiles></Linear></Creative></Creatives></InLine></Ad></VAST>`
              : `<script src="https://ad.doubleclick.net/ddm/trackimp/N${ACCOUNT_ID}.DEMO/${pid};dc_trk_aid=${placement?.id ?? 'unknown'};dc_trk_cid=${campaignId};ord=[timestamp]"></script>`,
            clickTag: isVast
              ? `https://ad.doubleclick.net/ddm/trackclk/N${ACCOUNT_ID}.DEMO/${pid};dc_trk_cid=${campaignId}`
              : `https://ad.doubleclick.net/ddm/trackclk/N${ACCOUNT_ID}.DEMO/${pid};dc_trk_aid=${placement?.id ?? 'unknown'};dc_trk_cid=${campaignId}`,
          };
        }),
      };
    });
  }

  // --- Get single entity methods ---

  getCampaign(id: string): CM360Campaign | undefined {
    return this.campaigns.get(id);
  }

  getPlacement(id: string): CM360Placement | undefined {
    return this.placements.get(id);
  }

  getAd(id: string): CM360Ad | undefined {
    return this.ads.get(id);
  }

  getLandingPage(id: string): CM360LandingPage | undefined {
    return this.landingPages.get(id);
  }

  getCreative(id: string): CM360Creative | undefined {
    return this.creatives.get(id);
  }

  getSite(id: string): CM360Site | undefined {
    return this.sites.get(id);
  }

  createCreative(input: {
    advertiserId: string;
    name: string;
    type: CM360CreativeType;
    width: number;
    height: number;
    active?: boolean;
  }): CM360Creative {
    const id = this.genId();
    const creative: CM360Creative = {
      id,
      name: input.name,
      advertiserId: input.advertiserId,
      type: input.type,
      size: {
        id: `size-${input.width}x${input.height}`,
        width: input.width,
        height: input.height,
        iab: IAB_SIZES.some((s) => s.width === input.width && s.height === input.height),
      },
      active: input.active ?? true,
      archived: false,
    };
    this.creatives.set(id, creative);
    return creative;
  }

  listSizes(filter?: { width?: number; height?: number; iabStandard?: boolean }): CM360Size[] {
    let results: CM360Size[] = IAB_SIZES.map((s) => ({
      id: `size-${s.width}x${s.height}`,
      width: s.width,
      height: s.height,
      iab: true,
    }));
    if (filter?.width !== undefined) {
      results = results.filter((s) => s.width === filter.width);
    }
    if (filter?.height !== undefined) {
      results = results.filter((s) => s.height === filter.height);
    }
    if (filter?.iabStandard === false) {
      results = []; // All mock sizes are IAB standard
    }
    return results;
  }

  // --- Phase B: Campaign-Creative Associations ---

  associateCreativeCampaign(campaignId: string, creativeId: string): CM360CampaignCreativeAssociation {
    // Validate campaign exists
    if (!this.campaigns.has(campaignId)) {
      throw new Error(`Campaign ${campaignId} not found`);
    }
    // Validate creative exists
    if (!this.creatives.has(creativeId)) {
      throw new Error(`Creative ${creativeId} not found`);
    }
    const assocSet = this.campaignCreativeAssociations.get(campaignId) ?? new Set<string>();
    assocSet.add(creativeId);
    this.campaignCreativeAssociations.set(campaignId, assocSet);
    return { creativeId };
  }

  listCampaignCreativeAssociations(
    campaignId: string,
    opts?: { maxResults?: number },
  ): CM360CampaignCreativeAssociation[] {
    const assocSet = this.campaignCreativeAssociations.get(campaignId);
    if (!assocSet) return [];
    let results = [...assocSet].map((creativeId) => ({ creativeId }));
    if (opts?.maxResults !== undefined) {
      results = results.slice(0, opts.maxResults);
    }
    return results;
  }

  // --- Phase B: Creative Asset Upload ---

  uploadCreativeAsset(input: {
    advertiserId: string;
    assetName: string;
    assetType: CM360CreativeAssetType;
    assetData: string;
  }): CM360CreativeAssetMetadata {
    // Validate advertiser exists
    if (!this.advertisers.has(input.advertiserId)) {
      throw new Error(`Advertiser ${input.advertiserId} not found`);
    }
    const id = this.genId();
    const fileSize = Math.ceil(input.assetData.length * 0.75); // approx base64 → bytes
    const asset: CM360CreativeAssetMetadata = {
      assetIdentifier: {
        name: input.assetName,
        type: input.assetType,
      },
      id,
      fileSize,
    };
    this.creativeAssets.set(id, asset);
    return asset;
  }

  // --- Event Tags ---

  listEventTags(
    campaignId: string,
    filter?: { advertiserId?: string; searchString?: string },
  ): CM360EventTag[] {
    let results = [...this.eventTags.values()].filter((et) => et.campaignId === campaignId);
    if (filter?.advertiserId) {
      results = results.filter((et) => et.advertiserId === filter.advertiserId);
    }
    if (filter?.searchString) {
      const search = filter.searchString.toLowerCase();
      results = results.filter((et) => et.name.toLowerCase().includes(search));
    }
    return results;
  }

  getEventTag(id: string): CM360EventTag | undefined {
    return this.eventTags.get(id);
  }

  createEventTag(input: CM360CreateEventTagInput): CM360EventTag {
    // Validate campaign exists
    if (!this.campaigns.has(input.campaignId)) {
      throw new Error(`Campaign ${input.campaignId} not found`);
    }
    const id = this.genId();
    const tag: CM360EventTag = {
      id,
      accountId: ACCOUNT_ID,
      advertiserId: input.advertiserId,
      campaignId: input.campaignId,
      name: input.name,
      url: input.url,
      type: input.type,
      status: 'ENABLED',
      siteIds: input.siteIds ?? [],
      enabledByDefault: input.enabledByDefault ?? false,
      excludeFromAdxRequests: false,
      sslCompliant: input.url.startsWith('https'),
    };
    this.eventTags.set(id, tag);
    return tag;
  }

  updateEventTag(id: string, input: CM360UpdateEventTagInput): CM360EventTag | undefined {
    const tag = this.eventTags.get(id);
    if (!tag) return undefined;
    const updated: CM360EventTag = {
      ...tag,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.url !== undefined && { url: input.url, sslCompliant: input.url.startsWith('https') }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.siteIds !== undefined && { siteIds: input.siteIds }),
      ...(input.enabledByDefault !== undefined && { enabledByDefault: input.enabledByDefault }),
    };
    this.eventTags.set(id, updated);
    return updated;
  }

  deleteEventTag(id: string): boolean {
    return this.eventTags.delete(id);
  }

  // --- Placement Groups ---

  listPlacementGroups(
    campaignId: string,
    filter?: { advertiserId?: string; searchString?: string; maxResults?: number },
  ): CM360PlacementGroup[] {
    let results = [...this.placementGroups.values()].filter((pg) => pg.campaignId === campaignId);
    if (filter?.advertiserId) {
      results = results.filter((pg) => pg.advertiserId === filter.advertiserId);
    }
    if (filter?.searchString) {
      const search = filter.searchString.toLowerCase();
      results = results.filter((pg) => pg.name.toLowerCase().includes(search));
    }
    const max = filter?.maxResults ?? 100;
    return results.slice(0, max);
  }

  getPlacementGroup(id: string): CM360PlacementGroup | undefined {
    return this.placementGroups.get(id);
  }

  createPlacementGroup(input: CM360CreatePlacementGroupInput): CM360PlacementGroup {
    // Validate campaign exists
    if (!this.campaigns.has(input.campaignId)) {
      throw new Error(`Campaign ${input.campaignId} not found`);
    }
    // Validate site exists
    if (!this.sites.has(input.siteId)) {
      throw new Error(`Site ${input.siteId} not found`);
    }
    // Derive advertiserId from campaign
    const campaign = this.campaigns.get(input.campaignId)!;
    const id = this.genId();
    const group: CM360PlacementGroup = {
      id,
      name: input.name,
      accountId: ACCOUNT_ID,
      advertiserId: campaign.advertiserId,
      campaignId: input.campaignId,
      siteId: input.siteId,
      placementGroupType: input.placementGroupType,
      placementIds: input.placementIds ?? [],
      activeStatus: 'ACTIVE',
      pricingSchedule: {
        startDate: input.startDate,
        endDate: input.endDate,
      },
    };
    this.placementGroups.set(id, group);
    return group;
  }

  updatePlacementGroup(id: string, input: CM360UpdatePlacementGroupInput): CM360PlacementGroup | undefined {
    const group = this.placementGroups.get(id);
    if (!group) return undefined;
    const updated: CM360PlacementGroup = {
      ...group,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.activeStatus !== undefined && { activeStatus: input.activeStatus }),
      ...(input.placementIds !== undefined && { placementIds: input.placementIds }),
      ...((input.startDate !== undefined || input.endDate !== undefined) && {
        pricingSchedule: {
          startDate: input.startDate ?? group.pricingSchedule.startDate,
          endDate: input.endDate ?? group.pricingSchedule.endDate,
        },
      }),
    };
    this.placementGroups.set(id, updated);
    return updated;
  }

  // --- Update methods ---

  updateCampaign(id: string, input: CM360UpdateCampaignInput): CM360Campaign | undefined {
    const campaign = this.campaigns.get(id);
    if (!campaign) return undefined;
    const updated: CM360Campaign = {
      ...campaign,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.endDate !== undefined && { endDate: input.endDate }),
      ...(input.archived !== undefined && { archived: input.archived }),
      ...(input.defaultLandingPageId !== undefined && { defaultLandingPageId: input.defaultLandingPageId }),
    };
    this.campaigns.set(id, updated);
    return updated;
  }

  updatePlacement(id: string, input: CM360UpdatePlacementInput): CM360Placement | undefined {
    const placement = this.placements.get(id);
    if (!placement) return undefined;
    const updated: CM360Placement = {
      ...placement,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.activeStatus !== undefined && { activeStatus: input.activeStatus }),
      ...(input.archived !== undefined && { archived: input.archived }),
      ...((input.startDate !== undefined || input.endDate !== undefined) && {
        pricingSchedule: {
          startDate: input.startDate ?? placement.pricingSchedule.startDate,
          endDate: input.endDate ?? placement.pricingSchedule.endDate,
        },
      }),
    };
    this.placements.set(id, updated);
    return updated;
  }

  updateAd(id: string, input: CM360UpdateAdInput): CM360Ad | undefined {
    const ad = this.ads.get(id);
    if (!ad) return undefined;
    const updated: CM360Ad = {
      ...ad,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.active !== undefined && { active: input.active }),
      ...(input.archived !== undefined && { archived: input.archived }),
      ...(input.startTime !== undefined && { startTime: input.startTime }),
      ...(input.endTime !== undefined && { endTime: input.endTime }),
      ...(input.placementIds !== undefined && {
        placementAssignments: input.placementIds.map((pid) => ({ placementId: pid })),
      }),
      ...(input.creativeId !== undefined && {
        creativeRotation: {
          type: ad.creativeRotation.type,
          creativeAssignments: [{ creativeId: input.creativeId }],
        },
      }),
    };
    this.ads.set(id, updated);
    return updated;
  }

  updateCreative(id: string, input: CM360UpdateCreativeInput): CM360Creative | undefined {
    const creative = this.creatives.get(id);
    if (!creative) return undefined;
    const updated: CM360Creative = {
      ...creative,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.active !== undefined && { active: input.active }),
      ...(input.archived !== undefined && { archived: input.archived }),
    };
    this.creatives.set(id, updated);
    return updated;
  }

  updateLandingPage(id: string, input: CM360UpdateLandingPageInput): CM360LandingPage | undefined {
    const page = this.landingPages.get(id);
    if (!page) return undefined;
    const updated: CM360LandingPage = {
      ...page,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.url !== undefined && { url: input.url }),
      ...(input.archived !== undefined && { archived: input.archived }),
    };
    this.landingPages.set(id, updated);
    return updated;
  }

  // --- Directory Sites ---

  listDirectorySites(filter: { searchString?: string; active?: boolean } = {}): Array<{
    id: string; name: string; url: string; active: boolean;
    interstitialTagFormats: string[]; inpageTagFormats: string[];
  }> {
    let results = [...this.directorySites.values()];
    if (filter.searchString) {
      const s = filter.searchString.toLowerCase();
      results = results.filter(
        (ds) => ds.name.toLowerCase().includes(s) || ds.url.toLowerCase().includes(s),
      );
    }
    if (filter.active !== undefined) {
      results = results.filter((ds) => ds.active === filter.active);
    }
    return results;
  }

  getDirectorySite(id: string): {
    id: string; name: string; url: string; active: boolean;
    interstitialTagFormats: string[]; inpageTagFormats: string[];
  } | null {
    return this.directorySites.get(id) ?? null;
  }

  /**
   * "Insert" a directory site — this creates an approved CM360Site from the
   * directory entry, mirroring the real CM360 directorySites.insert behavior.
   */
  insertDirectorySite(directorySiteId: string): CM360Site {
    const ds = this.directorySites.get(directorySiteId);
    if (!ds) {
      throw new Error(`Directory site ${directorySiteId} not found`);
    }
    // Check if already approved as a site
    for (const site of this.sites.values()) {
      if (site.name === ds.name) {
        return site; // Idempotent — return existing site
      }
    }
    const siteId = this.genId();
    const site: CM360Site = {
      id: siteId,
      name: ds.name,
      accountId: ACCOUNT_ID,
      approved: true,
    };
    this.sites.set(siteId, site);
    return site;
  }

  // --- Change Logs ---

  listChangeLogs(filter: {
    objectType?: CM360ChangeLogObjectType;
    objectId?: string;
    action?: CM360ChangeLogAction;
    minChangeTime?: string;
    maxChangeTime?: string;
    searchString?: string;
    maxResults?: number;
  } = {}): CM360ChangeLog[] {
    let results = [...this.changeLogs];

    if (filter.objectType) {
      results = results.filter((cl) => cl.objectType === filter.objectType);
    }
    if (filter.objectId) {
      results = results.filter((cl) => cl.objectId === filter.objectId);
    }
    if (filter.action) {
      results = results.filter((cl) => cl.action === filter.action);
    }
    if (filter.minChangeTime) {
      const min = new Date(filter.minChangeTime).getTime();
      results = results.filter((cl) => new Date(cl.changeTime).getTime() >= min);
    }
    if (filter.maxChangeTime) {
      const max = new Date(filter.maxChangeTime).getTime();
      results = results.filter((cl) => new Date(cl.changeTime).getTime() <= max);
    }
    if (filter.searchString) {
      const s = filter.searchString.toLowerCase();
      results = results.filter(
        (cl) =>
          cl.objectType.toLowerCase().includes(s) ||
          cl.action.toLowerCase().includes(s) ||
          (cl.fieldName && cl.fieldName.toLowerCase().includes(s)) ||
          (cl.oldValue && cl.oldValue.toLowerCase().includes(s)) ||
          (cl.newValue && cl.newValue.toLowerCase().includes(s)),
      );
    }

    // Sort by changeTime descending (newest first)
    results.sort((a, b) => new Date(b.changeTime).getTime() - new Date(a.changeTime).getTime());

    const max = filter.maxResults ?? 100;
    return results.slice(0, max);
  }

  getChangeLog(id: string): CM360ChangeLog | undefined {
    return this.changeLogs.find((cl) => cl.id === id);
  }

  // --- Reports ---

  listReports(): CM360Report[] {
    return Array.from(this.reports.values());
  }

  getReport(reportId: string): CM360Report | undefined {
    return this.reports.get(reportId);
  }

  /** Create a new report definition */
  createReport(input: CM360CreateReportInput, profileId: string): CM360Report {
    const reportId = `rpt-${this.reports.size + 1}`;
    const report: CM360Report = {
      id: reportId,
      name: input.name,
      type: input.type,
      accountId: ACCOUNT_ID,
      ownerProfileId: profileId,
      criteria: {
        dateRange: { startDate: input.startDate, endDate: input.endDate },
        dimensions: input.dimensions,
        metricNames: input.metricNames,
        ...(input.filters?.length ? { filters: input.filters } : {}),
      },
      lastModifiedTime: new Date().toISOString(),
    };
    this.reports.set(reportId, report);
    return report;
  }

  /** Simulate running a saved report — returns a mock fileId immediately */
  runReport(reportId: string, profileId: string): CM360ReportFile | null {
    const report = this.reports.get(reportId);
    if (!report) return null;

    const fileId = `file-${reportId}-${Date.now()}`;
    const reportFile: CM360ReportFile = {
      reportId,
      fileId,
      status: 'REPORT_AVAILABLE' as CM360ReportFileStatus,
      fileName: `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`,
      dateRange: {
        startDate: report.criteria.dateRange.startDate,
        endDate: report.criteria.dateRange.endDate,
      },
      totalRows: 0,
      rowsReturned: 0,
      truncated: false,
      columns: [...report.criteria.dimensions, ...report.criteria.metricNames],
      rows: [],
      summary: {},
      cm360Link: `https://campaignmanager.google.com/#/reporting/${profileId}/report/${reportId}`,
    };

    // Generate mock rows based on the report's dimensions and metrics
    const rows = this.generateMockReportRows(report);
    reportFile.rows = rows;
    reportFile.totalRows = rows.length;
    reportFile.rowsReturned = rows.length;
    reportFile.summary = this.computeSummary(rows, report.criteria.metricNames);

    this.reportFiles.set(fileId, reportFile);
    return reportFile;
  }

  /** Get a previously-run report file by fileId */
  getReportFile(fileId: string): CM360ReportFile | undefined {
    return this.reportFiles.get(fileId);
  }

  /** Return compatible dimensions/metrics for a given report type */
  queryCompatibleFields(reportType: string): CM360CompatibleFields {
    const standardFields = {
      dimensions: ['campaign', 'placement', 'site', 'ad', 'creative', 'date', 'week', 'month', 'advertiser', 'placementSize'],
      metrics: ['impressions', 'clicks', 'clickRate', 'totalConversions', 'mediaCost', 'richMediaVideoViews', 'richMediaVideoCompletions'],
      dimensionFilters: ['advertiser', 'campaign', 'site', 'placement', 'ad', 'creative'],
      pivotedActivityMetrics: ['totalConversions', 'totalConversionsRevenue'],
    };

    const fieldsByType: Record<string, Omit<CM360CompatibleFields, 'reportType'>> = {
      STANDARD: standardFields,
      REACH: {
        dimensions: ['campaign', 'site', 'date', 'month'],
        metrics: ['totalReach', 'averageFrequency', 'impressions'],
        dimensionFilters: ['advertiser', 'campaign'],
        pivotedActivityMetrics: [],
      },
      PATH_TO_CONVERSION: {
        dimensions: ['campaign', 'placement', 'ad', 'creative', 'interactionType', 'interactionTime'],
        metrics: ['totalConversions', 'totalConversionsRevenue'],
        dimensionFilters: ['advertiser', 'campaign', 'floodlightActivity'],
        pivotedActivityMetrics: ['totalConversions', 'totalConversionsRevenue'],
      },
      FLOODLIGHT: {
        dimensions: ['floodlightActivity', 'campaign', 'date'],
        metrics: ['floodlightImpressions', 'floodlightClicks', 'floodlightConversions', 'floodlightRevenue'],
        dimensionFilters: ['advertiser', 'floodlightConfiguration'],
        pivotedActivityMetrics: ['floodlightConversions', 'floodlightRevenue'],
      },
      CROSS_MEDIA_REACH: {
        dimensions: ['campaign', 'date'],
        metrics: ['crossMediaReach', 'crossMediaFrequency', 'impressions'],
        dimensionFilters: ['advertiser', 'campaign'],
        pivotedActivityMetrics: [],
      },
    };

    const fields = fieldsByType[reportType] ?? standardFields;
    return { reportType: reportType as CM360ReportType, ...fields };
  }

  /** Generate mock report rows based on report dimensions and metrics.
   *  Uses actual placement→site relationships from the data store so that
   *  site names match the placements shown (e.g., Bloomberg placements appear under Bloomberg.com).
   */
  private generateMockReportRows(report: CM360Report): Array<Record<string, string>> {
    const rows: Array<Record<string, string>> = [];

    // Extract filter constraints from the report criteria.
    // Filter values may be entity IDs or names — resolve both for matching.
    const filters = report.criteria.filters ?? [];
    const campaignFilterRaw = filters.find((f) => f.dimensionName === 'campaign')?.value;
    const advertiserFilterRaw = filters.find((f) => f.dimensionName === 'advertiser')?.value;

    // Resolve campaign filter to an ID set (handles both name and ID)
    const matchingCampaignIds = new Set<string>();
    if (campaignFilterRaw) {
      // Try direct ID match
      if (this.campaigns.has(campaignFilterRaw)) {
        matchingCampaignIds.add(campaignFilterRaw);
      }
      // Also match by name (case-insensitive partial match)
      const lowerFilter = campaignFilterRaw.toLowerCase();
      for (const [id, camp] of this.campaigns.entries()) {
        if (camp.name.toLowerCase().includes(lowerFilter) || id === campaignFilterRaw) {
          matchingCampaignIds.add(id);
        }
      }
    }

    // Resolve advertiser filter to an ID set
    const matchingAdvertiserIds = new Set<string>();
    if (advertiserFilterRaw) {
      if (this.advertisers.has(advertiserFilterRaw)) {
        matchingAdvertiserIds.add(advertiserFilterRaw);
      }
      const lowerFilter = advertiserFilterRaw.toLowerCase();
      for (const [id, adv] of this.advertisers.entries()) {
        if (adv.name.toLowerCase().includes(lowerFilter) || id === advertiserFilterRaw) {
          matchingAdvertiserIds.add(id);
        }
      }
    }

    // If we have a campaign filter, also resolve its advertiser for consistent scoping
    if (matchingCampaignIds.size > 0 && matchingAdvertiserIds.size === 0) {
      for (const campId of matchingCampaignIds) {
        const camp = this.campaigns.get(campId);
        if (camp) matchingAdvertiserIds.add(camp.advertiserId);
      }
    }

    // Build a list of real placement+site+campaign combos from the store,
    // filtered to only include placements that match the report's filters
    type MediaType = 'display' | 'video' | 'audio' | 'tracking';
    const combos: Array<{ placement: string; site: string; campaign: string; mediaType: MediaType }> = [];
    for (const p of this.placements.values()) {
      // Filter by campaign if specified
      if (matchingCampaignIds.size > 0 && !matchingCampaignIds.has(p.campaignId)) continue;
      // Filter by advertiser if specified (or resolved from campaign)
      if (matchingAdvertiserIds.size > 0 && !matchingAdvertiserIds.has(p.advertiserId)) continue;

      const site = this.sites.get(p.siteId);
      const campaign = this.campaigns.get(p.campaignId);
      if (site && campaign) {
        let mediaType: MediaType = 'display';
        if (p.size.width === 1 && p.size.height === 1) mediaType = 'tracking';
        else if (p.compatibility === 'IN_STREAM_VIDEO' || (p.size.width === 640 && p.size.height === 360)) mediaType = 'video';
        else if (p.name.toLowerCase().includes('audio')) mediaType = 'audio';
        combos.push({
          placement: p.name,
          site: site.name,
          campaign: campaign.name,
          mediaType,
        });
      }
    }

    // Pick a subset of combos (10-18 rows) for the report, sorted by site for natural grouping
    const shuffled = combos.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(combos.length, 10 + Math.floor(Math.random() * 9)));
    selected.sort((a, b) => a.site.localeCompare(b.site));

    for (let i = 0; i < selected.length; i++) {
      const combo = selected[i]!;
      const row: Record<string, string> = {};

      for (const dim of report.criteria.dimensions) {
        switch (dim) {
          case 'campaign': row[dim] = combo.campaign; break;
          case 'placement': row[dim] = combo.placement; break;
          case 'site': row[dim] = combo.site; break;
          case 'date': row[dim] = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10); break;
          case 'ad': row[dim] = combo.placement.replace(/_\d+x\d+.*/, '') + ' Ad'; break;
          case 'creative': row[dim] = combo.placement.replace(/_\d+x\d+.*/, '') + ' Creative'; break;
          default: row[dim] = `${dim}_${i}`; break;
        }
      }

      for (const metric of report.criteria.metricNames) {
        switch (metric) {
          case 'impressions': {
            // Tracking (1x1) placements have high impressions but no clicks; audio/video moderate
            if (combo.mediaType === 'tracking') row[metric] = String(50000 + Math.floor(Math.random() * 150000));
            else if (combo.mediaType === 'video') row[metric] = String(15000 + Math.floor(Math.random() * 60000));
            else if (combo.mediaType === 'audio') row[metric] = String(20000 + Math.floor(Math.random() * 80000));
            else row[metric] = String(10000 + Math.floor(Math.random() * 90000));
            break;
          }
          case 'clicks': {
            // Tracking placements typically have 0 clicks (they're impression trackers)
            if (combo.mediaType === 'tracking') row[metric] = '0';
            else row[metric] = String(100 + Math.floor(Math.random() * 900));
            break;
          }
          case 'CTR':
          case 'clickRate': row[metric] = (0.005 + Math.random() * 0.02).toFixed(4); break;
          case 'conversions':
          case 'totalConversions': row[metric] = String(Math.floor(Math.random() * 50)); break;
          case 'mediaCost': row[metric] = (100 + Math.random() * 5000).toFixed(2); break;
          case 'totalReach': row[metric] = String(50000 + Math.floor(Math.random() * 200000)); break;
          case 'averageFrequency': row[metric] = (1.5 + Math.random() * 3).toFixed(2); break;
          case 'richMediaVideoViews': {
            // Video and audio placements get video/listen metrics
            row[metric] = (combo.mediaType === 'video' || combo.mediaType === 'audio')
              ? String(5000 + Math.floor(Math.random() * 40000)) : '0';
            break;
          }
          case 'richMediaVideoCompletions': {
            row[metric] = (combo.mediaType === 'video' || combo.mediaType === 'audio')
              ? String(2000 + Math.floor(Math.random() * 20000)) : '0';
            break;
          }
          default: row[metric] = String(Math.floor(Math.random() * 1000)); break;
        }
      }
      rows.push(row);
    }
    return rows;
  }

  /** Compute summary aggregates from parsed rows */
  private computeSummary(rows: Array<Record<string, string>>, metricNames: string[]): CM360ReportFile['summary'] {
    const summary: CM360ReportFile['summary'] = {};
    if (metricNames.includes('impressions')) {
      summary.totalImpressions = rows.reduce((sum, r) => sum + (parseInt(r['impressions'] ?? '0', 10) || 0), 0);
    }
    if (metricNames.includes('clicks')) {
      summary.totalClicks = rows.reduce((sum, r) => sum + (parseInt(r['clicks'] ?? '0', 10) || 0), 0);
    }
    if (summary.totalImpressions && summary.totalClicks) {
      summary.averageCTR = summary.totalImpressions > 0 ? summary.totalClicks / summary.totalImpressions : 0;
    }
    if (metricNames.includes('totalConversions') || metricNames.includes('conversions')) {
      const key = metricNames.includes('totalConversions') ? 'totalConversions' : 'conversions';
      summary.totalConversions = rows.reduce((sum, r) => sum + (parseInt(r[key] ?? '0', 10) || 0), 0);
    }
    if (metricNames.includes('mediaCost')) {
      summary.totalSpend = rows.reduce((sum, r) => sum + (parseFloat(r['mediaCost'] ?? '0') || 0), 0);
    }
    if (metricNames.includes('richMediaVideoViews')) {
      summary.totalVideoViews = rows.reduce((sum, r) => sum + (parseInt(r['richMediaVideoViews'] ?? '0', 10) || 0), 0);
    }
    if (metricNames.includes('richMediaVideoCompletions')) {
      summary.totalVideoCompletions = rows.reduce((sum, r) => sum + (parseInt(r['richMediaVideoCompletions'] ?? '0', 10) || 0), 0);
    }
    return summary;
  }

  // --- Floodlight Activities ---

  listFloodlightActivities(
    advertiserId: string,
    filter?: { floodlightActivityGroupId?: string; searchString?: string },
  ): CM360FloodlightActivity[] {
    let results = [...this.floodlightActivities.values()].filter(
      (a) => a.advertiserId === advertiserId,
    );
    if (filter?.floodlightActivityGroupId) {
      results = results.filter(
        (a) => a.floodlightActivityGroupId === filter.floodlightActivityGroupId,
      );
    }
    if (filter?.searchString) {
      const search = filter.searchString.toLowerCase();
      results = results.filter((a) => a.name.toLowerCase().includes(search));
    }
    return results;
  }

  getFloodlightActivity(id: string): CM360FloodlightActivity | undefined {
    return this.floodlightActivities.get(id);
  }

  createFloodlightActivity(input: CM360CreateFloodlightActivityInput): CM360FloodlightActivity {
    const group = this.floodlightActivityGroups.get(input.floodlightActivityGroupId);
    if (!group) {
      throw new Error(`Floodlight activity group ${input.floodlightActivityGroupId} not found`);
    }
    if (input.type !== group.type) {
      throw new Error(`Activity type ${input.type} does not match group type ${group.type}`);
    }
    const id = this.genId();
    const activity: CM360FloodlightActivity = {
      id,
      name: input.name,
      accountId: ACCOUNT_ID,
      advertiserId: input.advertiserId,
      floodlightConfigurationId: group.floodlightConfigurationId,
      floodlightActivityGroupId: group.id,
      floodlightActivityGroupName: group.name,
      floodlightActivityGroupType: group.type,
      type: input.type,
      countingMethod: input.countingMethod,
      tagString: input.tagString,
      tagFormat: input.tagFormat ?? 'GLOBAL_SITE_TAG',
      expectedUrl: input.expectedUrl,
      notes: input.notes,
      status: 'ACTIVE',
      sslRequired: true,
    };
    this.floodlightActivities.set(id, activity);
    return activity;
  }

  generateFloodlightTag(activityId: string): CM360FloodlightTag | undefined {
    const activity = this.floodlightActivities.get(activityId);
    if (!activity) return undefined;
    const config = this.floodlightConfigurations.get(activity.floodlightConfigurationId);
    const src = config?.id ?? 'UNKNOWN';
    return {
      globalSiteTagGlobalSnippet: `<!-- Global site tag (gtag.js) - CM360 -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=DC-${src}"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', 'DC-${src}');\n</script>`,
      globalSiteTagEventSnippet: `<!-- Event snippet for ${activity.name} -->\n<script>\n  gtag('event', 'conversion', {\n    'allow_custom_scripts': true,\n    'send_to': 'DC-${src}/${activity.floodlightActivityGroupName.replace(/\\s/g, '_').toLowerCase()}/${activity.tagString}+${activity.type.toLowerCase() === 'counter' ? 'standard' : 'transactions'}'\n  });\n</script>`,
      iframeTag: `<iframe src="https://ad.doubleclick.net/ddm/activity/src=${src};type=${activity.floodlightActivityGroupName.replace(/\\s/g, '_').toLowerCase()};cat=${activity.tagString};dc_lat=;dc_rdid=;tag_for_child_directed_treatment=;tfua=;npa=;gdpr=\${GDPR};gdpr_consent=\${GDPR_CONSENT_755};ord=1?" width="1" height="1" frameborder="0" style="display:none"></iframe>`,
      imageTag: `<img src="https://ad.doubleclick.net/ddm/activity/src=${src};type=${activity.floodlightActivityGroupName.replace(/\\s/g, '_').toLowerCase()};cat=${activity.tagString};dc_lat=;dc_rdid=;tag_for_child_directed_treatment=;tfua=;npa=;gdpr=\${GDPR};gdpr_consent=\${GDPR_CONSENT_755};ord=1?" width="1" height="1" alt=""/>`,
    };
  }

  // --- Floodlight Activity Groups ---

  listFloodlightActivityGroups(
    advertiserId: string,
    filter?: { searchString?: string },
  ): CM360FloodlightActivityGroup[] {
    let results = [...this.floodlightActivityGroups.values()].filter(
      (g) => g.advertiserId === advertiserId,
    );
    if (filter?.searchString) {
      const search = filter.searchString.toLowerCase();
      results = results.filter((g) => g.name.toLowerCase().includes(search));
    }
    return results;
  }

  getFloodlightActivityGroup(id: string): CM360FloodlightActivityGroup | undefined {
    return this.floodlightActivityGroups.get(id);
  }

  createFloodlightActivityGroup(input: CM360CreateFloodlightActivityGroupInput): CM360FloodlightActivityGroup {
    // Find the advertiser's floodlight configuration
    const config = [...this.floodlightConfigurations.values()].find(
      (c) => c.advertiserId === input.advertiserId,
    );
    if (!config) {
      throw new Error(`No Floodlight configuration found for advertiser ${input.advertiserId}`);
    }
    const id = this.genId();
    const group: CM360FloodlightActivityGroup = {
      id,
      name: input.name,
      accountId: ACCOUNT_ID,
      advertiserId: input.advertiserId,
      floodlightConfigurationId: config.id,
      type: input.type,
      tagString: input.tagString,
    };
    this.floodlightActivityGroups.set(id, group);
    return group;
  }

  // --- Floodlight Configurations (read-only) ---

  listFloodlightConfigurations(advertiserId: string): CM360FloodlightConfiguration[] {
    return [...this.floodlightConfigurations.values()].filter(
      (c) => c.advertiserId === advertiserId,
    );
  }

  // ---------------------------------------------------------------------------
  // Pacing Analysis — computes linear pacing per placement for a campaign
  // ---------------------------------------------------------------------------

  getPacingAnalysis(campaignId: string): {
    campaignName: string;
    analysisDate: string;
    overallStatus: 'ahead' | 'behind' | 'on_track' | 'completed' | 'not_started';
    placements: Array<{
      placementId: string;
      placementName: string;
      siteName: string;
      compatibility?: string;
      size: string;
      flightStart: string;
      flightEnd: string;
      daysElapsed: number;
      daysRemaining: number;
      percentTimeElapsed: number;
      impressionsGoal: number;
      impressionsDelivered: number;
      impressionsExpected: number;
      impressionsPacingPercent: number;
      impressionsStatus: 'ahead' | 'behind' | 'on_track' | 'completed' | 'not_started';
      budget?: number;
      spend?: number;
      spendExpected?: number;
      spendPacingPercent?: number;
      spendStatus?: 'ahead' | 'behind' | 'on_track';
    }>;
    summary: string;
  } {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    const today = new Date();
    const analysisDate = today.toISOString().slice(0, 10);
    const placements = this.listPlacements({ campaignId });

    const pacingPlacements = placements
      .filter(p => p.pricingSchedule.pricingPeriods && p.pricingSchedule.pricingPeriods.length > 0)
      .map(p => {
        const period = p.pricingSchedule.pricingPeriods![0]!;
        const flightStart = new Date(p.pricingSchedule.startDate);
        const flightEnd = new Date(p.pricingSchedule.endDate);
        const totalFlightMs = flightEnd.getTime() - flightStart.getTime();
        const totalFlightDays = Math.max(1, Math.ceil(totalFlightMs / (1000 * 60 * 60 * 24)));

        let daysElapsed: number;
        let daysRemaining: number;
        let status: 'ahead' | 'behind' | 'on_track' | 'completed' | 'not_started';

        if (today < flightStart) {
          daysElapsed = 0;
          daysRemaining = totalFlightDays;
          status = 'not_started';
        } else if (today > flightEnd) {
          daysElapsed = totalFlightDays;
          daysRemaining = 0;
          status = 'completed';
        } else {
          const elapsedMs = today.getTime() - flightStart.getTime();
          daysElapsed = Math.ceil(elapsedMs / (1000 * 60 * 60 * 24));
          daysRemaining = totalFlightDays - daysElapsed;
          status = 'on_track';
        }

        const percentTimeElapsed = Math.round((daysElapsed / totalFlightDays) * 1000) / 10;
        const impressionsGoal = period.units;
        const impressionsExpected = Math.round(impressionsGoal * (daysElapsed / totalFlightDays));

        // Generate synthetic delivery data with ±20% variance using seeded random
        // Hash the placement ID (UUID) to get a numeric seed
        let seed = 0;
        for (let i = 0; i < p.id.length; i++) {
          seed = ((seed << 5) - seed + p.id.charCodeAt(i)) | 0;
        }
        seed = Math.abs(seed) || 1;
        const variance = ((seed * 7 + 13) % 41 - 20) / 100;
        const impressionsDelivered = status === 'not_started' ? 0
          : status === 'completed' ? Math.round(impressionsGoal * (1 + variance * 0.5))
          : Math.round(impressionsExpected * (1 + variance));

        let impressionsPacingPercent = 0;
        if (impressionsExpected > 0) {
          impressionsPacingPercent = Math.round((impressionsDelivered / impressionsExpected) * 1000) / 10;
        }

        let impressionsStatus: 'ahead' | 'behind' | 'on_track' | 'completed' | 'not_started';
        if (status === 'not_started' || status === 'completed') {
          impressionsStatus = status;
        } else if (impressionsPacingPercent < 90) {
          impressionsStatus = 'behind';
        } else if (impressionsPacingPercent > 110) {
          impressionsStatus = 'ahead';
        } else {
          impressionsStatus = 'on_track';
        }

        // Compute spend pacing for CPM placements
        const ratePerThousand = period.rateOrCostNanos / 1_000_000_000;
        const budget = Math.round((impressionsGoal / 1000) * ratePerThousand * 100) / 100;
        const spend = Math.round((impressionsDelivered / 1000) * ratePerThousand * 100) / 100;
        const spendExpected = Math.round((impressionsExpected / 1000) * ratePerThousand * 100) / 100;
        const spendPacingPercent = spendExpected > 0
          ? Math.round((spend / spendExpected) * 1000) / 10
          : 0;
        let spendStatus: 'ahead' | 'behind' | 'on_track' | undefined;
        if (status !== 'not_started' && status !== 'completed') {
          spendStatus = spendPacingPercent < 90 ? 'behind' : spendPacingPercent > 110 ? 'ahead' : 'on_track';
        }

        const site = this.sites.get(p.siteId);

        return {
          placementId: p.id,
          placementName: p.name,
          siteName: site?.name ?? 'Unknown',
          compatibility: p.compatibility,
          size: `${p.size.width}x${p.size.height}`,
          flightStart: p.pricingSchedule.startDate,
          flightEnd: p.pricingSchedule.endDate,
          daysElapsed,
          daysRemaining,
          percentTimeElapsed,
          impressionsGoal,
          impressionsDelivered,
          impressionsExpected,
          impressionsPacingPercent,
          impressionsStatus,
          budget,
          spend,
          spendExpected,
          spendPacingPercent,
          spendStatus,
        };
      });

    // Overall status: worst-case across placements
    const statusPriority: Record<string, number> = { behind: 0, on_track: 1, ahead: 2, not_started: 3, completed: 4 };
    const overallStatus = pacingPlacements.length === 0
      ? 'not_started' as const
      : pacingPlacements.reduce((worst, p) =>
          statusPriority[p.impressionsStatus]! < statusPriority[worst]!
            ? p.impressionsStatus
            : worst,
        'completed' as 'ahead' | 'behind' | 'on_track' | 'completed' | 'not_started');

    // Generate summary
    const behindCount = pacingPlacements.filter(p => p.impressionsStatus === 'behind').length;
    const aheadCount = pacingPlacements.filter(p => p.impressionsStatus === 'ahead').length;
    const onTrackCount = pacingPlacements.filter(p => p.impressionsStatus === 'on_track').length;
    const totalBudget = pacingPlacements.reduce((sum, p) => sum + (p.budget ?? 0), 0);
    const totalSpend = pacingPlacements.reduce((sum, p) => sum + (p.spend ?? 0), 0);

    const summary = `Campaign "${campaign.name}" pacing analysis as of ${analysisDate}: `
      + `${pacingPlacements.length} placements analyzed. `
      + `${onTrackCount} on track, ${aheadCount} ahead, ${behindCount} behind. `
      + `Total budget: $${totalBudget.toLocaleString()}, spent: $${totalSpend.toLocaleString()}.`;

    return {
      campaignName: campaign.name,
      analysisDate,
      overallStatus,
      placements: pacingPlacements,
      summary,
    };
  }

  reset(): void {
    this.profiles = [];
    this.advertisers.clear();
    this.campaigns.clear();
    this.sites.clear();
    this.landingPages.clear();
    this.placements.clear();
    this.ads.clear();
    this.creatives.clear();
    this.campaignCreativeAssociations.clear();
    this.creativeAssets.clear();
    this.eventTags.clear();
    this.placementGroups.clear();
    this.changeLogs = [];
    this.reports.clear();
    this.reportFiles.clear();
    this.directorySites.clear();
    this.floodlightActivities.clear();
    this.floodlightActivityGroups.clear();
    this.floodlightConfigurations.clear();
    this.nextId = 90000;
    this.seed();
  }
}

export const mockStore = new MockDataStore();
