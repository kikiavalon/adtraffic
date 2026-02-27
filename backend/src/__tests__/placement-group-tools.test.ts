/**
 * Tests for the 4 placement group tools:
 * - cm360_list_placement_groups
 * - cm360_get_placement_group
 * - cm360_create_placement_group
 * - cm360_update_placement_group
 *
 * Tests cover:
 * - Tool executor mock path (executeTool)
 * - Zod input validation (schema rejection of bad inputs)
 * - Happy path CRUD round trips
 * - Not-found error handling
 * - Partial update semantics (only specified fields change)
 * - Seed data integrity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';

const PROFILE_ID = '12345';

beforeEach(() => {
  mockStore.reset();
});

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

describe('cm360_list_placement_groups', () => {
  it('lists placement groups for a campaign', async () => {
    const campaigns = mockStore.listCampaigns();
    // Apex Motors (advIdx=0) campaigns have seeded placement groups
    const apexCampaigns = campaigns.filter((c) => c.name.includes('Apex'));
    const campId = apexCampaigns[0]!.id;

    const result = await executeTool('cm360_list_placement_groups', {
      profileId: PROFILE_ID,
      campaignId: campId,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { placementGroups: unknown[] };
    expect(data.placementGroups.length).toBeGreaterThan(0);
  });

  it('returns empty for campaign with no groups', async () => {
    const campaigns = mockStore.listCampaigns();
    // Luminance Beauty (advIdx=1) has no seeded placement groups
    const lumCampaigns = campaigns.filter((c) => c.name.includes('Luminance'));
    if (lumCampaigns.length > 0) {
      const result = await executeTool('cm360_list_placement_groups', {
        profileId: PROFILE_ID,
        campaignId: lumCampaigns[0]!.id,
      });
      expect(result.isError).toBe(false);
      const data = result.result as { placementGroups: unknown[] };
      expect(data.placementGroups).toHaveLength(0);
    }
  });

  it('filters by searchString', async () => {
    const campaigns = mockStore.listCampaigns();
    const apexCampaigns = campaigns.filter((c) => c.name.includes('Apex'));
    const campId = apexCampaigns[0]!.id;

    const result = await executeTool('cm360_list_placement_groups', {
      profileId: PROFILE_ID,
      campaignId: campId,
      searchString: 'Roadblock',
    });
    expect(result.isError).toBe(false);
    const data = result.result as { placementGroups: Array<{ name: string }> };
    for (const pg of data.placementGroups) {
      expect(pg.name.toLowerCase()).toContain('roadblock');
    }
  });

  it('rejects missing campaignId', async () => {
    const result = await executeTool('cm360_list_placement_groups', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(true);
    const details = (result.result as Record<string, string>)?.details ?? '';
    expect(details).toContain('campaignId');
  });
});

// ---------------------------------------------------------------------------
// Get
// ---------------------------------------------------------------------------

describe('cm360_get_placement_group', () => {
  it('returns placement group by ID', async () => {
    const campaigns = mockStore.listCampaigns();
    const apexCampaigns = campaigns.filter((c) => c.name.includes('Apex'));
    const groups = mockStore.listPlacementGroups(apexCampaigns[0]!.id);
    const first = groups[0]!;

    const result = await executeTool('cm360_get_placement_group', {
      profileId: PROFILE_ID,
      placementGroupId: first.id,
    });
    expect(result.isError).toBe(false);
    expect(result.result).toMatchObject({ id: first.id, name: first.name });
  });

  it('returns error for nonexistent group', async () => {
    const result = await executeTool('cm360_get_placement_group', {
      profileId: PROFILE_ID,
      placementGroupId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });

  it('rejects missing placementGroupId', async () => {
    const result = await executeTool('cm360_get_placement_group', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(true);
    const details = (result.result as Record<string, string>)?.details ?? '';
    expect(details).toContain('placementGroupId');
  });

  it('includes all required fields in response', async () => {
    const campaigns = mockStore.listCampaigns();
    const apexCampaigns = campaigns.filter((c) => c.name.includes('Apex'));
    const groups = mockStore.listPlacementGroups(apexCampaigns[0]!.id);
    const first = groups[0]!;

    const result = await executeTool('cm360_get_placement_group', {
      profileId: PROFILE_ID,
      placementGroupId: first.id,
    });
    expect(result.isError).toBe(false);
    const pg = result.result as Record<string, unknown>;
    expect(pg).toHaveProperty('id');
    expect(pg).toHaveProperty('name');
    expect(pg).toHaveProperty('campaignId');
    expect(pg).toHaveProperty('advertiserId');
    expect(pg).toHaveProperty('siteId');
    expect(pg).toHaveProperty('placementGroupType');
    expect(pg).toHaveProperty('placementIds');
    expect(pg).toHaveProperty('activeStatus');
    expect(pg).toHaveProperty('pricingSchedule');
  });
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

describe('cm360_create_placement_group', () => {
  it('creates a PLACEMENT_PACKAGE group', async () => {
    const campaigns = mockStore.listCampaigns();
    const camp = campaigns[0]!;
    const sites = mockStore.listSites();
    const site = sites[0]!;

    const result = await executeTool('cm360_create_placement_group', {
      profileId: PROFILE_ID,
      campaignId: camp.id,
      siteId: site.id,
      name: 'Test Package Group',
      placementGroupType: 'PLACEMENT_PACKAGE',
      startDate: '2026-03-01',
      endDate: '2026-06-30',
    });
    expect(result.isError).toBe(false);
    const pg = result.result as Record<string, unknown>;
    expect(pg.name).toBe('Test Package Group');
    expect(pg.placementGroupType).toBe('PLACEMENT_PACKAGE');
    expect(pg.campaignId).toBe(camp.id);
    expect(pg.siteId).toBe(site.id);
    expect(pg.activeStatus).toBe('ACTIVE');
    expect(pg).toHaveProperty('id');
  });

  it('creates a PLACEMENT_ROADBLOCK group', async () => {
    const campaigns = mockStore.listCampaigns();
    const camp = campaigns[0]!;
    const sites = mockStore.listSites();

    const result = await executeTool('cm360_create_placement_group', {
      profileId: PROFILE_ID,
      campaignId: camp.id,
      siteId: sites[0]!.id,
      name: 'Test Roadblock Group',
      placementGroupType: 'PLACEMENT_ROADBLOCK',
      startDate: '2026-03-01',
      endDate: '2026-06-30',
    });
    expect(result.isError).toBe(false);
    const pg = result.result as Record<string, unknown>;
    expect(pg.placementGroupType).toBe('PLACEMENT_ROADBLOCK');
  });

  it('creates group with placement IDs', async () => {
    const campaigns = mockStore.listCampaigns();
    const camp = campaigns[0]!;
    const sites = mockStore.listSites();
    const placements = mockStore.listPlacements();
    const placementIds = placements.slice(0, 2).map((p) => p.id);

    const result = await executeTool('cm360_create_placement_group', {
      profileId: PROFILE_ID,
      campaignId: camp.id,
      siteId: sites[0]!.id,
      name: 'Group With Placements',
      placementGroupType: 'PLACEMENT_PACKAGE',
      placementIds,
      startDate: '2026-03-01',
      endDate: '2026-06-30',
    });
    expect(result.isError).toBe(false);
    const pg = result.result as { placementIds: string[] };
    expect(pg.placementIds).toEqual(placementIds);
  });

  it('rejects missing required fields', async () => {
    const result = await executeTool('cm360_create_placement_group', {
      profileId: PROFILE_ID,
      campaignId: 'some-id',
      // Missing: siteId, name, placementGroupType, startDate, endDate
    });
    expect(result.isError).toBe(true);
  });

  it('rejects endDate before startDate', async () => {
    const campaigns = mockStore.listCampaigns();
    const sites = mockStore.listSites();

    const result = await executeTool('cm360_create_placement_group', {
      profileId: PROFILE_ID,
      campaignId: campaigns[0]!.id,
      siteId: sites[0]!.id,
      name: 'Bad Dates Group',
      placementGroupType: 'PLACEMENT_PACKAGE',
      startDate: '2026-12-01',
      endDate: '2026-01-01',
    });
    expect(result.isError).toBe(true);
  });

  it('rejects invalid placementGroupType', async () => {
    const campaigns = mockStore.listCampaigns();
    const sites = mockStore.listSites();

    const result = await executeTool('cm360_create_placement_group', {
      profileId: PROFILE_ID,
      campaignId: campaigns[0]!.id,
      siteId: sites[0]!.id,
      name: 'Bad Type Group',
      placementGroupType: 'INVALID_TYPE',
      startDate: '2026-03-01',
      endDate: '2026-06-30',
    });
    expect(result.isError).toBe(true);
  });

  it('created group appears in list', async () => {
    const campaigns = mockStore.listCampaigns();
    const camp = campaigns[0]!;
    const sites = mockStore.listSites();

    await executeTool('cm360_create_placement_group', {
      profileId: PROFILE_ID,
      campaignId: camp.id,
      siteId: sites[0]!.id,
      name: 'Findable Group',
      placementGroupType: 'PLACEMENT_PACKAGE',
      startDate: '2026-03-01',
      endDate: '2026-06-30',
    });

    const listResult = await executeTool('cm360_list_placement_groups', {
      profileId: PROFILE_ID,
      campaignId: camp.id,
      searchString: 'Findable',
    });
    expect(listResult.isError).toBe(false);
    const data = listResult.result as { placementGroups: Array<{ name: string }> };
    const found = data.placementGroups.find((pg) => pg.name === 'Findable Group');
    expect(found).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

describe('cm360_update_placement_group', () => {
  it('updates name only', async () => {
    const campaigns = mockStore.listCampaigns();
    const apexCampaigns = campaigns.filter((c) => c.name.includes('Apex'));
    const groups = mockStore.listPlacementGroups(apexCampaigns[0]!.id);
    const target = groups[0]!;

    const result = await executeTool('cm360_update_placement_group', {
      profileId: PROFILE_ID,
      placementGroupId: target.id,
      name: 'Renamed Group',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.name).toBe('Renamed Group');
    // Other fields unchanged
    expect(updated.placementGroupType).toBe(target.placementGroupType);
    expect(updated.campaignId).toBe(target.campaignId);
  });

  it('updates activeStatus to ARCHIVED', async () => {
    const campaigns = mockStore.listCampaigns();
    const apexCampaigns = campaigns.filter((c) => c.name.includes('Apex'));
    const groups = mockStore.listPlacementGroups(apexCampaigns[0]!.id);
    const target = groups[0]!;

    const result = await executeTool('cm360_update_placement_group', {
      profileId: PROFILE_ID,
      placementGroupId: target.id,
      activeStatus: 'ARCHIVED',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.activeStatus).toBe('ARCHIVED');
  });

  it('updates dates in pricingSchedule', async () => {
    const campaigns = mockStore.listCampaigns();
    const apexCampaigns = campaigns.filter((c) => c.name.includes('Apex'));
    const groups = mockStore.listPlacementGroups(apexCampaigns[0]!.id);
    const target = groups[0]!;

    const result = await executeTool('cm360_update_placement_group', {
      profileId: PROFILE_ID,
      placementGroupId: target.id,
      startDate: '2026-07-01',
      endDate: '2026-12-31',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as { pricingSchedule: { startDate: string; endDate: string } };
    expect(updated.pricingSchedule.startDate).toBe('2026-07-01');
    expect(updated.pricingSchedule.endDate).toBe('2026-12-31');
  });

  it('preserves unchanged fields', async () => {
    const campaigns = mockStore.listCampaigns();
    const apexCampaigns = campaigns.filter((c) => c.name.includes('Apex'));
    const groups = mockStore.listPlacementGroups(apexCampaigns[0]!.id);
    const target = groups[0]!;

    const result = await executeTool('cm360_update_placement_group', {
      profileId: PROFILE_ID,
      placementGroupId: target.id,
      name: 'Only Name Changed',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as Record<string, unknown>;
    expect(updated.name).toBe('Only Name Changed');
    expect(updated.siteId).toBe(target.siteId);
    expect(updated.advertiserId).toBe(target.advertiserId);
    expect(updated.placementGroupType).toBe(target.placementGroupType);
    expect((updated.pricingSchedule as Record<string, string>).startDate).toBe(
      target.pricingSchedule.startDate,
    );
  });

  it('returns error for nonexistent group', async () => {
    const result = await executeTool('cm360_update_placement_group', {
      profileId: PROFILE_ID,
      placementGroupId: 'nonexistent',
      name: 'Will Fail',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });

  it('rejects missing placementGroupId', async () => {
    const result = await executeTool('cm360_update_placement_group', {
      profileId: PROFILE_ID,
      name: 'Will Fail',
    });
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Round trips
// ---------------------------------------------------------------------------

describe('Placement group round trips', () => {
  it('create → get → update → get shows consistent state', async () => {
    const campaigns = mockStore.listCampaigns();
    const camp = campaigns[0]!;
    const sites = mockStore.listSites();

    // Create
    const createResult = await executeTool('cm360_create_placement_group', {
      profileId: PROFILE_ID,
      campaignId: camp.id,
      siteId: sites[0]!.id,
      name: 'Round Trip Group',
      placementGroupType: 'PLACEMENT_PACKAGE',
      startDate: '2026-03-01',
      endDate: '2026-06-30',
    });
    expect(createResult.isError).toBe(false);
    const created = createResult.result as { id: string };

    // Get
    const getResult = await executeTool('cm360_get_placement_group', {
      profileId: PROFILE_ID,
      placementGroupId: created.id,
    });
    expect(getResult.isError).toBe(false);
    expect((getResult.result as { name: string }).name).toBe('Round Trip Group');

    // Update
    const updateResult = await executeTool('cm360_update_placement_group', {
      profileId: PROFILE_ID,
      placementGroupId: created.id,
      name: 'Updated Round Trip Group',
      activeStatus: 'ARCHIVED',
    });
    expect(updateResult.isError).toBe(false);

    // Get again
    const getResult2 = await executeTool('cm360_get_placement_group', {
      profileId: PROFILE_ID,
      placementGroupId: created.id,
    });
    expect(getResult2.isError).toBe(false);
    const final = getResult2.result as Record<string, unknown>;
    expect(final.name).toBe('Updated Round Trip Group');
    expect(final.activeStatus).toBe('ARCHIVED');
    expect(final.id).toBe(created.id);
  });
});

// ---------------------------------------------------------------------------
// Seed data integrity
// ---------------------------------------------------------------------------

describe('Placement group seed data', () => {
  it('has 4 seeded placement groups', () => {
    const campaigns = mockStore.listCampaigns();
    let totalGroups = 0;
    for (const camp of campaigns) {
      totalGroups += mockStore.listPlacementGroups(camp.id).length;
    }
    expect(totalGroups).toBe(4);
  });

  it('seeded groups have valid placement IDs', () => {
    const campaigns = mockStore.listCampaigns();
    for (const camp of campaigns) {
      const groups = mockStore.listPlacementGroups(camp.id);
      for (const group of groups) {
        // Every placementId in the group should reference an existing placement
        for (const plId of group.placementIds) {
          const allPlacements = mockStore.listPlacements();
          const found = allPlacements.find((p) => p.id === plId);
          expect(found).toBeDefined();
        }
      }
    }
  });

  it('seeded groups have PACKAGE and ROADBLOCK types', () => {
    const campaigns = mockStore.listCampaigns();
    const types = new Set<string>();
    for (const camp of campaigns) {
      const groups = mockStore.listPlacementGroups(camp.id);
      for (const group of groups) {
        types.add(group.placementGroupType);
      }
    }
    expect(types.has('PLACEMENT_PACKAGE')).toBe(true);
    expect(types.has('PLACEMENT_ROADBLOCK')).toBe(true);
  });
});
