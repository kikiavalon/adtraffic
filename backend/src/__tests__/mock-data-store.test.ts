import { describe, it, expect, beforeEach } from 'vitest';
import { mockStore } from '../cm360/mock-data-store.js';

describe('MockDataStore', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  describe('seed data', () => {
    it('generates 1 profile', () => {
      expect(mockStore.listProfiles()).toHaveLength(1);
      expect(mockStore.listProfiles()[0]!.accountName).toBe('Demo Agency');
    });

    it('generates 7 advertisers', () => {
      const advertisers = mockStore.listAdvertisers();
      expect(advertisers).toHaveLength(7);
      const names = advertisers.map((a) => a.name);
      expect(names).toContain('Apex Motors');
      expect(names).toContain('Luminance Beauty');
      expect(names).toContain('Harvest Organics');
    });

    it('generates 16 sites', () => {
      const sites = mockStore.listSites();
      expect(sites).toHaveLength(16);
      const names = sites.map((s) => s.name);
      expect(names).toContain('ESPN.com');
      expect(names).toContain('Bloomberg.com');
    });

    it('generates landing pages (2-4 per advertiser)', () => {
      const pages = mockStore.listLandingPages();
      expect(pages.length).toBeGreaterThanOrEqual(14); // 7 * 2 min
      expect(pages.length).toBeLessThanOrEqual(28); // 7 * 4 max
    });

    it('generates campaigns (3-4 per advertiser)', () => {
      const campaigns = mockStore.listCampaigns();
      expect(campaigns.length).toBeGreaterThanOrEqual(21); // 7 * 3 min
      expect(campaigns.length).toBeLessThanOrEqual(28); // 7 * 4 max
    });

    it('generates creatives (2 display per advertiser + 8 video + 5 audio + 4 tracking)', () => {
      const creatives = mockStore.listCreatives();
      expect(creatives).toHaveLength(31); // 7*2 display + 8 video + 5 audio + 4 tracking
    });

    it('generates placements across campaigns', () => {
      const placements = mockStore.listPlacements();
      expect(placements.length).toBeGreaterThanOrEqual(40);
    });

    it('generates ads across campaigns', () => {
      const ads = mockStore.listAds();
      expect(ads.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe('referential integrity', () => {
    it('campaigns reference valid advertisers', () => {
      const campaigns = mockStore.listCampaigns();
      for (const camp of campaigns) {
        const adv = mockStore.getAdvertiser(camp.advertiserId);
        expect(adv).toBeDefined();
      }
    });

    it('landing pages reference valid advertisers', () => {
      const pages = mockStore.listLandingPages();
      for (const page of pages) {
        const adv = mockStore.getAdvertiser(page.advertiserId);
        expect(adv).toBeDefined();
      }
    });

    it('placements reference valid campaigns', () => {
      const placements = mockStore.listPlacements();
      const campaignIds = new Set(mockStore.listCampaigns().map((c) => c.id));
      for (const pl of placements) {
        expect(campaignIds.has(pl.campaignId)).toBe(true);
      }
    });

    it('ads reference valid campaigns and advertisers', () => {
      const ads = mockStore.listAds();
      const campaignIds = new Set(mockStore.listCampaigns().map((c) => c.id));
      for (const ad of ads) {
        expect(campaignIds.has(ad.campaignId)).toBe(true);
        expect(mockStore.getAdvertiser(ad.advertiserId)).toBeDefined();
      }
    });
  });

  describe('filtering', () => {
    it('filters advertisers by searchString', () => {
      const results = mockStore.listAdvertisers({ searchString: 'apex' });
      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe('Apex Motors');
    });

    it('filters campaigns by advertiserId', () => {
      const advertisers = mockStore.listAdvertisers();
      const advId = advertisers[0]!.id;
      const campaigns = mockStore.listCampaigns({ advertiserId: advId });
      expect(campaigns.length).toBeGreaterThanOrEqual(3);
      for (const c of campaigns) {
        expect(c.advertiserId).toBe(advId);
      }
    });

    it('filters placements by campaignId', () => {
      const campaigns = mockStore.listCampaigns();
      const campId = campaigns[0]!.id;
      const placements = mockStore.listPlacements({ campaignId: campId });
      expect(placements.length).toBeGreaterThan(0);
      for (const p of placements) {
        expect(p.campaignId).toBe(campId);
      }
    });

    it('filters landing pages by advertiserId', () => {
      const advertisers = mockStore.listAdvertisers();
      const advId = advertisers[0]!.id;
      const pages = mockStore.listLandingPages({ advertiserId: advId });
      expect(pages.length).toBeGreaterThanOrEqual(2);
      for (const p of pages) {
        expect(p.advertiserId).toBe(advId);
      }
    });

    it('filters sites by searchString', () => {
      const results = mockStore.listSites({ searchString: 'espn' });
      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe('ESPN.com');
    });

    it('filters creatives by advertiserId', () => {
      const advertisers = mockStore.listAdvertisers();
      const advId = advertisers[0]!.id;
      const creatives = mockStore.listCreatives({ advertiserId: advId });
      expect(creatives).toHaveLength(7); // 2 display + 3 video + 1 audio + 1 tracking for Apex Motors
      for (const c of creatives) {
        expect(c.advertiserId).toBe(advId);
      }
    });

    it('filters ads by campaignId', () => {
      const campaigns = mockStore.listCampaigns();
      const campId = campaigns[0]!.id;
      const ads = mockStore.listAds({ campaignId: campId });
      expect(ads.length).toBeGreaterThan(0);
      for (const ad of ads) {
        expect(ad.campaignId).toBe(campId);
      }
    });

    it('respects maxResults', () => {
      const all = mockStore.listAdvertisers();
      const limited = mockStore.listAdvertisers({ maxResults: 3 });
      expect(all.length).toBe(7);
      expect(limited.length).toBe(3);
    });
  });

  describe('CRUD operations', () => {
    it('createCampaign persists and appears in list', () => {
      const advertisers = mockStore.listAdvertisers();
      const advId = advertisers[0]!.id;
      const pages = mockStore.listLandingPages({ advertiserId: advId });
      const lpId = pages[0]!.id;

      const before = mockStore.listCampaigns({ advertiserId: advId });
      const created = mockStore.createCampaign({
        advertiserId: advId,
        name: 'Test New Campaign',
        startDate: '2026-06-01',
        endDate: '2026-08-31',
        defaultLandingPageId: lpId,
      });
      const after = mockStore.listCampaigns({ advertiserId: advId });

      expect(created.name).toBe('Test New Campaign');
      expect(created.id).toBeDefined();
      expect(after.length).toBe(before.length + 1);
      expect(after.find((c) => c.id === created.id)).toBeDefined();
    });

    it('createPlacement persists and appears in list', () => {
      const campaigns = mockStore.listCampaigns();
      const camp = campaigns[0]!;
      const sites = mockStore.listSites();
      const siteId = sites[0]!.id;

      const before = mockStore.listPlacements({ campaignId: camp.id });
      const created = mockStore.createPlacement({
        campaignId: camp.id,
        siteId,
        name: 'Test_Placement_300x250',
        width: 300,
        height: 250,
        startDate: camp.startDate,
        endDate: camp.endDate,
      });
      const after = mockStore.listPlacements({ campaignId: camp.id });

      expect(created.name).toBe('Test_Placement_300x250');
      expect(created.status).toBe('DRAFT');
      expect(after.length).toBe(before.length + 1);
    });

    it('createLandingPage persists and appears in list', () => {
      const advertisers = mockStore.listAdvertisers();
      const advId = advertisers[0]!.id;

      const before = mockStore.listLandingPages({ advertiserId: advId });
      const created = mockStore.createLandingPage({
        advertiserId: advId,
        name: 'Test Landing Page',
        url: 'https://www.test.com/landing',
      });
      const after = mockStore.listLandingPages({ advertiserId: advId });

      expect(created.name).toBe('Test Landing Page');
      expect(after.length).toBe(before.length + 1);
    });

    it('createAd persists and appears in list', () => {
      const campaigns = mockStore.listCampaigns();
      const camp = campaigns[0]!;
      const placements = mockStore.listPlacements({ campaignId: camp.id });
      const creatives = mockStore.listCreatives({ advertiserId: camp.advertiserId });

      const before = mockStore.listAds({ campaignId: camp.id });
      const created = mockStore.createAd({
        campaignId: camp.id,
        name: 'Test Ad',
        placementIds: [placements[0]!.id],
        creativeId: creatives[0]!.id,
      });
      const after = mockStore.listAds({ campaignId: camp.id });

      expect(created.name).toBe('Test Ad');
      expect(created.active).toBe(true);
      expect(after.length).toBe(before.length + 1);
    });
  });

  describe('tag generation', () => {
    it('generates tags for valid placement IDs', () => {
      const campaigns = mockStore.listCampaigns();
      const camp = campaigns[0]!;
      const placements = mockStore.listPlacements({ campaignId: camp.id });
      const placementIds = placements.slice(0, 2).map((p) => p.id);

      const tags = mockStore.generateTags(camp.id, placementIds);
      expect(tags).toHaveLength(2);
      expect(tags[0]!.placementId).toBe(placementIds[0]);
      expect(tags[0]!.tagData[0]!.impressionTag).toContain('doubleclick.net');
      expect(tags[0]!.tagData[0]!.clickTag).toContain('doubleclick.net');
    });
  });

  describe('reset', () => {
    it('returns to initial state after modifications', () => {
      const beforeCount = mockStore.listCampaigns().length;

      // Create some items
      const advertisers = mockStore.listAdvertisers();
      const advId = advertisers[0]!.id;
      const pages = mockStore.listLandingPages({ advertiserId: advId });
      mockStore.createCampaign({
        advertiserId: advId,
        name: 'Extra Campaign',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        defaultLandingPageId: pages[0]!.id,
      });
      expect(mockStore.listCampaigns().length).toBe(beforeCount + 1);

      // Reset
      mockStore.reset();
      expect(mockStore.listCampaigns().length).toBe(beforeCount);
    });

    it('produces deterministic data after reset', () => {
      const names1 = mockStore.listAdvertisers().map((a) => a.name);
      mockStore.reset();
      const names2 = mockStore.listAdvertisers().map((a) => a.name);
      expect(names1).toEqual(names2);
    });
  });
});
