/**
 * Advanced tool executor tests — error handling, create operations with full
 * round-trip verification, and edge cases for all 22 tools.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';

beforeEach(() => {
  mockStore.reset();
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('Error handling', () => {
  it('returns error for completely unknown tool', async () => {
    const result = await executeTool('nonexistent_tool', {});
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('Unknown tool');
    expect(result.result).toBeNull();
  });

  it('returns error for cm360-prefixed unknown tool', async () => {
    const result = await executeTool('cm360_delete_everything', {});
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('Unknown tool');
  });

  it('returns error for get_advertiser with nonexistent ID', async () => {
    const result = await executeTool('cm360_get_advertiser', {
      profileId: '12345',
      advertiserId: '99999',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
    expect(result.errorMessage).toContain('99999');
  });
});

// ---------------------------------------------------------------------------
// Create + verify round trips
// ---------------------------------------------------------------------------

describe('Create placement round trip', () => {
  it('creates placement and verifies all properties', async () => {
    const campaigns = mockStore.listCampaigns();
    const camp = campaigns[0]!;
    const sites = mockStore.listSites();
    const siteId = sites[0]!.id;

    const createResult = await executeTool('cm360_create_placement', {
      profileId: '12345',
      campaignId: camp.id,
      siteId,
      name: 'RoundTrip_ESPN_300x250',
      width: 300,
      height: 250,
      startDate: '2026-04-01',
      endDate: '2026-06-30',
      paymentSource: 'PLACEMENT_AGENCY_PAID',
      compatibility: 'DISPLAY',
    });

    expect(createResult.isError).toBe(false);
    const placement = createResult.result as {
      id: string; name: string; size: { width: number; height: number; iab: boolean };
      status: string; campaignId: string; siteId: string;
    };

    expect(placement.name).toBe('RoundTrip_ESPN_300x250');
    expect(placement.size.width).toBe(300);
    expect(placement.size.height).toBe(250);
    expect(placement.size.iab).toBe(true);
    expect(placement.status).toBe('DRAFT');
    expect(placement.campaignId).toBe(camp.id);
    expect(placement.siteId).toBe(siteId);

    // Verify it appears in list
    const listResult = await executeTool('cm360_list_placements', {
      profileId: '12345',
      campaignId: camp.id,
    });
    const placements = (listResult.result as { placements: Array<{ id: string }> }).placements;
    expect(placements.find((p) => p.id === placement.id)).toBeDefined();
  });
});

describe('Create ad round trip', () => {
  it('creates ad with multiple placements and verifies structure', async () => {
    const campaigns = mockStore.listCampaigns();
    const camp = campaigns[0]!;
    const placements = mockStore.listPlacements({ campaignId: camp.id });
    const creatives = mockStore.listCreatives({ advertiserId: camp.advertiserId });
    const placementIds = placements.slice(0, 2).map((p) => p.id);

    const createResult = await executeTool('cm360_create_ad', {
      profileId: '12345',
      campaignId: camp.id,
      name: 'RoundTrip_Test_Ad',
      placementIds,
      creativeId: creatives[0]!.id,
    });

    expect(createResult.isError).toBe(false);
    const ad = createResult.result as {
      id: string; name: string; active: boolean;
      placementAssignments: Array<{ placementId: string }>;
      creativeRotation: { creativeAssignments: Array<{ creativeId: string }> };
    };

    expect(ad.name).toBe('RoundTrip_Test_Ad');
    expect(ad.active).toBe(true);
    expect(ad.placementAssignments).toHaveLength(2);
    expect(ad.creativeRotation.creativeAssignments[0]!.creativeId).toBe(creatives[0]!.id);

    // Verify persistence
    const listResult = await executeTool('cm360_list_ads', {
      profileId: '12345',
      campaignId: camp.id,
    });
    const ads = (listResult.result as { ads: Array<{ id: string }> }).ads;
    expect(ads.find((a) => a.id === ad.id)).toBeDefined();
  });
});

describe('Create campaign round trip', () => {
  it('creates campaign and verifies all fields preserved', async () => {
    const advId = mockStore.listAdvertisers()[0]!.id;
    const lpId = mockStore.listLandingPages({ advertiserId: advId })[0]!.id;

    const createResult = await executeTool('cm360_create_campaign', {
      profileId: '12345',
      advertiserId: advId,
      name: 'Q3 2026 Display Awareness',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      defaultLandingPageId: lpId,
    });

    expect(createResult.isError).toBe(false);
    const campaign = createResult.result as {
      id: string; name: string; advertiserId: string;
      startDate: string; endDate: string; defaultLandingPageId: string;
    };

    expect(campaign.name).toBe('Q3 2026 Display Awareness');
    expect(campaign.advertiserId).toBe(advId);
    expect(campaign.startDate).toBe('2026-07-01');
    expect(campaign.endDate).toBe('2026-09-30');
    expect(campaign.defaultLandingPageId).toBe(lpId);
  });
});

describe('Create landing page round trip', () => {
  it('creates landing page and verifies it in list', async () => {
    const advId = mockStore.listAdvertisers()[0]!.id;
    const beforeCount = mockStore.listLandingPages({ advertiserId: advId }).length;

    const createResult = await executeTool('cm360_create_landing_page', {
      profileId: '12345',
      advertiserId: advId,
      name: 'Spring Sale Landing',
      url: 'https://www.example.com/spring-sale',
    });

    expect(createResult.isError).toBe(false);
    const page = createResult.result as { id: string; name: string; url: string };
    expect(page.name).toBe('Spring Sale Landing');
    expect(page.url).toBe('https://www.example.com/spring-sale');

    // Verify count increased
    const afterCount = mockStore.listLandingPages({ advertiserId: advId }).length;
    expect(afterCount).toBe(beforeCount + 1);
  });
});

// ---------------------------------------------------------------------------
// Tag generation via executor
// ---------------------------------------------------------------------------

describe('Tag generation via executor', () => {
  it('generates tags with valid structure', async () => {
    const camp = mockStore.listCampaigns()[0]!;
    const placements = mockStore.listPlacements({ campaignId: camp.id });

    const result = await executeTool('cm360_generate_tags', {
      profileId: '12345',
      campaignId: camp.id,
      placementIds: [placements[0]!.id],
    });

    expect(result.isError).toBe(false);
    const data = result.result as {
      placementTags: Array<{
        placementId: string;
        tagData: Array<{ format: string; impressionTag: string; clickTag: string }>;
      }>;
    };

    expect(data.placementTags).toHaveLength(1);
    expect(data.placementTags[0]!.tagData[0]!.format).toBe('PLACEMENT_TAG_STANDARD');
    expect(data.placementTags[0]!.tagData[0]!.impressionTag).toContain('<script');
    expect(data.placementTags[0]!.tagData[0]!.clickTag).toContain('https://');
  });

  it('generates tags for multiple placements', async () => {
    const camp = mockStore.listCampaigns()[0]!;
    const placements = mockStore.listPlacements({ campaignId: camp.id });
    const ids = placements.slice(0, 3).map((p) => p.id);

    const result = await executeTool('cm360_generate_tags', {
      profileId: '12345',
      campaignId: camp.id,
      placementIds: ids,
    });

    const data = result.result as { placementTags: Array<{ placementId: string }> };
    expect(data.placementTags).toHaveLength(ids.length);
  });
});

// ---------------------------------------------------------------------------
// List operations with search
// ---------------------------------------------------------------------------

describe('Search across all list tools', () => {
  it('cm360_list_advertisers search is case-insensitive', async () => {
    const result = await executeTool('cm360_list_advertisers', {
      profileId: '12345',
      searchString: 'LUMINANCE',
    });
    const data = result.result as { advertisers: Array<{ name: string }> };
    expect(data.advertisers).toHaveLength(1);
    expect(data.advertisers[0]!.name).toBe('Luminance Beauty');
  });

  it('cm360_list_campaigns search is partial match', async () => {
    const result = await executeTool('cm360_list_campaigns', {
      profileId: '12345',
      searchString: 'Display',
    });
    const data = result.result as { campaigns: Array<{ name: string }> };
    expect(data.campaigns.length).toBeGreaterThan(0);
    for (const c of data.campaigns) {
      expect(c.name.toLowerCase()).toContain('display');
    }
  });

  it('cm360_list_sites search finds partial site name', async () => {
    const result = await executeTool('cm360_list_sites', {
      profileId: '12345',
      searchString: 'tech',
    });
    const data = result.result as { sites: Array<{ name: string }> };
    // Should find TechCrunch.com
    expect(data.sites.length).toBeGreaterThan(0);
    for (const s of data.sites) {
      expect(s.name.toLowerCase()).toContain('tech');
    }
  });

  it('cm360_list_placements search filters by name', async () => {
    const result = await executeTool('cm360_list_placements', {
      profileId: '12345',
      searchString: 'ESPN',
    });
    const data = result.result as { placements: Array<{ name: string }> };
    for (const p of data.placements) {
      expect(p.name.toLowerCase()).toContain('espn');
    }
  });

  it('cm360_list_creatives search filters by name', async () => {
    const result = await executeTool('cm360_list_creatives', {
      profileId: '12345',
      advertiserId: mockStore.listAdvertisers()[0]!.id,
      searchString: '300x250',
    });
    const data = result.result as { creatives: Array<{ name: string }> };
    for (const c of data.creatives) {
      expect(c.name).toContain('300x250');
    }
  });

  it('cm360_list_ads search filters by name', async () => {
    const result = await executeTool('cm360_list_ads', {
      profileId: '12345',
      searchString: 'Ad_',
    });
    const data = result.result as { ads: Array<{ name: string }> };
    for (const a of data.ads) {
      expect(a.name).toContain('Ad_');
    }
  });
});
