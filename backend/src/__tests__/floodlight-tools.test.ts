import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';

const PROFILE_ID = '12345';

beforeEach(() => {
  mockStore.reset();
});

// --- List Floodlight Configurations ---

describe('cm360_list_floodlight_configurations', () => {
  it('lists configurations for an advertiser', async () => {
    const advertisers = mockStore.listAdvertisers();
    const result = await executeTool('cm360_list_floodlight_configurations', {
      profileId: PROFILE_ID,
      advertiserId: advertisers[0]!.id,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { floodlightConfigurations: unknown[] };
    expect(data.floodlightConfigurations.length).toBeGreaterThan(0);
  });

  it('returns lookback window defaults', async () => {
    const advertisers = mockStore.listAdvertisers();
    const result = await executeTool('cm360_list_floodlight_configurations', {
      profileId: PROFILE_ID,
      advertiserId: advertisers[0]!.id,
    });
    const data = result.result as { floodlightConfigurations: Array<{ lookbackClickDays: number; lookbackImpressionDays: number }> };
    const config = data.floodlightConfigurations[0]!;
    expect(config.lookbackClickDays).toBe(30);
    expect(config.lookbackImpressionDays).toBe(7);
  });
});

// --- List Floodlight Activity Groups ---

describe('cm360_list_floodlight_activity_groups', () => {
  it('lists groups for an advertiser', async () => {
    const advertisers = mockStore.listAdvertisers();
    const result = await executeTool('cm360_list_floodlight_activity_groups', {
      profileId: PROFILE_ID,
      advertiserId: advertisers[0]!.id,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { floodlightActivityGroups: unknown[] };
    expect(data.floodlightActivityGroups.length).toBeGreaterThan(0);
  });

  it('filters by search string', async () => {
    const advertisers = mockStore.listAdvertisers();
    const result = await executeTool('cm360_list_floodlight_activity_groups', {
      profileId: PROFILE_ID,
      advertiserId: advertisers[0]!.id,
      searchString: 'Lead',
    });
    expect(result.isError).toBe(false);
    const data = result.result as { floodlightActivityGroups: Array<{ name: string }> };
    for (const g of data.floodlightActivityGroups) {
      expect(g.name.toLowerCase()).toContain('lead');
    }
  });
});

// --- Get Floodlight Activity Group ---

describe('cm360_get_floodlight_activity_group', () => {
  it('returns group by ID', async () => {
    const advertisers = mockStore.listAdvertisers();
    const groups = mockStore.listFloodlightActivityGroups(advertisers[0]!.id);
    const result = await executeTool('cm360_get_floodlight_activity_group', {
      profileId: PROFILE_ID,
      floodlightActivityGroupId: groups[0]!.id,
    });
    expect(result.isError).toBe(false);
    expect(result.result).toMatchObject({ id: groups[0]!.id, name: groups[0]!.name });
  });

  it('returns error for nonexistent group', async () => {
    const result = await executeTool('cm360_get_floodlight_activity_group', {
      profileId: PROFILE_ID,
      floodlightActivityGroupId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });
});

// --- List Floodlight Activities ---

describe('cm360_list_floodlight_activities', () => {
  it('lists activities for an advertiser', async () => {
    const advertisers = mockStore.listAdvertisers();
    const result = await executeTool('cm360_list_floodlight_activities', {
      profileId: PROFILE_ID,
      advertiserId: advertisers[0]!.id,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { floodlightActivities: unknown[] };
    expect(data.floodlightActivities.length).toBeGreaterThan(0);
  });

  it('filters by activity group', async () => {
    const advertisers = mockStore.listAdvertisers();
    const groups = mockStore.listFloodlightActivityGroups(advertisers[0]!.id);
    const result = await executeTool('cm360_list_floodlight_activities', {
      profileId: PROFILE_ID,
      advertiserId: advertisers[0]!.id,
      floodlightActivityGroupId: groups[0]!.id,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { floodlightActivities: Array<{ floodlightActivityGroupId: string }> };
    for (const a of data.floodlightActivities) {
      expect(a.floodlightActivityGroupId).toBe(groups[0]!.id);
    }
  });

  it('filters by search string', async () => {
    const advertisers = mockStore.listAdvertisers();
    const result = await executeTool('cm360_list_floodlight_activities', {
      profileId: PROFILE_ID,
      advertiserId: advertisers[0]!.id,
      searchString: 'Form',
    });
    expect(result.isError).toBe(false);
    const data = result.result as { floodlightActivities: Array<{ name: string }> };
    for (const a of data.floodlightActivities) {
      expect(a.name.toLowerCase()).toContain('form');
    }
  });
});

// --- Get Floodlight Activity ---

describe('cm360_get_floodlight_activity', () => {
  it('returns activity by ID', async () => {
    const advertisers = mockStore.listAdvertisers();
    const activities = mockStore.listFloodlightActivities(advertisers[0]!.id);
    const result = await executeTool('cm360_get_floodlight_activity', {
      profileId: PROFILE_ID,
      floodlightActivityId: activities[0]!.id,
    });
    expect(result.isError).toBe(false);
    expect(result.result).toMatchObject({
      id: activities[0]!.id,
      name: activities[0]!.name,
      type: activities[0]!.type,
      countingMethod: activities[0]!.countingMethod,
    });
  });

  it('returns error for nonexistent activity', async () => {
    const result = await executeTool('cm360_get_floodlight_activity', {
      profileId: PROFILE_ID,
      floodlightActivityId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });
});

// --- Create Floodlight Activity ---

describe('cm360_create_floodlight_activity', () => {
  it('creates a Counter activity', async () => {
    const advertisers = mockStore.listAdvertisers();
    const groups = mockStore.listFloodlightActivityGroups(advertisers[0]!.id);
    const counterGroup = groups.find(g => g.type === 'COUNTER')!;
    const result = await executeTool('cm360_create_floodlight_activity', {
      profileId: PROFILE_ID,
      advertiserId: advertisers[0]!.id,
      floodlightActivityGroupId: counterGroup.id,
      name: 'Test Signup',
      type: 'COUNTER',
      countingMethod: 'STANDARD_COUNTING',
      tagString: 'test_signup',
    });
    expect(result.isError).toBe(false);
    const activity = result.result as { id: string; name: string; type: string; tagString: string };
    expect(activity.name).toBe('Test Signup');
    expect(activity.type).toBe('COUNTER');
    expect(activity.tagString).toBe('test_signup');
  });

  it('rejects activity type mismatch with group', async () => {
    const advertisers = mockStore.listAdvertisers();
    const groups = mockStore.listFloodlightActivityGroups(advertisers[0]!.id);
    const counterGroup = groups.find(g => g.type === 'COUNTER')!;
    const result = await executeTool('cm360_create_floodlight_activity', {
      profileId: PROFILE_ID,
      advertiserId: advertisers[0]!.id,
      floodlightActivityGroupId: counterGroup.id,
      name: 'Wrong Type',
      type: 'SALE',
      countingMethod: 'STANDARD_COUNTING',
      tagString: 'wrong_type',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('does not match group type');
  });

  it('rejects invalid tag string format', async () => {
    const advertisers = mockStore.listAdvertisers();
    const groups = mockStore.listFloodlightActivityGroups(advertisers[0]!.id);
    const result = await executeTool('cm360_create_floodlight_activity', {
      profileId: PROFILE_ID,
      advertiserId: advertisers[0]!.id,
      floodlightActivityGroupId: groups[0]!.id,
      name: 'Bad Tag',
      type: groups[0]!.type,
      countingMethod: 'STANDARD_COUNTING',
      tagString: 'has spaces and !@#',
    });
    expect(result.isError).toBe(true);
  });

  it('round-trips: create then get', async () => {
    const advertisers = mockStore.listAdvertisers();
    const groups = mockStore.listFloodlightActivityGroups(advertisers[0]!.id);
    const counterGroup = groups.find(g => g.type === 'COUNTER')!;
    const createResult = await executeTool('cm360_create_floodlight_activity', {
      profileId: PROFILE_ID,
      advertiserId: advertisers[0]!.id,
      floodlightActivityGroupId: counterGroup.id,
      name: 'Round Trip Test',
      type: 'COUNTER',
      countingMethod: 'UNIQUE_COUNTING',
      tagString: 'round_trip_test',
    });
    const created = createResult.result as { id: string };
    const getResult = await executeTool('cm360_get_floodlight_activity', {
      profileId: PROFILE_ID,
      floodlightActivityId: created.id,
    });
    expect(getResult.isError).toBe(false);
    expect(getResult.result).toMatchObject({ name: 'Round Trip Test', countingMethod: 'UNIQUE_COUNTING' });
  });
});

// --- Generate Floodlight Tag ---

describe('cm360_generate_floodlight_tag', () => {
  it('generates tag for existing activity', async () => {
    const advertisers = mockStore.listAdvertisers();
    const activities = mockStore.listFloodlightActivities(advertisers[0]!.id);
    const result = await executeTool('cm360_generate_floodlight_tag', {
      profileId: PROFILE_ID,
      floodlightActivityId: activities[0]!.id,
    });
    expect(result.isError).toBe(false);
    const tag = result.result as {
      globalSiteTagGlobalSnippet?: string;
      globalSiteTagEventSnippet?: string;
      iframeTag?: string;
      imageTag?: string;
    };
    expect(tag.globalSiteTagGlobalSnippet).toContain('gtag');
    expect(tag.globalSiteTagEventSnippet).toContain('conversion');
    expect(tag.iframeTag).toContain('doubleclick.net');
    expect(tag.imageTag).toContain('doubleclick.net');
  });

  it('returns error for nonexistent activity', async () => {
    const result = await executeTool('cm360_generate_floodlight_tag', {
      profileId: PROFILE_ID,
      floodlightActivityId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });
});

// --- Create Floodlight Activity Group ---

describe('cm360_create_floodlight_activity_group', () => {
  it('creates a new group', async () => {
    const advertisers = mockStore.listAdvertisers();
    const result = await executeTool('cm360_create_floodlight_activity_group', {
      profileId: PROFILE_ID,
      advertiserId: advertisers[0]!.id,
      name: 'New Retargeting Group',
      type: 'COUNTER',
      tagString: 'new_retargeting',
    });
    expect(result.isError).toBe(false);
    const group = result.result as { id: string; name: string; type: string };
    expect(group.name).toBe('New Retargeting Group');
    expect(group.type).toBe('COUNTER');
  });

  it('rejects group for advertiser without Floodlight config', async () => {
    const result = await executeTool('cm360_create_floodlight_activity_group', {
      profileId: PROFILE_ID,
      advertiserId: 'nonexistent-advertiser',
      name: 'Should Fail',
      type: 'COUNTER',
      tagString: 'should_fail',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('No Floodlight configuration');
  });
});
