/**
 * Tests for the 8 new get/update tools:
 * - 3 get tools: cm360_get_campaign, cm360_get_placement, cm360_get_ad
 * - 5 update tools: cm360_update_campaign, cm360_update_placement,
 *   cm360_update_ad, cm360_update_creative, cm360_update_landing_page
 *
 * Tests cover:
 * - Tool executor mock path (executeTool)
 * - Zod input validation (schema rejection of bad inputs)
 * - Happy path get/update round trips
 * - Not-found error handling
 * - Partial update semantics (only specified fields change)
 * - Immutable field enforcement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';
import { CreateAdInputSchema, UpdateAdInputSchema } from '../cm360/tool-input-schemas.js';
import type { CM360Ad } from '@adtraffic/shared';

const PROFILE_ID = '12345';

beforeEach(() => {
  mockStore.reset();
});

// ---------------------------------------------------------------------------
// Get tools
// ---------------------------------------------------------------------------

describe('cm360_get_campaign', () => {
  it('returns campaign by ID', async () => {
    const campaigns = mockStore.listCampaigns();
    const first = campaigns[0]!;
    const result = await executeTool('cm360_get_campaign', {
      profileId: PROFILE_ID,
      campaignId: first.id,
    });
    expect(result.isError).toBe(false);
    expect(result.result).toMatchObject({ id: first.id, name: first.name });
  });

  it('returns error for nonexistent campaign', async () => {
    const result = await executeTool('cm360_get_campaign', {
      profileId: PROFILE_ID,
      campaignId: 'nonexistent-id',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });

  it('rejects missing profileId', async () => {
    const result = await executeTool('cm360_get_campaign', {
      campaignId: '123',
    });
    expect(result.isError).toBe(true);
    const details = (result.result as Record<string, string>)?.details ?? '';
    expect(details).toContain('profileId');
  });

  it('rejects missing campaignId', async () => {
    const result = await executeTool('cm360_get_campaign', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(true);
    const details = (result.result as Record<string, string>)?.details ?? '';
    expect(details).toContain('campaignId');
  });
});

describe('cm360_get_placement', () => {
  it('returns placement by ID', async () => {
    const placements = mockStore.listPlacements();
    const first = placements[0]!;
    const result = await executeTool('cm360_get_placement', {
      profileId: PROFILE_ID,
      placementId: first.id,
    });
    expect(result.isError).toBe(false);
    expect(result.result).toMatchObject({ id: first.id, name: first.name });
  });

  it('returns error for nonexistent placement', async () => {
    const result = await executeTool('cm360_get_placement', {
      profileId: PROFILE_ID,
      placementId: 'nonexistent-id',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });

  it('includes activeStatus field', async () => {
    const placements = mockStore.listPlacements();
    const first = placements[0]!;
    const result = await executeTool('cm360_get_placement', {
      profileId: PROFILE_ID,
      placementId: first.id,
    });
    expect(result.isError).toBe(false);
    const placement = result.result as Record<string, unknown>;
    expect(placement).toHaveProperty('activeStatus');
    expect(placement.activeStatus).toBe('ACTIVE');
  });
});

describe('cm360_get_ad', () => {
  it('returns ad by ID', async () => {
    const ads = mockStore.listAds();
    const first = ads[0]!;
    const result = await executeTool('cm360_get_ad', {
      profileId: PROFILE_ID,
      adId: first.id,
    });
    expect(result.isError).toBe(false);
    expect(result.result).toMatchObject({ id: first.id, name: first.name });
  });

  it('returns error for nonexistent ad', async () => {
    const result = await executeTool('cm360_get_ad', {
      profileId: PROFILE_ID,
      adId: 'nonexistent-id',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });

  it('includes archived field', async () => {
    const ads = mockStore.listAds();
    const first = ads[0]!;
    const result = await executeTool('cm360_get_ad', {
      profileId: PROFILE_ID,
      adId: first.id,
    });
    expect(result.isError).toBe(false);
    const ad = result.result as Record<string, unknown>;
    expect(ad).toHaveProperty('archived');
    expect(ad.archived).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Update tools — campaign
// ---------------------------------------------------------------------------

describe('cm360_update_campaign', () => {
  it('updates campaign name only', async () => {
    const campaigns = mockStore.listCampaigns();
    const target = campaigns[0]!;
    const result = await executeTool('cm360_update_campaign', {
      profileId: PROFILE_ID,
      campaignId: target.id,
      name: 'Renamed Campaign',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.name).toBe('Renamed Campaign');
    // Other fields unchanged
    expect(updated.startDate).toBe(target.startDate);
    expect(updated.endDate).toBe(target.endDate);
  });

  it('updates campaign dates', async () => {
    const campaigns = mockStore.listCampaigns();
    const target = campaigns[0]!;
    const result = await executeTool('cm360_update_campaign', {
      profileId: PROFILE_ID,
      campaignId: target.id,
      startDate: '2026-06-01',
      endDate: '2026-12-31',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.startDate).toBe('2026-06-01');
    expect(updated.endDate).toBe('2026-12-31');
    expect(updated.name).toBe(target.name);
  });

  it('archives a campaign', async () => {
    const campaigns = mockStore.listCampaigns();
    const target = campaigns[0]!;
    const result = await executeTool('cm360_update_campaign', {
      profileId: PROFILE_ID,
      campaignId: target.id,
      archived: true,
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.archived).toBe(true);
  });

  it('returns error for nonexistent campaign', async () => {
    const result = await executeTool('cm360_update_campaign', {
      profileId: PROFILE_ID,
      campaignId: 'nonexistent-id',
      name: 'Will Fail',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });

  it('rejects endDate before startDate', async () => {
    const campaigns = mockStore.listCampaigns();
    const target = campaigns[0]!;
    const result = await executeTool('cm360_update_campaign', {
      profileId: PROFILE_ID,
      campaignId: target.id,
      startDate: '2026-12-01',
      endDate: '2026-01-01',
    });
    expect(result.isError).toBe(true);
    const details = (result.result as Record<string, string>)?.details ?? '';
    expect(details).toContain('End date');
  });

  it('persists update in store — get after update reflects change', async () => {
    const campaigns = mockStore.listCampaigns();
    const target = campaigns[0]!;
    await executeTool('cm360_update_campaign', {
      profileId: PROFILE_ID,
      campaignId: target.id,
      name: 'Persisted Name',
    });
    const getResult = await executeTool('cm360_get_campaign', {
      profileId: PROFILE_ID,
      campaignId: target.id,
    });
    expect(getResult.isError).toBe(false);
    const fetched = getResult.result as Record<string, unknown>;
    expect(fetched.name).toBe('Persisted Name');
  });
});

// ---------------------------------------------------------------------------
// Update tools — placement
// ---------------------------------------------------------------------------

describe('cm360_update_placement', () => {
  it('updates placement name only', async () => {
    const placements = mockStore.listPlacements();
    const target = placements[0]!;
    const result = await executeTool('cm360_update_placement', {
      profileId: PROFILE_ID,
      placementId: target.id,
      name: 'Renamed Placement',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.name).toBe('Renamed Placement');
  });

  it('updates activeStatus to INACTIVE', async () => {
    const placements = mockStore.listPlacements();
    const target = placements[0]!;
    const result = await executeTool('cm360_update_placement', {
      profileId: PROFILE_ID,
      placementId: target.id,
      activeStatus: 'INACTIVE',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.activeStatus).toBe('INACTIVE');
  });

  it('rejects invalid activeStatus value', async () => {
    const placements = mockStore.listPlacements();
    const target = placements[0]!;
    const result = await executeTool('cm360_update_placement', {
      profileId: PROFILE_ID,
      placementId: target.id,
      activeStatus: 'INVALID_STATUS',
    });
    expect(result.isError).toBe(true);
  });

  it('returns error for nonexistent placement', async () => {
    const result = await executeTool('cm360_update_placement', {
      profileId: PROFILE_ID,
      placementId: 'nonexistent-id',
      name: 'Will Fail',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// Update tools — ad
// ---------------------------------------------------------------------------

describe('cm360_update_ad', () => {
  it('updates ad name', async () => {
    const ads = mockStore.listAds();
    const target = ads[0]!;
    const result = await executeTool('cm360_update_ad', {
      profileId: PROFILE_ID,
      adId: target.id,
      name: 'Renamed Ad',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.name).toBe('Renamed Ad');
  });

  it('deactivates an ad', async () => {
    const ads = mockStore.listAds();
    const target = ads[0]!;
    const result = await executeTool('cm360_update_ad', {
      profileId: PROFILE_ID,
      adId: target.id,
      active: false,
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.active).toBe(false);
  });

  it('archives an ad', async () => {
    const ads = mockStore.listAds();
    const target = ads[0]!;
    const result = await executeTool('cm360_update_ad', {
      profileId: PROFILE_ID,
      adId: target.id,
      archived: true,
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.archived).toBe(true);
  });

  it('updates placement assignments', async () => {
    const ads = mockStore.listAds();
    const target = ads[0]!;
    const placements = mockStore.listPlacements();
    const newPlacementId = placements[1]!.id;
    const result = await executeTool('cm360_update_ad', {
      profileId: PROFILE_ID,
      adId: target.id,
      placementIds: [newPlacementId],
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    const assignments = (updated.placementAssignments as Array<{ placementId: string }>);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]!.placementId).toBe(newPlacementId);
  });

  it('returns error for nonexistent ad', async () => {
    const result = await executeTool('cm360_update_ad', {
      profileId: PROFILE_ID,
      adId: 'nonexistent-id',
      name: 'Will Fail',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// Update tools — creative
// ---------------------------------------------------------------------------

describe('cm360_update_creative', () => {
  it('updates creative name', async () => {
    const creatives = mockStore.listCreatives();
    const target = creatives[0]!;
    const result = await executeTool('cm360_update_creative', {
      profileId: PROFILE_ID,
      creativeId: target.id,
      name: 'Renamed Creative',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.name).toBe('Renamed Creative');
  });

  it('deactivates a creative', async () => {
    const creatives = mockStore.listCreatives();
    const target = creatives[0]!;
    const result = await executeTool('cm360_update_creative', {
      profileId: PROFILE_ID,
      creativeId: target.id,
      active: false,
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.active).toBe(false);
  });

  it('archives a creative', async () => {
    const creatives = mockStore.listCreatives();
    const target = creatives[0]!;
    const result = await executeTool('cm360_update_creative', {
      profileId: PROFILE_ID,
      creativeId: target.id,
      archived: true,
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.archived).toBe(true);
    // Type and size should be unchanged (immutable)
    expect(updated.type).toBe(target.type);
  });

  it('returns error for nonexistent creative', async () => {
    const result = await executeTool('cm360_update_creative', {
      profileId: PROFILE_ID,
      creativeId: 'nonexistent-id',
      name: 'Will Fail',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// Update tools — landing page
// ---------------------------------------------------------------------------

describe('cm360_update_landing_page', () => {
  it('updates landing page name', async () => {
    const pages = mockStore.listLandingPages();
    const target = pages[0]!;
    const result = await executeTool('cm360_update_landing_page', {
      profileId: PROFILE_ID,
      landingPageId: target.id,
      name: 'Renamed Landing Page',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.name).toBe('Renamed Landing Page');
    // URL unchanged
    expect(updated.url).toBe(target.url);
  });

  it('updates landing page URL', async () => {
    const pages = mockStore.listLandingPages();
    const target = pages[0]!;
    const result = await executeTool('cm360_update_landing_page', {
      profileId: PROFILE_ID,
      landingPageId: target.id,
      url: 'https://newurl.example.com',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.url).toBe('https://newurl.example.com');
    expect(updated.name).toBe(target.name);
  });

  it('archives a landing page', async () => {
    const pages = mockStore.listLandingPages();
    const target = pages[0]!;
    const result = await executeTool('cm360_update_landing_page', {
      profileId: PROFILE_ID,
      landingPageId: target.id,
      archived: true,
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.archived).toBe(true);
  });

  it('rejects invalid URL format', async () => {
    const pages = mockStore.listLandingPages();
    const target = pages[0]!;
    const result = await executeTool('cm360_update_landing_page', {
      profileId: PROFILE_ID,
      landingPageId: target.id,
      url: 'not-a-valid-url',
    });
    expect(result.isError).toBe(true);
    const details = (result.result as Record<string, string>)?.details ?? '';
    expect(details.toLowerCase()).toContain('url');
  });

  it('returns error for nonexistent landing page', async () => {
    const result = await executeTool('cm360_update_landing_page', {
      profileId: PROFILE_ID,
      landingPageId: 'nonexistent-id',
      name: 'Will Fail',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting concerns
// ---------------------------------------------------------------------------

describe('Get + Update round trips', () => {
  it('get → update → get shows consistent state for campaign', async () => {
    const campaigns = mockStore.listCampaigns();
    const target = campaigns[0]!;

    // Get original
    const original = await executeTool('cm360_get_campaign', {
      profileId: PROFILE_ID,
      campaignId: target.id,
    });
    expect(original.isError).toBe(false);

    // Update
    await executeTool('cm360_update_campaign', {
      profileId: PROFILE_ID,
      campaignId: target.id,
      name: 'Round Trip Name',
      archived: true,
    });

    // Get updated
    const updated = await executeTool('cm360_get_campaign', {
      profileId: PROFILE_ID,
      campaignId: target.id,
    });
    expect(updated.isError).toBe(false);
    const u = updated.result as Record<string, unknown>;
    expect(u.name).toBe('Round Trip Name');
    expect(u.archived).toBe(true);
    // ID unchanged
    expect(u.id).toBe(target.id);
  });

  it('update with no optional fields returns unchanged entity', async () => {
    const campaigns = mockStore.listCampaigns();
    const target = campaigns[0]!;
    const result = await executeTool('cm360_update_campaign', {
      profileId: PROFILE_ID,
      campaignId: target.id,
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.name).toBe(target.name);
    expect(updated.startDate).toBe(target.startDate);
    expect(updated.endDate).toBe(target.endDate);
    expect(updated.archived).toBe(target.archived);
  });
});

// ---------------------------------------------------------------------------
// Click-through URL schema fields
// ---------------------------------------------------------------------------

describe('click-through URL schema fields', () => {
  it('create/update ad schemas accept one click-through field and reject both', () => {
    const base = { profileId: 'p', campaignId: 'c', name: 'n', placementIds: ['1'], creativeId: 'cr' };
    expect(CreateAdInputSchema.safeParse({ ...base, landingPageId: 'lp1' }).success).toBe(true);
    expect(CreateAdInputSchema.safeParse({ ...base, customClickThroughUrl: 'https://x.com' }).success).toBe(true);
    expect(CreateAdInputSchema.safeParse({ ...base, landingPageId: 'lp1', customClickThroughUrl: 'https://x.com' }).success).toBe(false);
    expect(CreateAdInputSchema.safeParse({ ...base, customClickThroughUrl: 'notaurl' }).success).toBe(false);
    const upd = { profileId: 'p', adId: 'a1' };
    expect(UpdateAdInputSchema.safeParse({ ...upd, landingPageId: 'lp1' }).success).toBe(true);
    expect(UpdateAdInputSchema.safeParse({ ...upd, landingPageId: 'lp1', customClickThroughUrl: 'https://x.com' }).success).toBe(false);
  });

  it('customClickThroughUrl must be https', () => {
    const upd = { profileId: 'p', adId: 'a1' };
    expect(UpdateAdInputSchema.safeParse({ ...upd, customClickThroughUrl: 'http://insecure.com' }).success).toBe(false);
    expect(UpdateAdInputSchema.safeParse({ ...upd, customClickThroughUrl: 'https://secure.com' }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Click-through URL executor passthrough (Task 5)
// ---------------------------------------------------------------------------

describe('click-through URL executor passthrough', () => {
  it('cm360_create_ad passes landingPageId through to the assignment and computes the URL', async () => {
    const advertiser = mockStore.listAdvertisers()[0]!;
    const lp = mockStore.listLandingPages({ advertiserId: advertiser.id })[0]!;
    const campaign = mockStore.listCampaigns({ advertiserId: advertiser.id })[0]!;
    const placement = mockStore.listPlacements({ campaignId: campaign.id })[0]!;
    const creative = mockStore.listCreatives({ advertiserId: advertiser.id })[0]!;
    const result = await executeTool('cm360_create_ad', {
      profileId: PROFILE_ID,
      campaignId: campaign.id,
      name: 'Executor CT test',
      placementIds: [placement.id],
      creativeId: creative.id,
      landingPageId: lp.id,
    });
    expect(result.isError).toBe(false);
    const ad = result.result as CM360Ad;
    const assignment = ad.creativeRotation.creativeAssignments[0]!;
    expect(assignment.clickThroughUrl?.landingPageId).toBe(lp.id);
    expect(assignment.clickThroughUrl?.computedClickThroughUrl).toBeDefined();
  });

  it('cm360_update_ad switches an ad to a customClickThroughUrl', async () => {
    const existing = mockStore.listAds()[0]!;
    const result = await executeTool('cm360_update_ad', {
      profileId: PROFILE_ID,
      adId: existing.id,
      customClickThroughUrl: 'https://example.com/executor-override',
    });
    expect(result.isError).toBe(false);
    const ad = result.result as CM360Ad;
    const ct = ad.creativeRotation.creativeAssignments[0]!.clickThroughUrl;
    expect(ct?.customClickThroughUrl).toBe('https://example.com/executor-override');
    expect(ct?.computedClickThroughUrl).toContain('https://example.com/executor-override');
    expect(ct?.landingPageId).toBeUndefined();
  });
});
