import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CM360Client } from '../cm360/cm360-client.js';
import type { dfareporting_v5 } from '@googleapis/dfareporting';

// Helper to create a mock dfareporting API
function createMockApi(): dfareporting_v5.Dfareporting {
  return {
    userProfiles: {
      list: vi.fn(),
    },
    advertisers: {
      list: vi.fn(),
      get: vi.fn(),
    },
    campaigns: {
      list: vi.fn(),
      insert: vi.fn(),
    },
    sites: {
      list: vi.fn(),
    },
    advertiserLandingPages: {
      list: vi.fn(),
      insert: vi.fn(),
    },
    placements: {
      list: vi.fn(),
      insert: vi.fn(),
      generatetags: vi.fn(),
    },
    creatives: {
      list: vi.fn(),
    },
    ads: {
      list: vi.fn(),
      insert: vi.fn(),
    },
  } as unknown as dfareporting_v5.Dfareporting;
}

describe('CM360Client', () => {
  let mockApi: dfareporting_v5.Dfareporting;
  let client: CM360Client;

  beforeEach(() => {
    mockApi = createMockApi();
    client = new CM360Client(mockApi);
  });

  describe('listProfiles', () => {
    it('should map Google API response to CM360UserProfile[]', async () => {
      (mockApi.userProfiles.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          items: [
            { profileId: '111', accountId: '222', accountName: 'Test Agency', userName: 'test@test.com', etag: 'abc' },
          ],
        },
      });

      const profiles = await client.listProfiles();

      expect(profiles).toEqual([{
        profileId: '111',
        accountId: '222',
        accountName: 'Test Agency',
        userName: 'test@test.com',
        etag: 'abc',
      }]);
    });

    it('should return empty array when no profiles exist', async () => {
      (mockApi.userProfiles.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { items: undefined },
      });

      const profiles = await client.listProfiles();
      expect(profiles).toEqual([]);
    });
  });

  describe('listAdvertisers', () => {
    it('should map response and pass search params', async () => {
      (mockApi.advertisers.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          advertisers: [
            { id: '100', name: 'Acme Corp', accountId: '222', status: 'APPROVED' },
          ],
        },
      });

      const result = await client.listAdvertisers('111', { searchString: 'acme', maxResults: 10 });

      expect(result).toEqual([{
        id: '100',
        name: 'Acme Corp',
        accountId: '222',
        status: 'APPROVED',
      }]);

      expect(mockApi.advertisers.list).toHaveBeenCalledWith({
        profileId: '111',
        searchString: 'acme',
        maxResults: 10,
        sortField: 'NAME',
        sortOrder: 'ASCENDING',
      });
    });

    it('should default maxResults to 100', async () => {
      (mockApi.advertisers.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { advertisers: [] },
      });

      await client.listAdvertisers('111');

      expect(mockApi.advertisers.list).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 100 }),
      );
    });
  });

  describe('getAdvertiser', () => {
    it('should return a single advertiser', async () => {
      (mockApi.advertisers.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: '100', name: 'Acme Corp', accountId: '222', status: 'APPROVED' },
      });

      const result = await client.getAdvertiser('111', '100');
      expect(result).toEqual({
        id: '100',
        name: 'Acme Corp',
        accountId: '222',
        status: 'APPROVED',
      });
    });

    it('should return null on 404', async () => {
      (mockApi.advertisers.get as ReturnType<typeof vi.fn>).mockRejectedValue({
        code: 404,
        message: 'Not found',
      });

      const result = await client.getAdvertiser('111', '999');
      expect(result).toBeNull();
    });

    it('should rethrow non-404 errors', async () => {
      (mockApi.advertisers.get as ReturnType<typeof vi.fn>).mockRejectedValue({
        code: 500,
        message: 'Internal error',
      });

      await expect(client.getAdvertiser('111', '100')).rejects.toEqual({
        code: 500,
        message: 'Internal error',
      });
    });
  });

  describe('listCampaigns', () => {
    it('should pass advertiserId as advertiserIds array', async () => {
      (mockApi.campaigns.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { campaigns: [] },
      });

      await client.listCampaigns('111', { advertiserId: '100' });

      expect(mockApi.campaigns.list).toHaveBeenCalledWith(
        expect.objectContaining({ advertiserIds: ['100'] }),
      );
    });

    it('should map campaign response with defaultLandingPage nesting', async () => {
      (mockApi.campaigns.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          campaigns: [{
            id: '500',
            name: 'Q1 Campaign',
            accountId: '222',
            advertiserId: '100',
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            defaultLandingPage: { id: '300' },
            archived: false,
          }],
        },
      });

      const result = await client.listCampaigns('111');
      expect(result).toEqual([{
        id: '500',
        name: 'Q1 Campaign',
        accountId: '222',
        advertiserId: '100',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        defaultLandingPageId: '300',
        archived: false,
      }]);
    });
  });

  describe('createCampaign', () => {
    it('should nest defaultLandingPageId in requestBody', async () => {
      (mockApi.campaigns.insert as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: '501',
          name: 'New Campaign',
          accountId: '222',
          advertiserId: '100',
          startDate: '2026-04-01',
          endDate: '2026-06-30',
          defaultLandingPage: { id: '300' },
          archived: false,
        },
      });

      const result = await client.createCampaign('111', {
        advertiserId: '100',
        name: 'New Campaign',
        startDate: '2026-04-01',
        endDate: '2026-06-30',
        defaultLandingPageId: '300',
      });

      expect(mockApi.campaigns.insert).toHaveBeenCalledWith({
        profileId: '111',
        requestBody: {
          advertiserId: '100',
          name: 'New Campaign',
          startDate: '2026-04-01',
          endDate: '2026-06-30',
          defaultLandingPageId: '300',
        },
      });

      expect(result.id).toBe('501');
      expect(result.defaultLandingPageId).toBe('300');
    });
  });

  describe('listPlacements', () => {
    it('should pass campaignId as campaignIds array', async () => {
      (mockApi.placements.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { placements: [] },
      });

      await client.listPlacements('111', { campaignId: '500', advertiserId: '100' });

      expect(mockApi.placements.list).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignIds: ['500'],
          advertiserIds: ['100'],
        }),
      );
    });
  });

  describe('createPlacement', () => {
    it('should structure requestBody with nested size and pricingSchedule', async () => {
      (mockApi.placements.insert as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: '700',
          name: '728x90 Banner',
          accountId: '222',
          advertiserId: '100',
          campaignId: '500',
          siteId: '400',
          size: { id: '1', width: 728, height: 90, iab: true },
          status: 'DRAFT',
          pricingSchedule: { startDate: '2026-01-01', endDate: '2026-03-31' },
          tagFormats: ['PLACEMENT_TAG_STANDARD'],
        },
      });

      await client.createPlacement('111', {
        campaignId: '500',
        siteId: '400',
        name: '728x90 Banner',
        size: { width: 728, height: 90 },
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      });

      expect(mockApi.placements.insert).toHaveBeenCalledWith({
        profileId: '111',
        requestBody: expect.objectContaining({
          campaignId: '500',
          siteId: '400',
          name: '728x90 Banner',
          size: { width: 728, height: 90 },
          pricingSchedule: {
            startDate: '2026-01-01',
            endDate: '2026-03-31',
          },
        }),
      });
    });
  });

  describe('generateTags', () => {
    it('should call placements.generatetags (lowercase t)', async () => {
      (mockApi.placements.generatetags as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          placementTags: [{
            placementId: '700',
            tagDatas: [{
              format: 'PLACEMENT_TAG_STANDARD',
              impressionTag: '<script>imp</script>',
              clickTag: 'https://click.example.com',
            }],
          }],
        },
      });

      const result = await client.generateTags('111', '500', ['700']);

      expect(mockApi.placements.generatetags).toHaveBeenCalledWith({
        profileId: '111',
        campaignId: '500',
        placementIds: ['700'],
      });

      expect(result).toEqual([{
        placementId: '700',
        tagData: [{
          format: 'PLACEMENT_TAG_STANDARD',
          impressionTag: '<script>imp</script>',
          clickTag: 'https://click.example.com',
        }],
      }]);
    });
  });

  describe('ID type coercion', () => {
    it('should coerce numeric IDs to strings', async () => {
      (mockApi.advertisers.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          advertisers: [
            // Google SDK often returns IDs as numbers
            { id: 100 as unknown as string, name: 'Test', accountId: 222 as unknown as string, status: 'APPROVED' },
          ],
        },
      });

      const result = await client.listAdvertisers('111');
      expect(result[0]!.id).toBe('100');
      expect(result[0]!.accountId).toBe('222');
    });
  });

  describe('null/undefined handling', () => {
    it('should default null fields to empty strings', async () => {
      (mockApi.advertisers.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          advertisers: [
            { id: '100', name: null, accountId: '222', status: null },
          ],
        },
      });

      const result = await client.listAdvertisers('111');
      expect(result[0]!.name).toBe('');
      expect(result[0]!.status).toBe('APPROVED'); // Default for null status
    });
  });
});
