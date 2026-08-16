/**
 * Tests for ad-level click-through URL and landing page URL suffix support
 * on cm360_create_ad and cm360_update_ad.
 *
 * In CM360, the click-through URL lives on the ad's creative assignment
 * (ClickThroughUrl: landingPageId | customClickThroughUrl | defaultLandingPage)
 * and per-ad UTM tracking parameters attach via the ad-level
 * clickThroughUrlSuffixProperties (suffix must be under 128 chars; setting it
 * from the tool surface implies overrideInheritedSuffix — CM360 suffixes
 * override, never append).
 *
 * Covers:
 * - Zod input validation (mutual exclusivity, URL format, suffix limits)
 * - Mock data store create/update semantics (incl. computed click-through URLs)
 * - Tool executor mock path (executeTool)
 * - Tool definitions expose the new fields
 * - CM360 client request body construction + response mapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';
import { CreateAdInputSchema, UpdateAdInputSchema } from '../cm360/tool-input-schemas.js';
import { CM360_TOOLS } from '../claude/tool-definitions.js';
import { CM360Client } from '../cm360/cm360-client.js';
import type { dfareporting_v5 } from '@googleapis/dfareporting';

const PROFILE_ID = '12345';

beforeEach(() => {
  mockStore.reset();
});

function validCreateInput() {
  return {
    profileId: PROFILE_ID,
    campaignId: '201',
    name: 'apexmotors_display_300x250_prospecting',
    placementIds: ['301'],
    creativeId: '801',
  };
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

describe('CreateAdInputSchema click-through fields', () => {
  it('accepts landingPageId', () => {
    const result = CreateAdInputSchema.safeParse({
      ...validCreateInput(),
      landingPageId: '501',
    });
    expect(result.success).toBe(true);
  });

  it('accepts customClickThroughUrl', () => {
    const result = CreateAdInputSchema.safeParse({
      ...validCreateInput(),
      customClickThroughUrl: 'https://apexmotors.com/offers/spring',
    });
    expect(result.success).toBe(true);
  });

  it('rejects landingPageId and customClickThroughUrl together', () => {
    const result = CreateAdInputSchema.safeParse({
      ...validCreateInput(),
      landingPageId: '501',
      customClickThroughUrl: 'https://apexmotors.com/offers/spring',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid customClickThroughUrl', () => {
    const result = CreateAdInputSchema.safeParse({
      ...validCreateInput(),
      customClickThroughUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a clickThroughUrlSuffix with UTM parameters', () => {
    const result = CreateAdInputSchema.safeParse({
      ...validCreateInput(),
      clickThroughUrlSuffix: 'utm_source=cm360&utm_medium=display&utm_campaign=spring-sale-q2-2026',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a clickThroughUrlSuffix of 128 characters or more', () => {
    const result = CreateAdInputSchema.safeParse({
      ...validCreateInput(),
      clickThroughUrlSuffix: 'utm_content=' + 'x'.repeat(120),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a clickThroughUrlSuffix with a leading ? or &', () => {
    for (const suffix of ['?utm_source=cm360', '&utm_source=cm360']) {
      const result = CreateAdInputSchema.safeParse({
        ...validCreateInput(),
        clickThroughUrlSuffix: suffix,
      });
      expect(result.success).toBe(false);
    }
  });
});

describe('UpdateAdInputSchema click-through fields', () => {
  it('accepts landingPageId, customClickThroughUrl, and suffix individually', () => {
    const base = { profileId: PROFILE_ID, adId: '1' };
    expect(UpdateAdInputSchema.safeParse({ ...base, landingPageId: '501' }).success).toBe(true);
    expect(
      UpdateAdInputSchema.safeParse({ ...base, customClickThroughUrl: 'https://apexmotors.com/x' }).success,
    ).toBe(true);
    expect(
      UpdateAdInputSchema.safeParse({ ...base, clickThroughUrlSuffix: 'utm_source=cm360' }).success,
    ).toBe(true);
  });

  it('rejects landingPageId and customClickThroughUrl together', () => {
    const result = UpdateAdInputSchema.safeParse({
      profileId: PROFILE_ID,
      adId: '1',
      landingPageId: '501',
      customClickThroughUrl: 'https://apexmotors.com/x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a clickThroughUrlSuffix of 128 characters or more', () => {
    const result = UpdateAdInputSchema.safeParse({
      profileId: PROFILE_ID,
      adId: '1',
      clickThroughUrlSuffix: 'x'.repeat(128),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Mock data store
// ---------------------------------------------------------------------------

describe('mockStore.createAd click-through support', () => {
  it('sets a landing page click-through on the creative assignment', () => {
    const campaign = mockStore.listCampaigns()[0]!;
    const landingPage = mockStore.listLandingPages({ advertiserId: campaign.advertiserId })[0]!;
    const ad = mockStore.createAd({
      campaignId: campaign.id,
      name: 'test ad',
      placementIds: ['301'],
      creativeId: '801',
      landingPageId: landingPage.id,
    });
    const assignment = ad.creativeRotation.creativeAssignments[0]!;
    expect(assignment.creativeId).toBe('801');
    expect(assignment.clickThroughUrl).toMatchObject({ landingPageId: landingPage.id });
    // The resolver computes the final URL from the referenced landing page
    expect(assignment.clickThroughUrl!.computedClickThroughUrl).toContain(
      landingPage.url.split('?')[0],
    );
  });

  it('sets a custom click-through URL on the creative assignment', () => {
    const campaign = mockStore.listCampaigns()[0]!;
    const ad = mockStore.createAd({
      campaignId: campaign.id,
      name: 'test ad',
      placementIds: ['301'],
      creativeId: '801',
      customClickThroughUrl: 'https://apexmotors.com/offers/spring',
    });
    const assignment = ad.creativeRotation.creativeAssignments[0]!;
    expect(assignment.creativeId).toBe('801');
    expect(assignment.clickThroughUrl).toMatchObject({
      customClickThroughUrl: 'https://apexmotors.com/offers/spring',
    });
    expect(assignment.clickThroughUrl!.computedClickThroughUrl).toContain(
      'https://apexmotors.com/offers/spring',
    );
  });

  it('sets the ad-level suffix as an overriding clickThroughUrlSuffixProperties', () => {
    const campaign = mockStore.listCampaigns()[0]!;
    const ad = mockStore.createAd({
      campaignId: campaign.id,
      name: 'test ad',
      placementIds: ['301'],
      creativeId: '801',
      clickThroughUrlSuffix: 'utm_source=cm360&utm_medium=display',
    });
    expect(ad.clickThroughUrlSuffixProperties).toEqual({
      clickThroughUrlSuffix: 'utm_source=cm360&utm_medium=display',
      overrideInheritedSuffix: true,
    });
    // The suffix flows into the computed click-through URL
    expect(ad.creativeRotation.creativeAssignments[0]!.clickThroughUrl!.computedClickThroughUrl)
      .toContain('utm_source=cm360&utm_medium=display');
  });

  it('defaults to the campaign landing page with no suffix when not provided', () => {
    const campaign = mockStore.listCampaigns()[0]!;
    const ad = mockStore.createAd({
      campaignId: campaign.id,
      name: 'test ad',
      placementIds: ['301'],
      creativeId: '801',
    });
    expect(ad.creativeRotation.creativeAssignments[0]!.clickThroughUrl).toMatchObject({
      defaultLandingPage: true,
    });
    expect(ad.clickThroughUrlSuffixProperties).toBeUndefined();
  });
});

describe('mockStore.updateAd click-through support', () => {
  function seedAd() {
    const campaign = mockStore.listCampaigns()[0]!;
    return mockStore.createAd({
      campaignId: campaign.id,
      name: 'test ad',
      placementIds: ['301'],
      creativeId: '801',
    });
  }

  it('sets a landing page click-through while preserving the assigned creative', () => {
    const ad = seedAd();
    const updated = mockStore.updateAd(ad.id, { landingPageId: '501' })!;
    const assignment = updated.creativeRotation.creativeAssignments[0]!;
    expect(assignment.creativeId).toBe('801');
    expect(assignment.clickThroughUrl).toMatchObject({ landingPageId: '501' });
  });

  it('sets a custom click-through URL while preserving the assigned creative', () => {
    const ad = seedAd();
    const updated = mockStore.updateAd(ad.id, {
      customClickThroughUrl: 'https://apexmotors.com/offers/spring',
    })!;
    const assignment = updated.creativeRotation.creativeAssignments[0]!;
    expect(assignment.creativeId).toBe('801');
    expect(assignment.clickThroughUrl).toMatchObject({
      customClickThroughUrl: 'https://apexmotors.com/offers/spring',
    });
  });

  it('updates the suffix without touching other fields', () => {
    const ad = seedAd();
    const updated = mockStore.updateAd(ad.id, {
      clickThroughUrlSuffix: 'utm_source=cm360&utm_medium=display',
    })!;
    expect(updated.clickThroughUrlSuffixProperties).toEqual({
      clickThroughUrlSuffix: 'utm_source=cm360&utm_medium=display',
      overrideInheritedSuffix: true,
    });
    expect(updated.name).toBe(ad.name);
    // Click-through source fields are untouched (computed URL may change with the suffix)
    const before = ad.creativeRotation.creativeAssignments[0]!;
    const after = updated.creativeRotation.creativeAssignments[0]!;
    expect(after.creativeId).toBe(before.creativeId);
    expect(after.clickThroughUrl).toMatchObject({ defaultLandingPage: true });
  });

  it('applies a new click-through URL when swapping the creative in the same update', () => {
    const ad = seedAd();
    const updated = mockStore.updateAd(ad.id, {
      creativeId: '802',
      landingPageId: '502',
    })!;
    const assignment = updated.creativeRotation.creativeAssignments[0]!;
    expect(assignment.creativeId).toBe('802');
    expect(assignment.clickThroughUrl).toMatchObject({ landingPageId: '502' });
  });

  it('preserves the existing click-through URL when only swapping the creative', () => {
    const ad = seedAd();
    mockStore.updateAd(ad.id, { landingPageId: '501' });
    const updated = mockStore.updateAd(ad.id, { creativeId: '802' })!;
    const assignment = updated.creativeRotation.creativeAssignments[0]!;
    expect(assignment.creativeId).toBe('802');
    expect(assignment.clickThroughUrl).toMatchObject({ landingPageId: '501' });
  });
});

// ---------------------------------------------------------------------------
// Tool executor (mock path)
// ---------------------------------------------------------------------------

describe('cm360_create_ad executor click-through support', () => {
  it('creates an ad with a landing page click-through and suffix', async () => {
    const campaign = mockStore.listCampaigns()[0]!;
    const result = await executeTool('cm360_create_ad', {
      profileId: PROFILE_ID,
      campaignId: campaign.id,
      name: 'exec test ad',
      placementIds: ['301'],
      creativeId: '801',
      landingPageId: '501',
      clickThroughUrlSuffix: 'utm_source=cm360&utm_medium=display',
    });
    expect(result.isError).toBe(false);
    const ad = result.result as {
      clickThroughUrlSuffixProperties?: { clickThroughUrlSuffix?: string; overrideInheritedSuffix?: boolean };
      creativeRotation: { creativeAssignments: Array<{ clickThroughUrl?: { landingPageId?: string } }> };
    };
    expect(ad.clickThroughUrlSuffixProperties).toEqual({
      clickThroughUrlSuffix: 'utm_source=cm360&utm_medium=display',
      overrideInheritedSuffix: true,
    });
    expect(ad.creativeRotation.creativeAssignments[0]!.clickThroughUrl).toMatchObject({
      landingPageId: '501',
    });
  });

  it('rejects landingPageId and customClickThroughUrl together', async () => {
    const campaign = mockStore.listCampaigns()[0]!;
    const result = await executeTool('cm360_create_ad', {
      profileId: PROFILE_ID,
      campaignId: campaign.id,
      name: 'exec test ad',
      placementIds: ['301'],
      creativeId: '801',
      landingPageId: '501',
      customClickThroughUrl: 'https://apexmotors.com/x',
    });
    expect(result.isError).toBe(true);
  });
});

describe('cm360_update_ad executor click-through support', () => {
  it('updates an ad with a custom click-through URL and suffix', async () => {
    const campaign = mockStore.listCampaigns()[0]!;
    const ad = mockStore.createAd({
      campaignId: campaign.id,
      name: 'exec update ad',
      placementIds: ['301'],
      creativeId: '801',
    });
    const result = await executeTool('cm360_update_ad', {
      profileId: PROFILE_ID,
      adId: ad.id,
      customClickThroughUrl: 'https://apexmotors.com/offers/spring',
      clickThroughUrlSuffix: 'utm_content=%epid!&utm_term=%eaid!',
    });
    expect(result.isError).toBe(false);
    const updated = result.result as {
      clickThroughUrlSuffixProperties?: { clickThroughUrlSuffix?: string; overrideInheritedSuffix?: boolean };
      creativeRotation: { creativeAssignments: Array<{ clickThroughUrl?: { customClickThroughUrl?: string } }> };
    };
    expect(updated.clickThroughUrlSuffixProperties).toEqual({
      clickThroughUrlSuffix: 'utm_content=%epid!&utm_term=%eaid!',
      overrideInheritedSuffix: true,
    });
    expect(updated.creativeRotation.creativeAssignments[0]!.clickThroughUrl).toMatchObject({
      customClickThroughUrl: 'https://apexmotors.com/offers/spring',
    });
  });
});

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

describe('tool definitions expose click-through fields', () => {
  for (const toolName of ['cm360_create_ad', 'cm360_update_ad'] as const) {
    it(`${toolName} exposes landingPageId, customClickThroughUrl, and clickThroughUrlSuffix as optional`, () => {
      const tool = CM360_TOOLS.find((t) => t.name === toolName)!;
      const props = tool.input_schema.properties as Record<string, unknown>;
      expect(props.landingPageId).toBeDefined();
      expect(props.customClickThroughUrl).toBeDefined();
      expect(props.clickThroughUrlSuffix).toBeDefined();
      const required = tool.input_schema.required as string[];
      expect(required).not.toContain('landingPageId');
      expect(required).not.toContain('customClickThroughUrl');
      expect(required).not.toContain('clickThroughUrlSuffix');
    });
  }
});

// ---------------------------------------------------------------------------
// CM360 client (real API path)
// ---------------------------------------------------------------------------

function createMockApi(): dfareporting_v5.Dfareporting {
  return {
    ads: {
      get: vi.fn(),
      insert: vi.fn(),
      patch: vi.fn(),
    },
  } as unknown as dfareporting_v5.Dfareporting;
}

describe('CM360Client ad click-through support', () => {
  let mockApi: dfareporting_v5.Dfareporting;
  let client: CM360Client;

  beforeEach(() => {
    mockApi = createMockApi();
    client = new CM360Client(mockApi);
  });

  it('createAd sends clickThroughUrl and clickThroughUrlSuffixProperties', async () => {
    (mockApi.ads.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: '1' } });
    await client.createAd('12345', {
      campaignId: '201',
      name: 'test ad',
      placementIds: ['301'],
      creativeId: '801',
      landingPageId: '501',
      clickThroughUrlSuffix: 'utm_source=cm360',
    });
    const call = (mockApi.ads.insert as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      requestBody: dfareporting_v5.Schema$Ad;
    };
    expect(call.requestBody.creativeRotation?.creativeAssignments?.[0]?.clickThroughUrl).toEqual({
      landingPageId: '501',
    });
    expect(call.requestBody.clickThroughUrlSuffixProperties).toEqual({
      clickThroughUrlSuffix: 'utm_source=cm360',
      overrideInheritedSuffix: true,
    });
  });

  it('createAd defaults to the campaign landing page and omits the suffix when not provided', async () => {
    (mockApi.ads.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: '1' } });
    await client.createAd('12345', {
      campaignId: '201',
      name: 'test ad',
      placementIds: ['301'],
      creativeId: '801',
    });
    const call = (mockApi.ads.insert as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      requestBody: dfareporting_v5.Schema$Ad;
    };
    expect(call.requestBody.creativeRotation?.creativeAssignments?.[0]?.clickThroughUrl).toEqual({
      defaultLandingPage: true,
    });
    expect(call.requestBody).not.toHaveProperty('clickThroughUrlSuffixProperties');
  });

  it('patchAd sends only clickThroughUrlSuffixProperties for a suffix-only update', async () => {
    (mockApi.ads.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: '1' } });
    await client.patchAd('12345', '1', { clickThroughUrlSuffix: 'utm_source=cm360' });
    expect(mockApi.ads.get).not.toHaveBeenCalled();
    const call = (mockApi.ads.patch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      requestBody: dfareporting_v5.Schema$Ad;
    };
    expect(call.requestBody.clickThroughUrlSuffixProperties).toEqual({
      clickThroughUrlSuffix: 'utm_source=cm360',
      overrideInheritedSuffix: true,
    });
    expect(call.requestBody).not.toHaveProperty('creativeRotation');
  });

  it('patchAd fetches the existing rotation when updating only the click-through URL', async () => {
    (mockApi.ads.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        id: '1',
        creativeRotation: {
          type: 'CREATIVE_ROTATION_TYPE_SEQUENTIAL',
          creativeAssignments: [{ creativeId: '801' }],
        },
      },
    });
    (mockApi.ads.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: '1' } });
    await client.patchAd('12345', '1', { landingPageId: '501' });
    const call = (mockApi.ads.patch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      requestBody: dfareporting_v5.Schema$Ad;
    };
    expect(call.requestBody.creativeRotation).toEqual({
      type: 'CREATIVE_ROTATION_TYPE_SEQUENTIAL',
      creativeAssignments: [{
        creativeId: '801',
        clickThroughUrl: { landingPageId: '501' },
      }],
    });
  });

  it('patchAd applies the new click-through URL when creativeId is also provided', async () => {
    (mockApi.ads.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        id: '1',
        creativeRotation: {
          type: 'CREATIVE_ROTATION_TYPE_RANDOM',
          creativeAssignments: [{ creativeId: '801' }],
        },
      },
    });
    (mockApi.ads.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: '1' } });
    await client.patchAd('12345', '1', {
      creativeId: '802',
      customClickThroughUrl: 'https://apexmotors.com/x',
    });
    const call = (mockApi.ads.patch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      requestBody: dfareporting_v5.Schema$Ad;
    };
    expect(call.requestBody.creativeRotation?.creativeAssignments).toEqual([{
      creativeId: '802',
      active: true,
      clickThroughUrl: { customClickThroughUrl: 'https://apexmotors.com/x' },
    }]);
  });

  it('maps clickThroughUrl and suffix properties from API responses', async () => {
    (mockApi.ads.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        id: '1',
        name: 'mapped ad',
        campaignId: '201',
        advertiserId: '101',
        clickThroughUrlSuffixProperties: {
          clickThroughUrlSuffix: 'utm_source=cm360',
          overrideInheritedSuffix: true,
        },
        creativeRotation: {
          type: 'CREATIVE_ROTATION_TYPE_RANDOM',
          creativeAssignments: [{
            creativeId: '801',
            clickThroughUrl: {
              defaultLandingPage: false,
              landingPageId: '501',
              computedClickThroughUrl: 'https://apexmotors.com/deals',
            },
          }],
        },
      },
    });
    const ad = await client.getAd('12345', '1');
    expect(ad?.clickThroughUrlSuffixProperties).toEqual({
      clickThroughUrlSuffix: 'utm_source=cm360',
      overrideInheritedSuffix: true,
    });
    expect(ad?.creativeRotation.creativeAssignments[0]).toEqual({
      creativeId: '801',
      clickThroughUrl: {
        defaultLandingPage: false,
        landingPageId: '501',
        computedClickThroughUrl: 'https://apexmotors.com/deals',
      },
    });
  });
});
