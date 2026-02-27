import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';

const PROFILE_ID = '12345';

beforeEach(() => {
  mockStore.reset();
});

describe('cm360_generate_tags — video format support', () => {
  it('generates VAST tags for IN_STREAM_VIDEO placements', async () => {
    const placements = mockStore.listPlacements();
    const videoPl = placements.find(p => p.compatibility === 'IN_STREAM_VIDEO');
    expect(videoPl).toBeDefined();

    const result = await executeTool('cm360_generate_tags', {
      profileId: PROFILE_ID,
      campaignId: videoPl!.campaignId,
      placementIds: [videoPl!.id],
    });
    expect(result.isError).toBe(false);
    const placementTags = (result.result as { placementTags: Array<{ placementId: string; tagData: Array<{ format: string; impressionTag: string; clickTag: string }> }> }).placementTags;
    expect(placementTags.length).toBe(1);
    expect(placementTags[0]!.tagData[0]!.format).toBe('PLACEMENT_TAG_VAST_2_0');
    expect(placementTags[0]!.tagData[0]!.impressionTag).toContain('VAST');
  });

  it('generates standard tags for DISPLAY placements', async () => {
    const placements = mockStore.listPlacements();
    const displayPl = placements.find(p => p.compatibility !== 'IN_STREAM_VIDEO' && p.compatibility !== 'IN_STREAM_AUDIO');
    expect(displayPl).toBeDefined();

    const result = await executeTool('cm360_generate_tags', {
      profileId: PROFILE_ID,
      campaignId: displayPl!.campaignId,
      placementIds: [displayPl!.id],
    });
    expect(result.isError).toBe(false);
    const placementTags = (result.result as { placementTags: Array<{ placementId: string; tagData: Array<{ format: string }> }> }).placementTags;
    expect(placementTags[0]!.tagData[0]!.format).toBe('PLACEMENT_TAG_STANDARD');
  });

  it('accepts optional tagFormats override', async () => {
    const placements = mockStore.listPlacements();
    const displayPl = placements.find(p => p.compatibility !== 'IN_STREAM_VIDEO' && p.compatibility !== 'IN_STREAM_AUDIO');

    const result = await executeTool('cm360_generate_tags', {
      profileId: PROFILE_ID,
      campaignId: displayPl!.campaignId,
      placementIds: [displayPl!.id],
      tagFormats: ['PLACEMENT_TAG_IFRAME_JAVASCRIPT'],
    });
    expect(result.isError).toBe(false);
    const placementTags = (result.result as { placementTags: Array<{ placementId: string; tagData: Array<{ format: string }> }> }).placementTags;
    expect(placementTags[0]!.tagData[0]!.format).toBe('PLACEMENT_TAG_IFRAME_JAVASCRIPT');
  });
});
