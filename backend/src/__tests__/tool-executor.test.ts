import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';

describe('tool-executor', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  describe('cm360_list_profiles', () => {
    it('returns profiles', async () => {
      const result = await executeTool('cm360_list_profiles', {});
      expect(result.isError).toBe(false);
      expect(result.result).toHaveProperty('profiles');
      const profiles = (result.result as { profiles: unknown[] }).profiles;
      expect(profiles.length).toBeGreaterThan(0);
    });
  });

  describe('cm360_list_advertisers', () => {
    it('returns all advertisers without filter', async () => {
      const result = await executeTool('cm360_list_advertisers', { profileId: '12345' });
      expect(result.isError).toBe(false);
      const data = result.result as { advertisers: unknown[] };
      expect(data.advertisers.length).toBe(7);
    });

    it('filters advertisers by search string', async () => {
      const result = await executeTool('cm360_list_advertisers', {
        profileId: '12345',
        searchString: 'apex',
      });
      expect(result.isError).toBe(false);
      const data = result.result as { advertisers: Array<{ name: string }> };
      expect(data.advertisers.length).toBe(1);
      expect(data.advertisers[0]!.name).toBe('Apex Motors');
    });
  });

  describe('cm360_get_advertiser', () => {
    it('returns advertiser by ID', async () => {
      const advertisers = mockStore.listAdvertisers();
      const advId = advertisers[0]!.id;
      const result = await executeTool('cm360_get_advertiser', {
        profileId: '12345',
        advertiserId: advId,
      });
      expect(result.isError).toBe(false);
      expect(result.result).toHaveProperty('name', 'Apex Motors');
    });

    it('returns error for unknown advertiser', async () => {
      const result = await executeTool('cm360_get_advertiser', {
        profileId: '12345',
        advertiserId: '999',
      });
      expect(result.isError).toBe(true);
      expect(result.errorMessage).toContain('not found');
    });
  });

  describe('cm360_list_campaigns', () => {
    it('returns campaigns filtered by advertiser', async () => {
      const advertisers = mockStore.listAdvertisers();
      const advId = advertisers[0]!.id;
      const result = await executeTool('cm360_list_campaigns', {
        profileId: '12345',
        advertiserId: advId,
      });
      expect(result.isError).toBe(false);
      const data = result.result as { campaigns: unknown[] };
      expect(data.campaigns.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('cm360_create_campaign', () => {
    it('creates campaign and persists it', async () => {
      const advertisers = mockStore.listAdvertisers();
      const advId = advertisers[0]!.id;
      const pages = mockStore.listLandingPages({ advertiserId: advId });
      const lpId = pages[0]!.id;

      const result = await executeTool('cm360_create_campaign', {
        profileId: '12345',
        advertiserId: advId,
        name: 'Test Campaign',
        startDate: '2026-03-01',
        endDate: '2026-06-30',
        defaultLandingPageId: lpId,
      });
      expect(result.isError).toBe(false);
      const campaign = result.result as { name: string; id: string };
      expect(campaign.name).toBe('Test Campaign');

      // Verify it persists
      const listResult = await executeTool('cm360_list_campaigns', {
        profileId: '12345',
        advertiserId: advId,
      });
      const data = listResult.result as { campaigns: Array<{ id: string }> };
      expect(data.campaigns.find((c) => c.id === campaign.id)).toBeDefined();
    });
  });

  describe('cm360_list_sites', () => {
    it('returns sites filtered by search', async () => {
      const result = await executeTool('cm360_list_sites', {
        profileId: '12345',
        searchString: 'espn',
      });
      expect(result.isError).toBe(false);
      const data = result.result as { sites: Array<{ name: string }> };
      expect(data.sites.length).toBe(1);
      expect(data.sites[0]!.name).toBe('ESPN.com');
    });
  });

  describe('cm360_list_landing_pages', () => {
    it('returns landing pages for an advertiser', async () => {
      const advertisers = mockStore.listAdvertisers();
      const advId = advertisers[0]!.id;
      const result = await executeTool('cm360_list_landing_pages', {
        profileId: '12345',
        advertiserId: advId,
      });
      expect(result.isError).toBe(false);
      const data = result.result as { landingPages: unknown[] };
      expect(data.landingPages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('cm360_create_landing_page', () => {
    it('creates landing page and persists it', async () => {
      const advertisers = mockStore.listAdvertisers();
      const advId = advertisers[0]!.id;

      const result = await executeTool('cm360_create_landing_page', {
        profileId: '12345',
        advertiserId: advId,
        name: 'Test Landing Page',
        url: 'https://www.test.com/landing',
      });
      expect(result.isError).toBe(false);
      const page = result.result as { name: string; id: string };
      expect(page.name).toBe('Test Landing Page');

      // Verify it persists
      const listResult = await executeTool('cm360_list_landing_pages', {
        profileId: '12345',
        advertiserId: advId,
      });
      const data = listResult.result as { landingPages: Array<{ id: string }> };
      expect(data.landingPages.find((lp) => lp.id === page.id)).toBeDefined();
    });
  });

  describe('cm360_list_creatives', () => {
    it('returns creatives for an advertiser', async () => {
      const advertisers = mockStore.listAdvertisers();
      const advId = advertisers[0]!.id;
      const result = await executeTool('cm360_list_creatives', {
        profileId: '12345',
        advertiserId: advId,
      });
      expect(result.isError).toBe(false);
      const data = result.result as { creatives: unknown[] };
      expect(data.creatives).toHaveLength(7); // 2 display + 3 video + 1 audio + 1 tracking for Apex Motors
    });
  });

  describe('cm360_list_ads', () => {
    it('returns ads for a campaign', async () => {
      const campaigns = mockStore.listCampaigns();
      const campId = campaigns[0]!.id;
      const result = await executeTool('cm360_list_ads', {
        profileId: '12345',
        campaignId: campId,
      });
      expect(result.isError).toBe(false);
      const data = result.result as { ads: unknown[] };
      expect(data.ads.length).toBeGreaterThan(0);
    });
  });

  describe('cm360_create_ad', () => {
    it('creates ad and persists it', async () => {
      const campaigns = mockStore.listCampaigns();
      const camp = campaigns[0]!;
      const placements = mockStore.listPlacements({ campaignId: camp.id });
      const creatives = mockStore.listCreatives({ advertiserId: camp.advertiserId });

      const result = await executeTool('cm360_create_ad', {
        profileId: '12345',
        campaignId: camp.id,
        name: 'Test Ad',
        placementIds: [placements[0]!.id],
        creativeId: creatives[0]!.id,
      });
      expect(result.isError).toBe(false);
      const ad = result.result as { name: string; id: string };
      expect(ad.name).toBe('Test Ad');

      // Verify it persists
      const listResult = await executeTool('cm360_list_ads', {
        profileId: '12345',
        campaignId: camp.id,
      });
      const data = listResult.result as { ads: Array<{ id: string }> };
      expect(data.ads.find((a) => a.id === ad.id)).toBeDefined();
    });
  });

  describe('cm360_generate_tags', () => {
    it('returns tags for placement IDs', async () => {
      const campaigns = mockStore.listCampaigns();
      const campId = campaigns[0]!.id;
      const placements = mockStore.listPlacements({ campaignId: campId });
      const placementIds = placements.slice(0, 2).map((p) => p.id);

      const result = await executeTool('cm360_generate_tags', {
        profileId: '12345',
        campaignId: campId,
        placementIds,
      });
      expect(result.isError).toBe(false);
      const data = result.result as { placementTags: Array<{ placementId: string }> };
      expect(data.placementTags.length).toBe(2);
      expect(data.placementTags[0]!.placementId).toBe(placementIds[0]);
    });
  });

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const result = await executeTool('cm360_nonexistent', {});
      expect(result.isError).toBe(true);
      expect(result.errorMessage).toContain('Unknown tool');
    });
  });
});
