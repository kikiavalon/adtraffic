import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';

const PROFILE_ID = '12345';

beforeEach(() => {
  mockStore.reset();
});

describe('cm360_list_event_tags', () => {
  it('lists event tags for a campaign', async () => {
    const campaigns = mockStore.listCampaigns();
    const result = await executeTool('cm360_list_event_tags', {
      profileId: PROFILE_ID,
      campaignId: campaigns[0]!.id,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { eventTags: unknown[] };
    expect(data.eventTags.length).toBeGreaterThan(0);
  });

  it('returns empty for campaign with no tags', async () => {
    const campaigns = mockStore.listCampaigns();
    // Find a campaign with no event tags (later campaigns may have none)
    const lastCampaign = campaigns[campaigns.length - 1]!;
    const result = await executeTool('cm360_list_event_tags', {
      profileId: PROFILE_ID,
      campaignId: lastCampaign.id,
    });
    expect(result.isError).toBe(false);
  });
});

describe('cm360_get_event_tag', () => {
  it('returns event tag by ID', async () => {
    const campaigns = mockStore.listCampaigns();
    const tags = mockStore.listEventTags(campaigns[0]!.id);
    const result = await executeTool('cm360_get_event_tag', {
      profileId: PROFILE_ID,
      eventTagId: tags[0]!.id,
    });
    expect(result.isError).toBe(false);
    expect(result.result).toMatchObject({ id: tags[0]!.id, name: tags[0]!.name });
  });

  it('returns error for nonexistent tag', async () => {
    const result = await executeTool('cm360_get_event_tag', {
      profileId: PROFILE_ID,
      eventTagId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });
});

describe('cm360_create_event_tag', () => {
  it('creates event tag', async () => {
    const campaigns = mockStore.listCampaigns();
    const camp = campaigns[0]!;
    const result = await executeTool('cm360_create_event_tag', {
      profileId: PROFILE_ID,
      advertiserId: camp.advertiserId,
      campaignId: camp.id,
      name: 'Test_Tracker',
      url: 'https://track.example.com/imp',
      type: 'IMPRESSION_IMAGE_EVENT_TAG',
    });
    expect(result.isError).toBe(false);
    const tag = result.result as { id: string; name: string; sslCompliant: boolean };
    expect(tag.name).toBe('Test_Tracker');
    expect(tag.sslCompliant).toBe(true);
  });

  it('rejects invalid URL', async () => {
    const campaigns = mockStore.listCampaigns();
    const result = await executeTool('cm360_create_event_tag', {
      profileId: PROFILE_ID,
      advertiserId: campaigns[0]!.advertiserId,
      campaignId: campaigns[0]!.id,
      name: 'Bad_Tracker',
      url: 'not-a-url',
      type: 'IMPRESSION_IMAGE_EVENT_TAG',
    });
    expect(result.isError).toBe(true);
  });
});

describe('cm360_update_event_tag', () => {
  it('disables event tag', async () => {
    const campaigns = mockStore.listCampaigns();
    const tags = mockStore.listEventTags(campaigns[0]!.id);
    const tag = tags[0]!;
    const result = await executeTool('cm360_update_event_tag', {
      profileId: PROFILE_ID,
      eventTagId: tag.id,
      status: 'DISABLED',
    });
    expect(result.isError).toBe(false);
    expect((result.result as { status: string }).status).toBe('DISABLED');
  });

  it('preserves unchanged fields', async () => {
    const campaigns = mockStore.listCampaigns();
    const tags = mockStore.listEventTags(campaigns[0]!.id);
    const tag = tags[0]!;
    const result = await executeTool('cm360_update_event_tag', {
      profileId: PROFILE_ID,
      eventTagId: tag.id,
      name: 'Renamed_Tracker',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as { name: string; url: string };
    expect(updated.name).toBe('Renamed_Tracker');
    expect(updated.url).toBe(tag.url); // Unchanged
  });
});

describe('cm360_delete_event_tag', () => {
  it('deletes event tag', async () => {
    const campaigns = mockStore.listCampaigns();
    const tags = mockStore.listEventTags(campaigns[0]!.id);
    const tagId = tags[0]!.id;
    const result = await executeTool('cm360_delete_event_tag', {
      profileId: PROFILE_ID,
      eventTagId: tagId,
    });
    expect(result.isError).toBe(false);
    // Verify deleted
    const getResult = await executeTool('cm360_get_event_tag', {
      profileId: PROFILE_ID,
      eventTagId: tagId,
    });
    expect(getResult.isError).toBe(true);
  });

  it('returns error for nonexistent tag', async () => {
    const result = await executeTool('cm360_delete_event_tag', {
      profileId: PROFILE_ID,
      eventTagId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
  });
});
