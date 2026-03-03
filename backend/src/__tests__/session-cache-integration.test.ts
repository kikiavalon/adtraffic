/**
 * Tests for session cache integration with the tool executor.
 *
 * Verifies that:
 * - Read tools check the cache before calling the CM360 API
 * - Cache misses on reads trigger API calls and store results
 * - Write tools invalidate the relevant entity type cache after success
 * - Error results are not cached
 * - Mock path (no userId) bypasses caching entirely
 * - Tools without entity mapping (e.g., generate_tags) bypass caching
 * - Cache filter keys are built correctly for different tool/input combos
 * - The isMutatingTool helper catches create tools not in write-classifier
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock dependencies ---

// Session cache
const mockGetCached = vi.fn().mockResolvedValue(null);
const mockSetCached = vi.fn().mockResolvedValue(undefined);
const mockInvalidateEntity = vi.fn().mockResolvedValue(undefined);

vi.mock('../cm360/session-cache.js', () => ({
  getCached: (...args: unknown[]) => mockGetCached(...(args as [string, string, string?])),
  setCached: (...args: unknown[]) => mockSetCached(...(args as [string, string, unknown, string?])),
  invalidateEntity: (...args: unknown[]) => mockInvalidateEntity(...(args as [string, string])),
  clearSessionCache: vi.fn(),
}));

// Write classifier (real implementation)
vi.mock('../cm360/write-classifier.js', async () => {
  const actual = await vi.importActual<typeof import('../cm360/write-classifier.js')>('../cm360/write-classifier.js');
  return actual;
});

// Errors module (real implementation)
vi.mock('../cm360/errors.js', async () => {
  const actual = await vi.importActual<typeof import('../cm360/errors.js')>('../cm360/errors.js');
  return actual;
});

// Token manager
const mockGetCM360Client = vi.fn();
vi.mock('../cm360/token-manager.js', () => ({
  getCM360Client: (...args: unknown[]) => mockGetCM360Client(...args),
}));

// CM360 client constructor mock — dynamically build the instance from mockClientMethods
const mockClientMethods: Record<string, ReturnType<typeof vi.fn>> = {};
vi.mock('../cm360/cm360-client.js', () => ({
  CM360Client: vi.fn(() => {
    // Return a fresh object that delegates to mockClientMethods
    const instance: Record<string, unknown> = {};
    for (const [key, fn] of Object.entries(mockClientMethods)) {
      instance[key] = fn;
    }
    return instance;
  }),
}));

// API rate limiter
const mockCheckCM360RateLimit = vi.fn().mockReturnValue({ allowed: true });
const mockRecordCM360Request = vi.fn();
vi.mock('../cm360/api-rate-limiter.js', () => ({
  checkCM360RateLimit: (...args: unknown[]) => mockCheckCM360RateLimit(...args),
  recordCM360Request: (...args: unknown[]) => mockRecordCM360Request(...args),
}));

// Audit service
const mockLogAuditEvent = vi.fn();
vi.mock('../audit/audit-service.js', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

// Logger
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock data store — for mock fallback and no-userId paths
vi.mock('../cm360/mock-data-store.js', () => ({
  mockStore: {
    listProfiles: vi.fn().mockReturnValue([{ profileId: 'p1' }]),
    listAdvertisers: vi.fn().mockReturnValue([{ id: 'adv1', name: 'Mock Advertiser' }]),
    getAdvertiser: vi.fn().mockReturnValue({ id: 'adv1', name: 'Mock Advertiser' }),
    listCampaigns: vi.fn().mockReturnValue([{ id: 'c1', name: 'Mock Campaign' }]),
    getCampaign: vi.fn().mockReturnValue({ id: 'c1', name: 'Mock Campaign' }),
    createCampaign: vi.fn().mockReturnValue({ id: 'c-new', name: 'New Campaign' }),
    listSites: vi.fn().mockReturnValue([]),
    listLandingPages: vi.fn().mockReturnValue([]),
    createLandingPage: vi.fn().mockReturnValue({ id: 'lp1' }),
    listPlacements: vi.fn().mockReturnValue([]),
    createPlacement: vi.fn().mockReturnValue({ id: 'pl1' }),
    listCreatives: vi.fn().mockReturnValue([]),
    listAds: vi.fn().mockReturnValue([]),
    createAd: vi.fn().mockReturnValue({ id: 'ad1' }),
    generateTags: vi.fn().mockReturnValue([]),
    getPlacement: vi.fn().mockReturnValue(null),
    getAd: vi.fn().mockReturnValue(null),
    getCreative: vi.fn().mockReturnValue(null),
    getLandingPage: vi.fn().mockReturnValue(null),
    getSite: vi.fn().mockReturnValue(null),
    listSizes: vi.fn().mockReturnValue([]),
    createCreative: vi.fn().mockReturnValue({ id: 'cr1' }),
    updateCampaign: vi.fn().mockReturnValue({ id: 'c1' }),
    updatePlacement: vi.fn().mockReturnValue({ id: 'pl1' }),
    updateAd: vi.fn().mockReturnValue({ id: 'ad1' }),
    updateCreative: vi.fn().mockReturnValue({ id: 'cr1' }),
    updateLandingPage: vi.fn().mockReturnValue({ id: 'lp1' }),
    associateCreativeCampaign: vi.fn().mockReturnValue({ campaignId: 'c1', creativeId: 'cr1' }),
    listCampaignCreativeAssociations: vi.fn().mockReturnValue([]),
    uploadCreativeAsset: vi.fn().mockReturnValue({ assetIdentifier: { name: 'test.png' } }),
  },
}));

import { CM360NotConnectedError } from '../cm360/errors.js';
import { executeTool, TOOL_ENTITY_MAP, getCacheFilter } from '../cm360/tool-executor.js';

/**
 * Helper: set up mock CM360 client methods for the live API path.
 * Configures getCM360Client to succeed and populates mockClientMethods.
 */
