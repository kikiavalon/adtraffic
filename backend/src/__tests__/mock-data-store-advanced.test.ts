/**
 * Advanced mock-data-store tests — combined filters, pagination edge cases,
 * data naming conventions, created entity properties, and search edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockStore } from '../cm360/mock-data-store.js';

beforeEach(() => {
  mockStore.reset();
});

// ---------------------------------------------------------------------------
// Combined filter scenarios
// ---------------------------------------------------------------------------

describe('Combined filters', () => {
  it('filters placements by both campaignId and advertiserId', () => {
    const campaigns = mockStore.listCampaigns();
    const camp = campaigns[0]!;
    const placements = mockStore.listPlacements({
      campaignId: camp.id,
      advertiserId: camp.advertiserId,
    });
    expect(placements.length).toBeGreaterThan(0);
    for (const p of placements) {
      expect(p.campaignId).toBe(camp.id);
      expect(p.advertiserId).toBe(camp.advertiserId);
    }
  });

  it('filters campaigns by advertiserId and searchString', () => {
    const advertisers = mockStore.listAdvertisers();
    const advId = advertisers[0]!.id; // Apex Motors
    const campaigns = mockStore.listCampaigns({
      advertiserId: advId,
      searchString: 'Q1',
    });
    for (const c of campaigns) {
      expect(c.advertiserId).toBe(advId);
      expect(c.name.toLowerCase()).toContain('q1');
    }
  });

  it('filters placements by advertiserId and searchString', () => {
    const advertisers = mockStore.listAdvertisers();
    const advId = advertisers[0]!.id;
    const placements = mockStore.listPlacements({
      advertiserId: advId,
      searchString: '300x250',
    });
    for (const p of placements) {
      expect(p.advertiserId).toBe(advId);
      expect(p.name.toLowerCase()).toContain('300x250');
    }
  });

  it('filters ads by campaignId and advertiserId', () => {
    const campaigns = mockStore.listCampaigns();
    const camp = campaigns[0]!;
    const ads = mockStore.listAds({
      campaignId: camp.id,
      advertiserId: camp.advertiserId,
    });
    for (const ad of ads) {
      expect(ad.campaignId).toBe(camp.id);
      expect(ad.advertiserId).toBe(camp.advertiserId);
    }
  });

  it('returns empty when filters match nothing', () => {
    const placements = mockStore.listPlacements({
      campaignId: 'nonexistent-campaign',
    });
    expect(placements).toEqual([]);
  });

  it('returns empty when search matches nothing', () => {
    const advertisers = mockStore.listAdvertisers({ searchString: 'zzzzz_no_match' });
    expect(advertisers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// maxResults / pagination
// ---------------------------------------------------------------------------

describe('maxResults edge cases', () => {
  it('maxResults=1 returns exactly one result', () => {
    const advertisers = mockStore.listAdvertisers({ maxResults: 1 });
    expect(advertisers).toHaveLength(1);
  });

  it('maxResults=0 returns empty array', () => {
    const advertisers = mockStore.listAdvertisers({ maxResults: 0 });
    expect(advertisers).toHaveLength(0);
  });

  it('maxResults larger than total returns all items', () => {
    const advertisers = mockStore.listAdvertisers({ maxResults: 1000 });
    expect(advertisers).toHaveLength(7);
  });

  it('maxResults applies after filters', () => {
    const campaigns = mockStore.listCampaigns({ searchString: 'Q1', maxResults: 2 });
    expect(campaigns.length).toBeLessThanOrEqual(2);
    for (const c of campaigns) {
      expect(c.name.toLowerCase()).toContain('q1');
    }
  });

  it('default maxResults is 100 for all list methods', () => {
    // With 7 advertisers, all should be returned without explicit maxResults
    expect(mockStore.listAdvertisers().length).toBe(7);
    // Sites: 16
    expect(mockStore.listSites().length).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// Search case sensitivity
// ---------------------------------------------------------------------------

describe('Search is case-insensitive', () => {
  it('finds advertiser with uppercase search', () => {
    expect(mockStore.listAdvertisers({ searchString: 'APEX' })).toHaveLength(1);
  });

  it('finds advertiser with mixed case search', () => {
    expect(mockStore.listAdvertisers({ searchString: 'ApEx' })).toHaveLength(1);
  });

  it('finds site with lowercase search', () => {
    expect(mockStore.listSites({ searchString: 'espn' })).toHaveLength(1);
  });

  it('finds campaign with partial match', () => {
    const results = mockStore.listCampaigns({ searchString: 'Video' });
    for (const c of results) {
      expect(c.name.toLowerCase()).toContain('video');
    }
  });

  it('finds landing page by partial name', () => {
    const results = mockStore.listLandingPages({ searchString: 'Homepage' });
    expect(results.length).toBeGreaterThan(0);
    for (const lp of results) {
      expect(lp.name).toContain('Homepage');
    }
  });
});

// ---------------------------------------------------------------------------
// Created entity properties
// ---------------------------------------------------------------------------

describe('Created entity integrity', () => {
  it('created campaign gets unique sequential ID', () => {
    const advId = mockStore.listAdvertisers()[0]!.id;
    const lpId = mockStore.listLandingPages({ advertiserId: advId })[0]!.id;

    const c1 = mockStore.createCampaign({
      advertiserId: advId, name: 'Camp A', startDate: '2026-01-01', endDate: '2026-03-31', defaultLandingPageId: lpId,
    });
    const c2 = mockStore.createCampaign({
      advertiserId: advId, name: 'Camp B', startDate: '2026-04-01', endDate: '2026-06-30', defaultLandingPageId: lpId,
    });

    expect(c1.id).not.toBe(c2.id);
    expect(Number(c2.id)).toBeGreaterThan(Number(c1.id));
  });

  it('created campaign preserves all input fields', () => {
    const advId = mockStore.listAdvertisers()[0]!.id;
    const lpId = mockStore.listLandingPages({ advertiserId: advId })[0]!.id;

    const campaign = mockStore.createCampaign({
      advertiserId: advId,
      name: 'Exact Fields Test',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      defaultLandingPageId: lpId,
    });

    expect(campaign.name).toBe('Exact Fields Test');
    expect(campaign.advertiserId).toBe(advId);
    expect(campaign.startDate).toBe('2026-07-01');
    expect(campaign.endDate).toBe('2026-09-30');
    expect(campaign.defaultLandingPageId).toBe(lpId);
    expect(campaign.archived).toBe(false);
    expect(campaign.accountId).toBe('67890');
  });

  it('created placement gets DRAFT status', () => {
    const camp = mockStore.listCampaigns()[0]!;
    const siteId = mockStore.listSites()[0]!.id;

    const placement = mockStore.createPlacement({
      campaignId: camp.id, siteId, name: 'Draft Test', width: 300, height: 250,
      startDate: '2026-01-01', endDate: '2026-03-31',
    });
    expect(placement.status).toBe('DRAFT');
  });

  it('created placement resolves advertiserId from campaign', () => {
    const camp = mockStore.listCampaigns()[0]!;
    const siteId = mockStore.listSites()[0]!.id;

    const placement = mockStore.createPlacement({
      campaignId: camp.id, siteId, name: 'Adv Resolve Test', width: 728, height: 90,
      startDate: '2026-01-01', endDate: '2026-03-31',
    });
    expect(placement.advertiserId).toBe(camp.advertiserId);
  });

  it('created placement detects IAB standard sizes', () => {
    const camp = mockStore.listCampaigns()[0]!;
    const siteId = mockStore.listSites()[0]!.id;

    const iabPlacement = mockStore.createPlacement({
      campaignId: camp.id, siteId, name: 'IAB Test', width: 300, height: 250,
      startDate: '2026-01-01', endDate: '2026-03-31',
    });
    expect(iabPlacement.size.iab).toBe(true);

    const customPlacement = mockStore.createPlacement({
      campaignId: camp.id, siteId, name: 'Custom Test', width: 999, height: 111,
      startDate: '2026-01-01', endDate: '2026-03-31',
    });
    expect(customPlacement.size.iab).toBe(false);
  });

  it('created ad links multiple placements', () => {
    const camp = mockStore.listCampaigns()[0]!;
    const placements = mockStore.listPlacements({ campaignId: camp.id });
    const creative = mockStore.listCreatives({ advertiserId: camp.advertiserId })[0]!;

    const placementIds = placements.slice(0, 3).map((p) => p.id);
    const ad = mockStore.createAd({
      campaignId: camp.id, name: 'Multi-placement Ad',
      placementIds, creativeId: creative.id,
    });

    expect(ad.placementAssignments).toHaveLength(placementIds.length);
    expect(ad.placementAssignments.map((pa) => pa.placementId)).toEqual(placementIds);
    expect(ad.creativeRotation.creativeAssignments).toHaveLength(1);
    expect(ad.creativeRotation.creativeAssignments[0]!.creativeId).toBe(creative.id);
  });

  it('created landing page preserves URL', () => {
    const advId = mockStore.listAdvertisers()[0]!.id;
    const page = mockStore.createLandingPage({
      advertiserId: advId,
      name: 'Promo Page',
      url: 'https://www.example.com/promo?utm_source=cm360',
    });
    expect(page.url).toBe('https://www.example.com/promo?utm_source=cm360');
    expect(page.archived).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Seed data naming conventions
// ---------------------------------------------------------------------------

describe('Seed data naming conventions', () => {
  it('campaign names follow pattern: AdvName Quarter Channel Objective', () => {
    const campaigns = mockStore.listCampaigns();
    for (const c of campaigns) {
      // Should contain a quarter label like "Q1 2026"
      expect(c.name).toMatch(/Q[1-4] 2026/);
    }
  });

  it('creative names follow pattern: AdvName_WIDTHxHEIGHT_version or Audio/Tracking variant', () => {
    const creatives = mockStore.listCreatives();
    for (const cr of creatives) {
      // Display/video: WIDTHxHEIGHT_v1, Audio: Audio_30s_v1, Tracking: Tracking_1x1
      expect(cr.name).toMatch(/(\d+x\d+_v\d+|Audio_\d+s_v\d+|Tracking_1x1)/);
    }
  });

  it('all placements have a valid tag format', () => {
    const placements = mockStore.listPlacements({ maxResults: 500 });
    const validFormats = ['PLACEMENT_TAG_STANDARD', 'PLACEMENT_TAG_VAST_2_0', 'PLACEMENT_TAG_INSTREAM_VIDEO_PREFETCH_VAST_3', 'PLACEMENT_TAG_TRACKING'];
    for (const p of placements) {
      expect(p.tagFormats.length).toBeGreaterThanOrEqual(1);
      for (const fmt of p.tagFormats) {
        expect(validFormats).toContain(fmt);
      }
    }
  });

  it('all advertisers have APPROVED status', () => {
    const advertisers = mockStore.listAdvertisers();
    for (const a of advertisers) {
      expect(a.status).toBe('APPROVED');
    }
  });

  it('all sites are approved', () => {
    const sites = mockStore.listSites();
    for (const s of sites) {
      expect(s.approved).toBe(true);
    }
  });

  it('profile has correct account details', () => {
    const profiles = mockStore.listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]!.profileId).toBe('12345');
    expect(profiles[0]!.accountId).toBe('67890');
    expect(profiles[0]!.accountName).toBe('Demo Agency');
  });
});

// ---------------------------------------------------------------------------
// Tag generation
// ---------------------------------------------------------------------------

describe('Tag generation details', () => {
  it('generated tags contain account ID', () => {
    const camp = mockStore.listCampaigns()[0]!;
    const placements = mockStore.listPlacements({ campaignId: camp.id });
    const tags = mockStore.generateTags(camp.id, [placements[0]!.id]);

    expect(tags[0]!.tagData[0]!.impressionTag).toContain('67890');
    expect(tags[0]!.tagData[0]!.clickTag).toContain('67890');
  });

  it('generated tags contain campaign ID', () => {
    const camp = mockStore.listCampaigns()[0]!;
    const placements = mockStore.listPlacements({ campaignId: camp.id });
    const tags = mockStore.generateTags(camp.id, [placements[0]!.id]);

    expect(tags[0]!.tagData[0]!.impressionTag).toContain(camp.id);
  });

  it('generated tags contain placement ID', () => {
    const camp = mockStore.listCampaigns()[0]!;
    const placements = mockStore.listPlacements({ campaignId: camp.id });
    const pid = placements[0]!.id;
    const tags = mockStore.generateTags(camp.id, [pid]);

    expect(tags[0]!.tagData[0]!.impressionTag).toContain(pid);
    expect(tags[0]!.tagData[0]!.clickTag).toContain(pid);
  });

  it('handles unknown placement ID gracefully', () => {
    const camp = mockStore.listCampaigns()[0]!;
    const tags = mockStore.generateTags(camp.id, ['nonexistent-pid']);
    expect(tags).toHaveLength(1);
    expect(tags[0]!.placementId).toBe('nonexistent-pid');
    expect(tags[0]!.tagData[0]!.impressionTag).toContain('unknown');
  });

  it('generates tags for multiple placements', () => {
    const camp = mockStore.listCampaigns()[0]!;
    const placements = mockStore.listPlacements({ campaignId: camp.id });
    const ids = placements.map((p) => p.id);
    const tags = mockStore.generateTags(camp.id, ids);

    expect(tags).toHaveLength(ids.length);
    for (let i = 0; i < ids.length; i++) {
      expect(tags[i]!.placementId).toBe(ids[i]);
    }
  });

  it('uses PLACEMENT_TAG_STANDARD format', () => {
    const camp = mockStore.listCampaigns()[0]!;
    const placements = mockStore.listPlacements({ campaignId: camp.id });
    const tags = mockStore.generateTags(camp.id, [placements[0]!.id]);
    expect(tags[0]!.tagData[0]!.format).toBe('PLACEMENT_TAG_STANDARD');
  });
});

// ---------------------------------------------------------------------------
// Data consistency after creates
// ---------------------------------------------------------------------------

describe('Data consistency after mutations', () => {
  it('created items survive across multiple list calls', () => {
    const advId = mockStore.listAdvertisers()[0]!.id;
    const lpId = mockStore.listLandingPages({ advertiserId: advId })[0]!.id;

    const created = mockStore.createCampaign({
      advertiserId: advId, name: 'Persist Test', startDate: '2026-01-01', endDate: '2026-12-31', defaultLandingPageId: lpId,
    });

    // Call list multiple times
    const list1 = mockStore.listCampaigns();
    const list2 = mockStore.listCampaigns({ advertiserId: advId });

    expect(list1.find((c) => c.id === created.id)).toBeDefined();
    expect(list2.find((c) => c.id === created.id)).toBeDefined();
  });

  it('reset clears all created items', () => {
    const advId = mockStore.listAdvertisers()[0]!.id;
    const lpId = mockStore.listLandingPages({ advertiserId: advId })[0]!.id;

    mockStore.createCampaign({
      advertiserId: advId, name: 'Will Be Cleared', startDate: '2026-01-01', endDate: '2026-12-31', defaultLandingPageId: lpId,
    });
    const beforeReset = mockStore.listCampaigns().length;

    mockStore.reset();
    const afterReset = mockStore.listCampaigns().length;

    expect(afterReset).toBeLessThan(beforeReset);
    expect(mockStore.listCampaigns().find((c) => c.name === 'Will Be Cleared')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Ad click-through URLs
// ---------------------------------------------------------------------------

describe('ad click-through URLs', () => {
  // NOTE: tsconfig sets noUncheckedIndexedAccess — use the repo's `[0]!` pattern on index access.
  it('createAd stores a landingPageId click-through and computes the URL', () => {
    const advertiser = mockStore.listAdvertisers()[0]!;
    const lp = mockStore.listLandingPages({ advertiserId: advertiser.id })[0]!;
    const campaign = mockStore.listCampaigns({ advertiserId: advertiser.id })[0]!;
    const placement = mockStore.listPlacements({ campaignId: campaign.id })[0]!;
    const creative = mockStore.listCreatives({ advertiserId: advertiser.id })[0]!;
    const ad = mockStore.createAd({
      campaignId: campaign.id, name: 'CT test', placementIds: [placement.id],
      creativeId: creative.id, landingPageId: lp.id,
    });
    const assignment = ad.creativeRotation.creativeAssignments[0]!;
    expect(assignment.clickThroughUrl?.landingPageId).toBe(lp.id);
    expect(assignment.clickThroughUrl?.computedClickThroughUrl).toContain(lp.url.split('?')[0]!);
  });

  it('createAd without click-through falls back to campaign default landing page', () => {
    const campaign = mockStore.listCampaigns()[0]!;
    const placement = mockStore.listPlacements({ campaignId: campaign.id })[0]!;
    const creative = mockStore.listCreatives({ advertiserId: campaign.advertiserId })[0]!;
    const ad = mockStore.createAd({
      campaignId: campaign.id, name: 'CT default', placementIds: [placement.id], creativeId: creative.id,
    });
    const ct = ad.creativeRotation.creativeAssignments[0]!.clickThroughUrl;
    expect(ct?.defaultLandingPage).toBe(true);
    const defaultLp = mockStore.getLandingPage(campaign.defaultLandingPageId);
    expect(ct?.computedClickThroughUrl).toContain((defaultLp?.url ?? 'MISSING').split('?')[0]!);
  });

  it('updateAd can switch to a customClickThroughUrl', () => {
    // Pick an ad from a suffix-free advertiser (3+) so computedClickThroughUrl
    // equals the custom URL exactly (suffixes apply to custom URLs too).
    const suffixFreeAdvertiser = mockStore.listAdvertisers().find((a) => !a.clickThroughUrlSuffix)!;
    const ad = mockStore.listAds({ advertiserId: suffixFreeAdvertiser.id })[0]!;
    const updated = mockStore.updateAd(ad.id, { customClickThroughUrl: 'https://example.com/override' });
    const ct = updated?.creativeRotation.creativeAssignments[0]!.clickThroughUrl;
    expect(ct?.customClickThroughUrl).toBe('https://example.com/override');
    expect(ct?.computedClickThroughUrl).toBe('https://example.com/override');
    expect(ct?.landingPageId).toBeUndefined();
  });

  it('updateAd with only a creativeId change carries the existing clickThroughUrl forward', () => {
    const advertiser = mockStore.listAdvertisers()[0]!;
    const lp = mockStore.listLandingPages({ advertiserId: advertiser.id })[0]!;
    const campaign = mockStore.listCampaigns({ advertiserId: advertiser.id })[0]!;
    const placement = mockStore.listPlacements({ campaignId: campaign.id })[0]!;
    const creatives = mockStore.listCreatives({ advertiserId: advertiser.id });
    const ad = mockStore.createAd({
      campaignId: campaign.id, name: 'CT carry', placementIds: [placement.id],
      creativeId: creatives[0]!.id, landingPageId: lp.id,
    });
    const swapped = mockStore.updateAd(ad.id, { creativeId: creatives[1]?.id ?? creatives[0]!.id });
    const ct = swapped?.creativeRotation.creativeAssignments[0]!.clickThroughUrl;
    expect(ct?.landingPageId).toBe(lp.id);
  });

  it('appends the advertiser suffix AFTER the base URL query string', () => {
    // Seeded advertiser 0 has clickThroughUrlSuffix 'utm_content=suffix-%epid!' (Step 3.3) —
    // a token deliberately absent from every seeded landing-page URL, so this test can only
    // pass if suffix-appending actually ran (the base URLs already contain utm_source/medium).
    const advertiser = mockStore.listAdvertisers()[0]!;
    expect(advertiser.clickThroughUrlSuffix).toBe('utm_content=suffix-%epid!');
    const campaign = mockStore.listCampaigns({ advertiserId: advertiser.id })[0]!;
    const ads = mockStore.listAds({ campaignId: campaign.id });
    const computed = ads[0]?.creativeRotation.creativeAssignments[0]?.clickThroughUrl?.computedClickThroughUrl ?? '';
    const suffixPos = computed.indexOf('utm_content=suffix-%epid!');
    expect(suffixPos).toBeGreaterThan(computed.indexOf('?')); // appended after the existing query
    expect(computed[suffixPos - 1]).toBe('&'); // joined with &, not a second ?
  });
});
