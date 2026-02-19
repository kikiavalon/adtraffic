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
  CM360UpdateCampaignInput,
  CM360UpdatePlacementInput,
  CM360UpdateAdInput,
  CM360UpdateCreativeInput,
  CM360UpdateLandingPageInput,
} from '@adtraffic/shared';

const ACCOUNT_ID = '67890';

const IAB_SIZES = [
  { width: 300, height: 250 },
  { width: 728, height: 90 },
  { width: 970, height: 250 },
  { width: 160, height: 600 },
  { width: 320, height: 50 },
  { width: 300, height: 600 },
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

    // --- Sites (10 real publisher names) ---
    const siteDefs = [
      'ESPN.com', 'CNN.com', 'Forbes.com', 'Bloomberg.com', 'NYTimes.com',
      'WashingtonPost.com', 'TheVerge.com', 'TechCrunch.com', 'Hulu.com', 'Spotify.com',
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

    // --- Placements (~80 total, spread across campaigns and sites) ---
    const placementTypes = ['Standard', 'Roadblock', 'Interstitial'];
    for (let ai = 0; ai < advertiserIds.length; ai++) {
      const advId = advertiserIds[ai]!;
      const advName = advertiserDefs[ai]!.name.split(' ')[0]!;
      const campIds = campaignsByAdvertiser.get(advId) ?? [];

      for (const campId of campIds) {
        const camp = this.campaigns.get(campId)!;
        const placementCount = faker.number.int({ min: 2, max: 4 });

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
            },
            activeStatus: 'ACTIVE',
            tagFormats: ['PLACEMENT_TAG_STANDARD'],
          });
        }
      }
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
            active: true,
            archived: false,
            placementAssignments: [{ placementId: placement.id }],
            creativeRotation: {
              creativeAssignments: [{ creativeId }],
            },
          });
        }
      }
    }

    // --- Campaign-Creative Associations (seed from ad data) ---
    for (const ad of this.ads.values()) {
      const assocSet = this.campaignCreativeAssociations.get(ad.campaignId) ?? new Set<string>();
      for (const ca of ad.creativeRotation.creativeAssignments) {
        assocSet.add(ca.creativeId);
      }
      this.campaignCreativeAssociations.set(ad.campaignId, assocSet);
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
      pricingSchedule: {
        startDate: input.startDate,
        endDate: input.endDate,
      },
      tagFormats: ['PLACEMENT_TAG_STANDARD'],
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
      active: true,
      archived: false,
      placementAssignments: input.placementIds.map((pid) => ({ placementId: pid })),
      creativeRotation: {
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

  generateTags(campaignId: string, placementIds: string[]): CM360PlacementTag[] {
    return placementIds.map((pid) => {
      const placement = this.placements.get(pid);
      return {
        placementId: pid,
        tagData: [{
          format: 'PLACEMENT_TAG_STANDARD',
          impressionTag: `<script src="https://ad.doubleclick.net/ddm/trackimp/N${ACCOUNT_ID}.DEMO/${pid};dc_trk_aid=${placement?.id ?? 'unknown'};dc_trk_cid=${campaignId};ord=[timestamp]"></script>`,
          clickTag: `https://ad.doubleclick.net/ddm/trackclk/N${ACCOUNT_ID}.DEMO/${pid};dc_trk_aid=${placement?.id ?? 'unknown'};dc_trk_cid=${campaignId}`,
        }],
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
    this.nextId = 90000;
    this.seed();
  }
}

export const mockStore = new MockDataStore();