function setupLiveAPI(methods: Record<string, ReturnType<typeof vi.fn>>) {
  mockGetCM360Client.mockResolvedValue({} as never);
  // Clear old methods
  for (const key of Object.keys(mockClientMethods)) {
    delete mockClientMethods[key];
  }
  // Always provide a listProfiles method for resolveProfileId
  mockClientMethods.listProfiles = methods.listProfiles ?? vi.fn().mockResolvedValue([{ profileId: 'p1' }]);
  // Add provided methods
  for (const [name, fn] of Object.entries(methods)) {
    mockClientMethods[name] = fn;
  }
}

describe('session-cache-integration', () => {
  const userId = 'user-123';
  const conversationId = 'conv-456';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is not connected to CM360 -> falls back to mock
    mockGetCM360Client.mockRejectedValue(new CM360NotConnectedError());
    // Default: cache misses
    mockGetCached.mockResolvedValue(null);
    mockSetCached.mockResolvedValue(undefined);
    mockInvalidateEntity.mockResolvedValue(undefined);
    mockCheckCM360RateLimit.mockReturnValue({ allowed: true });
    // Clear mock client methods
    for (const key of Object.keys(mockClientMethods)) {
      delete mockClientMethods[key];
    }
  });

  describe('TOOL_ENTITY_MAP', () => {
    it('maps all tools except generate_tags to entity types', () => {
      const mappedTools = Object.keys(TOOL_ENTITY_MAP);
      // cm360_generate_tags is intentionally excluded
      expect(mappedTools).not.toContain('cm360_generate_tags');
      // 30 tools total - 1 (generate_tags) = 29 mapped
      expect(mappedTools.length).toBe(29);
    });

    it('maps read tools to correct entity types', () => {
      expect(TOOL_ENTITY_MAP['cm360_list_campaigns']).toBe('campaigns');
      expect(TOOL_ENTITY_MAP['cm360_get_campaign']).toBe('campaigns');
      expect(TOOL_ENTITY_MAP['cm360_list_advertisers']).toBe('advertisers');
      expect(TOOL_ENTITY_MAP['cm360_get_advertiser']).toBe('advertisers');
      expect(TOOL_ENTITY_MAP['cm360_list_placements']).toBe('placements');
      expect(TOOL_ENTITY_MAP['cm360_get_placement']).toBe('placements');
      expect(TOOL_ENTITY_MAP['cm360_list_sizes']).toBe('sizes');
      expect(TOOL_ENTITY_MAP['cm360_list_profiles']).toBe('profiles');
    });

    it('maps write tools to correct entity types', () => {
      expect(TOOL_ENTITY_MAP['cm360_create_campaign']).toBe('campaigns');
      expect(TOOL_ENTITY_MAP['cm360_update_campaign']).toBe('campaigns');
      expect(TOOL_ENTITY_MAP['cm360_create_placement']).toBe('placements');
      expect(TOOL_ENTITY_MAP['cm360_update_placement']).toBe('placements');
      expect(TOOL_ENTITY_MAP['cm360_create_ad']).toBe('ads');
      expect(TOOL_ENTITY_MAP['cm360_update_ad']).toBe('ads');
      expect(TOOL_ENTITY_MAP['cm360_upload_creative_asset']).toBe('creatives');
      expect(TOOL_ENTITY_MAP['cm360_associate_creative_campaign']).toBe('campaignCreativeAssociations');
    });
  });

  describe('getCacheFilter', () => {
    it('returns entity ID for get-by-ID tools', () => {
      expect(getCacheFilter('cm360_get_campaign', { campaignId: '123' })).toBe('campaignId=123');
      expect(getCacheFilter('cm360_get_advertiser', { advertiserId: 'adv1' })).toBe('advertiserId=adv1');
      expect(getCacheFilter('cm360_get_placement', { placementId: 'pl1' })).toBe('placementId=pl1');
      expect(getCacheFilter('cm360_get_ad', { adId: 'ad1' })).toBe('adId=ad1');
      expect(getCacheFilter('cm360_get_creative', { creativeId: 'cr1' })).toBe('creativeId=cr1');
      expect(getCacheFilter('cm360_get_landing_page', { landingPageId: 'lp1' })).toBe('landingPageId=lp1');
      expect(getCacheFilter('cm360_get_site', { siteId: 's1' })).toBe('siteId=s1');
    });

    it('returns filter params for list tools', () => {
      expect(getCacheFilter('cm360_list_campaigns', { advertiserId: 'adv1' }))
        .toBe('advertiserId=adv1');
      expect(getCacheFilter('cm360_list_campaigns', { advertiserId: 'adv1', searchString: 'test' }))
        .toBe('advertiserId=adv1&searchString=test');
      expect(getCacheFilter('cm360_list_placements', { campaignId: 'c1', advertiserId: 'adv1' }))
        .toBe('advertiserId=adv1&campaignId=c1');
    });

    it('returns undefined for list tools with no filters', () => {
      expect(getCacheFilter('cm360_list_profiles', {})).toBeUndefined();
      expect(getCacheFilter('cm360_list_advertisers', {})).toBeUndefined();
    });

    it('returns filter for list_sizes with dimensions', () => {
      // Filter fields are iterated in array order: width comes before height
      expect(getCacheFilter('cm360_list_sizes', { width: 300, height: 250 }))
        .toBe('width=300&height=250');
    });

    it('excludes null and undefined values from filter', () => {
      expect(getCacheFilter('cm360_list_campaigns', { advertiserId: null, searchString: undefined }))
        .toBeUndefined();
    });
  });

  describe('cache reads (read tools)', () => {
    it('returns cached data on cache hit, skipping API call', async () => {
      const cachedResult = { result: { campaigns: [{ id: 'c1' }] }, isError: false };
      mockGetCached.mockResolvedValue(cachedResult);

      const result = await executeTool(
        'cm360_list_campaigns',
        { profileId: 'p1', advertiserId: 'adv1' },
        userId,
        conversationId,
      );

      expect(result).toEqual(cachedResult);
      expect(mockGetCached).toHaveBeenCalledWith(userId, 'campaigns', 'advertiserId=adv1');
      // Should NOT have tried to get CM360 client (API call skipped)
      expect(mockGetCM360Client).not.toHaveBeenCalled();
    });

    it('logs audit event with dataSource=cache on cache hit', async () => {
      const cachedResult = { result: { profiles: [] }, isError: false };
      mockGetCached.mockResolvedValue(cachedResult);

      await executeTool('cm360_list_profiles', {}, userId, conversationId);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          conversationId,
          eventType: 'tool_executed',
          metadata: expect.objectContaining({
            dataSource: 'cache',
            success: true,
          }),
        }),
      );
    });

    it('does not cache results from mock fallback', async () => {
      // CM360NotConnectedError -> mock fallback -> dataSource='mock'
      const result = await executeTool(
        'cm360_list_campaigns',
        { profileId: 'p1', advertiserId: 'adv1' },
        userId,
        conversationId,
      );

      expect(result.isError).toBe(false);
      // Cache was checked (cache miss) but result should NOT be stored
      expect(mockGetCached).toHaveBeenCalled();
      expect(mockSetCached).not.toHaveBeenCalled();
    });

    it('does not cache error results from the live API', async () => {
      setupLiveAPI({
        listProfiles: vi.fn().mockRejectedValue(new Error('API error')),
      });

      const result = await executeTool('cm360_list_profiles', {}, userId, conversationId);

      expect(result.isError).toBe(true);
      expect(mockSetCached).not.toHaveBeenCalled();
    });

    it('does not check cache for tools without entity mapping (generate_tags)', async () => {
      await executeTool(
        'cm360_generate_tags',
        { profileId: 'p1', campaignId: 'c1', placementIds: ['p1'] },
        userId,
        conversationId,
      );

      expect(mockGetCached).not.toHaveBeenCalled();
    });

    it('uses entity-specific filter for get-by-ID tools', async () => {
      mockGetCached.mockResolvedValue(null);

      await executeTool(
        'cm360_get_campaign',
        { profileId: 'p1', campaignId: 'c123' },
        userId,
        conversationId,
      );

      expect(mockGetCached).toHaveBeenCalledWith(userId, 'campaigns', 'campaignId=c123');
    });
  });

  describe('cache invalidation (write tools)', () => {
    it('invalidates entity cache after successful create', async () => {
      setupLiveAPI({
        createCampaign: vi.fn().mockResolvedValue({ id: 'c-new', name: 'New' }),
      });

      await executeTool(
        'cm360_create_campaign',
        {
          profileId: 'p1',
          advertiserId: 'adv1',
          name: 'New Campaign',
          startDate: '2026-03-01',
          endDate: '2026-12-31',
          defaultLandingPageId: 'lp1',
        },
        userId,
        conversationId,
      );

      expect(mockInvalidateEntity).toHaveBeenCalledWith(userId, 'campaigns');
    });

    it('invalidates entity cache after successful update', async () => {
      setupLiveAPI({
        patchCampaign: vi.fn().mockResolvedValue({ id: 'c1', name: 'Updated' }),
      });

      await executeTool(
        'cm360_update_campaign',
        { profileId: 'p1', campaignId: 'c1', name: 'Updated' },
        userId,
        conversationId,
      );

      expect(mockInvalidateEntity).toHaveBeenCalledWith(userId, 'campaigns');
    });

    it('does not invalidate cache on write error', async () => {
      setupLiveAPI({
        createCampaign: vi.fn().mockRejectedValue(new Error('API failure')),
      });

      const result = await executeTool(
        'cm360_create_campaign',
        {
          profileId: 'p1',
          advertiserId: 'adv1',
          name: 'Bad Campaign',
          startDate: '2026-03-01',
          endDate: '2026-12-31',
          defaultLandingPageId: 'lp1',
        },
        userId,
        conversationId,
      );

      expect(result.isError).toBe(true);
      expect(mockInvalidateEntity).not.toHaveBeenCalled();
    });

    it('does not check cache for write tools', async () => {
      await executeTool(
        'cm360_create_campaign',
        {
          profileId: 'p1',
          advertiserId: 'adv1',
          name: 'New',
          startDate: '2026-03-01',
          endDate: '2026-12-31',
          defaultLandingPageId: 'lp1',
        },
        userId,
      );

      expect(mockGetCached).not.toHaveBeenCalled();
    });

    it('invalidates creatives cache when uploading creative asset', async () => {
      setupLiveAPI({
        uploadCreativeAsset: vi.fn().mockResolvedValue({ assetIdentifier: { name: 'test.png' } }),
      });

      await executeTool(
        'cm360_upload_creative_asset',
        {
          profileId: 'p1',
          advertiserId: 'adv1',
          assetName: 'test.png',
          assetType: 'IMAGE',
          assetData: 'base64data',
        },
        userId,
        conversationId,
      );

      expect(mockInvalidateEntity).toHaveBeenCalledWith(userId, 'creatives');
    });

    it('invalidates campaignCreativeAssociations on associate', async () => {
      setupLiveAPI({
        associateCreativeCampaign: vi.fn().mockResolvedValue({ campaignId: 'c1', creativeId: 'cr1' }),
      });

      await executeTool(
        'cm360_associate_creative_campaign',
        { profileId: 'p1', campaignId: 'c1', creativeId: 'cr1' },
        userId,
        conversationId,
      );

      expect(mockInvalidateEntity).toHaveBeenCalledWith(userId, 'campaignCreativeAssociations');
    });
  });

  describe('mock path bypass', () => {
    it('does not use cache when no userId is provided', async () => {
      // No userId -> executeToolMock (profileId required by Zod)
      const result = await executeTool(
        'cm360_list_campaigns',
        { profileId: 'p1', advertiserId: 'adv1' },
      );

      expect(result.isError).toBe(false);
      expect(mockGetCached).not.toHaveBeenCalled();
      expect(mockSetCached).not.toHaveBeenCalled();
    });

    it('does not cache results from mock fallback (CM360 not connected)', async () => {
      const result = await executeTool(
        'cm360_list_advertisers',
        { profileId: 'p1' },
        userId,
        conversationId,
      );

      expect(result.isError).toBe(false);
      // Cache was checked (cache miss)
      expect(mockGetCached).toHaveBeenCalled();
      // But result should NOT be stored (dataSource is 'mock')
      expect(mockSetCached).not.toHaveBeenCalled();
    });
  });

  describe('live API path caching', () => {
    it('caches successful read result from live API', async () => {
      setupLiveAPI({
        listCampaigns: vi.fn().mockResolvedValue([{ id: 'c1', name: 'Live Campaign' }]),
      });

      const result = await executeTool(
        'cm360_list_campaigns',
        { profileId: 'p1', advertiserId: 'adv1' },
        userId,
        conversationId,
      );

      expect(result.isError).toBe(false);
      expect(mockSetCached).toHaveBeenCalledWith(
        userId,
        'campaigns',
        expect.objectContaining({
          result: { campaigns: [{ id: 'c1', name: 'Live Campaign' }] },
          isError: false,
        }),
        'advertiserId=adv1',
      );
    });

    it('second call returns cached result, skipping API', async () => {
      const liveResult = {
        result: { campaigns: [{ id: 'c1', name: 'Live Campaign' }] },
        isError: false,
      };

      const listCampaignsFn = vi.fn().mockResolvedValue([{ id: 'c1', name: 'Live Campaign' }]);
      setupLiveAPI({ listCampaigns: listCampaignsFn });

      // First call: cache miss -> API call -> store
      mockGetCached.mockResolvedValueOnce(null);
      await executeTool(
        'cm360_list_campaigns',
        { profileId: 'p1', advertiserId: 'adv1' },
        userId,
      );

      // Second call: cache hit -> return cached
      mockGetCached.mockResolvedValueOnce(liveResult);
      const result2 = await executeTool(
        'cm360_list_campaigns',
        { profileId: 'p1', advertiserId: 'adv1' },
        userId,
      );

      expect(result2).toEqual(liveResult);
      // listCampaigns should have been called only once (first request)
      expect(listCampaignsFn).toHaveBeenCalledTimes(1);
    });

    it('caches get-by-ID results with entity ID as filter', async () => {
      setupLiveAPI({
        getCampaign: vi.fn().mockResolvedValue({ id: 'c1', name: 'Campaign 1' }),
      });

      await executeTool(
        'cm360_get_campaign',
        { profileId: 'p1', campaignId: 'c1' },
        userId,
      );

      expect(mockSetCached).toHaveBeenCalledWith(
        userId,
        'campaigns',
        expect.objectContaining({ isError: false }),
        'campaignId=c1',
      );
    });
  });

  describe('edge cases', () => {
    it('handles unknown tool name gracefully (no cache interaction)', async () => {
      const result = await executeTool('cm360_unknown_tool', {}, userId);

      expect(result.isError).toBe(true);
      expect(result.errorMessage).toContain('Unknown tool');
      expect(mockGetCached).not.toHaveBeenCalled();
    });

    it('treats cm360_create_ad as a write tool (not cached)', async () => {
      await executeTool(
        'cm360_create_ad',
        {
          profileId: 'p1',
          campaignId: 'c1',
          name: 'Test Ad',
          placementIds: ['p1'],
          creativeId: 'cr1',
        },
        userId,
      );

      expect(mockGetCached).not.toHaveBeenCalled();
    });

    it('does not cache "not found" results from get-by-ID tools', async () => {
      setupLiveAPI({
        getCampaign: vi.fn().mockResolvedValue(null),
      });

      const result = await executeTool(
        'cm360_get_campaign',
        { profileId: 'p1', campaignId: 'nonexistent-123' },
        userId,
      );

      expect(result.isError).toBe(true);
      expect(result.errorMessage).toContain('not found');
      expect(mockSetCached).not.toHaveBeenCalled();
    });

    it('does not cache rate-limited results', async () => {
      setupLiveAPI({});
      mockCheckCM360RateLimit.mockReturnValueOnce({
        allowed: false,
        retryAfterMs: 5000,
      });

      const result = await executeTool(
        'cm360_list_campaigns',
        { profileId: 'p1', advertiserId: 'adv1' },
        userId,
      );

      expect(result.isError).toBe(true);
      expect(result.errorMessage).toContain('rate limit');
      expect(mockSetCached).not.toHaveBeenCalled();
    });
  });
});
