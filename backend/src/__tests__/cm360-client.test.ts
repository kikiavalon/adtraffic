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
      patch: vi.fn(),
    },
    creatives: {
      list: vi.fn(),
    },
    ads: {
      list: vi.fn(),
      insert: vi.fn(),
      get: vi.fn(),
      patch: vi.fn(),
    },
    eventTags: {
      list: vi.fn(),
      get: vi.fn(),
      insert: vi.fn(),
      patch: vi.fn(),
    },
    placementGroups: {
      list: vi.fn(),
      get: vi.fn(),
      insert: vi.fn(),
      patch: vi.fn(),
    },
    directorySites: {
      list: vi.fn(),
      get: vi.fn(),
      insert: vi.fn(),
    },
    changeLogs: {
      list: vi.fn(),
      get: vi.fn(),
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

  describe('click-through URLs and suffixes', () => {
    it('mapAd carries clickThroughUrl and suffix fields from an API-shaped ad', async () => {
      (mockApi.ads.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          ads: [{
            id: 900,
            name: 'CT Ad',
            campaignId: 500,
            advertiserId: 100,
            type: 'AD_SERVING_STANDARD_AD',
            active: true,
            archived: false,
            placementAssignments: [{ placementId: 700 }],
            creativeRotation: {
              type: 'CREATIVE_ROTATION_TYPE_RANDOM',
              creativeAssignments: [{
                creativeId: 800,
                clickThroughUrl: {
                  defaultLandingPage: false,
                  landingPageId: 300,
                  customClickThroughUrl: undefined,
                  computedClickThroughUrl: 'https://landing.example.com/?utm_source=cm360',
                },
              }],
            },
            clickThroughUrlSuffixProperties: {
              clickThroughUrlSuffix: 'utm_content=ad-level',
              overrideInheritedSuffix: true,
            },
          }],
        },
      });

      const ads = await client.listAds('111');
      const assignment = ads[0]!.creativeRotation.creativeAssignments[0]!;
      expect(assignment.creativeId).toBe('800');
      expect(assignment.clickThroughUrl).toEqual({
        defaultLandingPage: false,
        landingPageId: '300',
        customClickThroughUrl: undefined,
        computedClickThroughUrl: 'https://landing.example.com/?utm_source=cm360',
      });
      expect(ads[0]!.clickThroughUrlSuffixProperties).toEqual({
        clickThroughUrlSuffix: 'utm_content=ad-level',
        overrideInheritedSuffix: true,
      });
    });

    it('createAd puts a landingPageId clickThroughUrl on the creative assignment', async () => {
      (mockApi.ads.insert as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: '901', name: 'New Ad', campaignId: '500' },
      });

      await client.createAd('111', {
        campaignId: '500',
        name: 'New Ad',
        placementIds: ['700'],
        creativeId: '800',
        landingPageId: '300',
      });

      expect(mockApi.ads.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            creativeRotation: expect.objectContaining({
              creativeAssignments: [{
                creativeId: '800',
                active: true,
                clickThroughUrl: { landingPageId: '300' },
              }],
            }),
          }),
        }),
      );
    });

    it('createAd puts a customClickThroughUrl on the creative assignment', async () => {
      (mockApi.ads.insert as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: '902', name: 'New Ad', campaignId: '500' },
      });

      await client.createAd('111', {
        campaignId: '500',
        name: 'New Ad',
        placementIds: ['700'],
        creativeId: '800',
        customClickThroughUrl: 'https://example.com/promo',
      });

      expect(mockApi.ads.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            creativeRotation: expect.objectContaining({
              creativeAssignments: [{
                creativeId: '800',
                active: true,
                clickThroughUrl: { customClickThroughUrl: 'https://example.com/promo' },
              }],
            }),
          }),
        }),
      );
    });

    it('createAd defaults to the campaign default landing page when neither field given', async () => {
      (mockApi.ads.insert as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: '903', name: 'New Ad', campaignId: '500' },
      });

      await client.createAd('111', {
        campaignId: '500',
        name: 'New Ad',
        placementIds: ['700'],
        creativeId: '800',
      });

      expect(mockApi.ads.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            creativeRotation: expect.objectContaining({
              creativeAssignments: [{
                creativeId: '800',
                active: true,
                clickThroughUrl: { defaultLandingPage: true },
              }],
            }),
          }),
        }),
      );
    });

    it('patchAd with only landingPageId gets the ad first and preserves the existing creative assignment', async () => {
      (mockApi.ads.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          id: '900',
          creativeRotation: {
            type: 'CREATIVE_ROTATION_TYPE_RANDOM',
            creativeAssignments: [{
              creativeId: '800',
              active: true,
              clickThroughUrl: { defaultLandingPage: true },
            }],
          },
        },
      });
      (mockApi.ads.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: '900', name: 'Patched Ad', campaignId: '500' },
      });

      await client.patchAd('111', '900', { landingPageId: '300' });

      expect(mockApi.ads.get).toHaveBeenCalledWith({ profileId: '111', id: '900' });
      expect(mockApi.ads.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: '111',
          id: '900',
          requestBody: expect.objectContaining({
            creativeRotation: expect.objectContaining({
              creativeAssignments: [
                expect.objectContaining({
                  creativeId: '800',
                  clickThroughUrl: { landingPageId: '300' },
                }),
              ],
            }),
          }),
        }),
      );
    });

    it('patchAd without click-through or creative changes does not call ads.get', async () => {
      (mockApi.ads.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: '900', name: 'Renamed Ad', campaignId: '500' },
      });

      await client.patchAd('111', '900', { name: 'Renamed Ad' });

      expect(mockApi.ads.get).not.toHaveBeenCalled();
      expect(mockApi.ads.patch).toHaveBeenCalledWith(
        expect.objectContaining({ requestBody: { name: 'Renamed Ad' } }),
      );
    });

    it('mapCampaign maps clickThroughUrlSuffixProperties', async () => {
      (mockApi.campaigns.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          campaigns: [{
            id: '500',
            name: 'Suffix Campaign',
            accountId: '222',
            advertiserId: '100',
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            defaultLandingPage: { id: '300' },
            archived: false,
            clickThroughUrlSuffixProperties: {
              clickThroughUrlSuffix: 'utm_content=campaign-level',
              overrideInheritedSuffix: true,
            },
          }],
        },
      });

      const result = await client.listCampaigns('111');
      expect(result[0]!.clickThroughUrlSuffixProperties).toEqual({
        clickThroughUrlSuffix: 'utm_content=campaign-level',
        overrideInheritedSuffix: true,
      });
    });

    it('mapAdvertiser maps clickThroughUrlSuffix', async () => {
      (mockApi.advertisers.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          advertisers: [{
            id: '100',
            name: 'Acme Corp',
            accountId: '222',
            status: 'APPROVED',
            clickThroughUrlSuffix: 'utm_content=adv-level',
          }],
        },
      });

      const result = await client.listAdvertisers('111');
      expect(result[0]!.clickThroughUrlSuffix).toBe('utm_content=adv-level');
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

  describe('event tags', () => {
    describe('listEventTags', () => {
      it('should pass campaign/advertiser/search params and map to CM360EventTag[]', async () => {
        (mockApi.eventTags.list as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: {
            eventTags: [{
              id: 600,
              accountId: 222,
              advertiserId: 100,
              campaignId: 500,
              name: 'Impression Pixel',
              url: 'https://pixel.example.com/imp',
              type: 'IMPRESSION_IMAGE_EVENT_TAG',
              status: 'ENABLED',
              siteIds: [400, 401],
              enabledByDefault: true,
              excludeFromAdxRequests: false,
              sslCompliant: true,
            }],
          },
        });

        const result = await client.listEventTags('111', '500', {
          advertiserId: '100',
          searchString: 'pixel',
        });

        expect(mockApi.eventTags.list).toHaveBeenCalledWith({
          profileId: '111',
          campaignId: '500',
          advertiserId: '100',
          searchString: 'pixel',
        });

        expect(result).toEqual([{
          id: '600',
          accountId: '222',
          advertiserId: '100',
          campaignId: '500',
          name: 'Impression Pixel',
          url: 'https://pixel.example.com/imp',
          type: 'IMPRESSION_IMAGE_EVENT_TAG',
          status: 'ENABLED',
          siteIds: ['400', '401'],
          enabledByDefault: true,
          excludeFromAdxRequests: false,
          sslCompliant: true,
        }]);
      });

      it('should return empty array when no event tags exist', async () => {
        (mockApi.eventTags.list as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: { eventTags: undefined },
        });

        const result = await client.listEventTags('111', '500');
        expect(result).toEqual([]);
      });
    });

    describe('getEventTag', () => {
      it('should get a single event tag by id and map it', async () => {
        (mockApi.eventTags.get as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: {
            id: '600',
            accountId: '222',
            advertiserId: '100',
            campaignId: '500',
            name: 'Impression Pixel',
            url: 'https://pixel.example.com/imp',
            type: 'IMPRESSION_IMAGE_EVENT_TAG',
            status: 'ENABLED',
            siteIds: [],
            enabledByDefault: false,
            excludeFromAdxRequests: false,
            sslCompliant: true,
          },
        });

        const result = await client.getEventTag('111', '600');

        expect(mockApi.eventTags.get).toHaveBeenCalledWith({ profileId: '111', id: '600' });
        expect(result).toEqual({
          id: '600',
          accountId: '222',
          advertiserId: '100',
          campaignId: '500',
          name: 'Impression Pixel',
          url: 'https://pixel.example.com/imp',
          type: 'IMPRESSION_IMAGE_EVENT_TAG',
          status: 'ENABLED',
          siteIds: [],
          enabledByDefault: false,
          excludeFromAdxRequests: false,
          sslCompliant: true,
        });
      });

      it('should return null on 404', async () => {
        (mockApi.eventTags.get as ReturnType<typeof vi.fn>).mockRejectedValue({
          code: 404,
          message: 'Not found',
        });

        const result = await client.getEventTag('111', '999');
        expect(result).toBeNull();
      });

      it('should rethrow non-404 errors', async () => {
        (mockApi.eventTags.get as ReturnType<typeof vi.fn>).mockRejectedValue({
          code: 500,
          message: 'Internal error',
        });

        await expect(client.getEventTag('111', '600')).rejects.toEqual({
          code: 500,
          message: 'Internal error',
        });
      });
    });

    describe('createEventTag', () => {
      it('should send the requestBody fields and map the response', async () => {
        (mockApi.eventTags.insert as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: {
            id: '601',
            accountId: '222',
            advertiserId: '100',
            campaignId: '500',
            name: 'Click Tracker',
            url: 'https://track.example.com/click',
            type: 'CLICK_THROUGH_EVENT_TAG',
            status: 'ENABLED',
            siteIds: ['400'],
            enabledByDefault: true,
            excludeFromAdxRequests: false,
            sslCompliant: true,
          },
        });

        const result = await client.createEventTag('111', {
          advertiserId: '100',
          campaignId: '500',
          name: 'Click Tracker',
          url: 'https://track.example.com/click',
          type: 'CLICK_THROUGH_EVENT_TAG',
          siteIds: ['400'],
          enabledByDefault: true,
        });

        expect(mockApi.eventTags.insert).toHaveBeenCalledWith({
          profileId: '111',
          requestBody: {
            advertiserId: '100',
            campaignId: '500',
            name: 'Click Tracker',
            url: 'https://track.example.com/click',
            type: 'CLICK_THROUGH_EVENT_TAG',
            siteIds: ['400'],
            enabledByDefault: true,
          },
        });

        expect(result.id).toBe('601');
        expect(result.type).toBe('CLICK_THROUGH_EVENT_TAG');
      });
    });

    describe('updateEventTag', () => {
      it('should patch only the provided fields and map the response', async () => {
        (mockApi.eventTags.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: {
            id: '600',
            accountId: '222',
            advertiserId: '100',
            campaignId: '500',
            name: 'Renamed Pixel',
            url: 'https://pixel.example.com/imp',
            type: 'IMPRESSION_IMAGE_EVENT_TAG',
            status: 'DISABLED',
            siteIds: [],
            enabledByDefault: false,
            excludeFromAdxRequests: false,
            sslCompliant: true,
          },
        });

        const result = await client.updateEventTag('111', '600', {
          name: 'Renamed Pixel',
          status: 'DISABLED',
        });

        expect(mockApi.eventTags.patch).toHaveBeenCalledWith({
          profileId: '111',
          id: '600',
          requestBody: {
            name: 'Renamed Pixel',
            status: 'DISABLED',
          },
        });

        expect(result.name).toBe('Renamed Pixel');
        expect(result.status).toBe('DISABLED');
      });
    });
  });

  describe('placement groups', () => {
    const apiPlacementGroup = {
      id: 700,
      accountId: 222,
      advertiserId: 100,
      campaignId: 500,
      siteId: 400,
      name: 'Homepage Roadblock',
      placementGroupType: 'PLACEMENT_ROADBLOCK',
      childPlacementIds: [800, 801],
      activeStatus: 'ACTIVE',
      pricingSchedule: { startDate: '2026-01-01', endDate: '2026-03-31' },
    };

    const mappedPlacementGroup = {
      id: '700',
      name: 'Homepage Roadblock',
      accountId: '222',
      advertiserId: '100',
      campaignId: '500',
      siteId: '400',
      placementGroupType: 'PLACEMENT_ROADBLOCK',
      placementIds: ['800', '801'],
      activeStatus: 'ACTIVE',
      pricingSchedule: { startDate: '2026-01-01', endDate: '2026-03-31' },
    };

    describe('listPlacementGroups', () => {
      it('should pass campaignId positionally plus advertiser/search options and map to CM360PlacementGroup[]', async () => {
        (mockApi.placementGroups.list as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: { placementGroups: [apiPlacementGroup] },
        });

        const result = await client.listPlacementGroups('111', '500', {
          advertiserId: '100',
          searchString: 'road',
        });

        expect(mockApi.placementGroups.list).toHaveBeenCalledWith({
          profileId: '111',
          campaignIds: ['500'],
          advertiserIds: ['100'],
          searchString: 'road',
          maxResults: 100,
          sortField: 'NAME',
          sortOrder: 'ASCENDING',
        });

        expect(result).toEqual([mappedPlacementGroup]);
      });

      it('should return empty array when no placement groups exist', async () => {
        (mockApi.placementGroups.list as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: { placementGroups: undefined },
        });

        const result = await client.listPlacementGroups('111', '500');
        expect(result).toEqual([]);
        expect(mockApi.placementGroups.list).toHaveBeenCalledWith({
          profileId: '111',
          campaignIds: ['500'],
          advertiserIds: undefined,
          searchString: undefined,
          maxResults: 100,
          sortField: 'NAME',
          sortOrder: 'ASCENDING',
        });
      });
    });

    describe('getPlacementGroup', () => {
      it('should get a single placement group by id and map it', async () => {
        (mockApi.placementGroups.get as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: apiPlacementGroup,
        });

        const result = await client.getPlacementGroup('111', '700');

        expect(mockApi.placementGroups.get).toHaveBeenCalledWith({ profileId: '111', id: '700' });
        expect(result).toEqual(mappedPlacementGroup);
      });

      it('should return null on 404', async () => {
        (mockApi.placementGroups.get as ReturnType<typeof vi.fn>).mockRejectedValue({
          code: 404,
          message: 'Not found',
        });

        const result = await client.getPlacementGroup('111', '999');
        expect(result).toBeNull();
      });

      it('should rethrow non-404 errors', async () => {
        (mockApi.placementGroups.get as ReturnType<typeof vi.fn>).mockRejectedValue({
          code: 500,
          message: 'Internal error',
        });

        await expect(client.getPlacementGroup('111', '700')).rejects.toEqual({
          code: 500,
          message: 'Internal error',
        });
      });
    });

    describe('createPlacementGroup', () => {
      it('should send campaign/site/name/type/pricingSchedule and NOT the read-only childPlacementIds', async () => {
        (mockApi.placementGroups.insert as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: apiPlacementGroup,
        });

        const result = await client.createPlacementGroup('111', {
          campaignId: '500',
          siteId: '400',
          name: 'Homepage Roadblock',
          placementGroupType: 'PLACEMENT_ROADBLOCK',
          placementIds: ['800', '801'],
          startDate: '2026-01-01',
          endDate: '2026-03-31',
        });

        // childPlacementIds is OUTPUT-ONLY — membership is set per-placement, not in the group body.
        expect(mockApi.placementGroups.insert).toHaveBeenCalledWith({
          profileId: '111',
          requestBody: {
            campaignId: '500',
            siteId: '400',
            name: 'Homepage Roadblock',
            placementGroupType: 'PLACEMENT_ROADBLOCK',
            pricingSchedule: {
              startDate: '2026-01-01',
              endDate: '2026-03-31',
            },
          },
        });
        const insertBody = (mockApi.placementGroups.insert as ReturnType<typeof vi.fn>).mock.calls[0]![0].requestBody;
        expect(insertBody).not.toHaveProperty('childPlacementIds');

        expect(result).toEqual(mappedPlacementGroup);
      });
    });

    describe('updatePlacementGroup', () => {
      it('should patch only group-level fields and NOT write the read-only childPlacementIds', async () => {
        (mockApi.placementGroups.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: { ...apiPlacementGroup, name: 'Renamed Roadblock' },
        });

        const result = await client.updatePlacementGroup('111', '700', {
          name: 'Renamed Roadblock',
          placementIds: ['800'],
        });

        // Only name goes to the group patch; placementIds must NOT become childPlacementIds.
        expect(mockApi.placementGroups.patch).toHaveBeenCalledWith({
          profileId: '111',
          id: '700',
          requestBody: {
            name: 'Renamed Roadblock',
          },
        });
        const patchBody = (mockApi.placementGroups.patch as ReturnType<typeof vi.fn>).mock.calls[0]![0].requestBody;
        expect(patchBody).not.toHaveProperty('childPlacementIds');

        expect(result.name).toBe('Renamed Roadblock');
      });
    });

    describe('setPlacementGroup', () => {
      it('should patch the placement with the placementGroupId and resolve void', async () => {
        (mockApi.placements.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });

        const result = await client.setPlacementGroup('111', '800', '700');

        expect(mockApi.placements.patch).toHaveBeenCalledWith({
          profileId: '111',
          id: '800',
          requestBody: { placementGroupId: '700' },
        });
        expect(result).toBeUndefined();
      });

      it('should pass null through to clear the placement group', async () => {
        (mockApi.placements.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });

        await client.setPlacementGroup('111', '800', null);

        expect(mockApi.placements.patch).toHaveBeenCalledWith({
          profileId: '111',
          id: '800',
          requestBody: { placementGroupId: null },
        });
      });
    });
  });

  describe('directory sites', () => {
    const apiDirectorySite = {
      id: '900',
      name: 'BuzzFeed',
      url: 'https://www.buzzfeed.com',
      active: true,
      interstitialTagFormats: ['STANDARD', 'JAVASCRIPT_INPAGE'],
      inpageTagFormats: ['STANDARD', 'IFRAME_JAVASCRIPT_INPAGE'],
    };

    describe('listDirectorySites', () => {
      it('should list directory sites and map them to the inline shape', async () => {
        (mockApi.directorySites.list as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: { directorySites: [apiDirectorySite] },
        });

        const result = await client.listDirectorySites('111', { searchString: 'buzz', active: true });

        expect(mockApi.directorySites.list).toHaveBeenCalledWith({
          profileId: '111',
          searchString: 'buzz',
          active: true,
        });
        expect(result).toEqual([
          {
            id: '900',
            name: 'BuzzFeed',
            url: 'https://www.buzzfeed.com',
            active: true,
            interstitialTagFormats: ['STANDARD', 'JAVASCRIPT_INPAGE'],
            inpageTagFormats: ['STANDARD', 'IFRAME_JAVASCRIPT_INPAGE'],
          },
        ]);
      });

      it('should round-trip tag formats as plain strings (not collapse to a fallback)', async () => {
        (mockApi.directorySites.list as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: { directorySites: [apiDirectorySite] },
        });

        const result = await client.listDirectorySites('111');

        // This is the B1 regression guard: the real API returns string[], not objects.
        expect(result[0]!.interstitialTagFormats).toEqual(['STANDARD', 'JAVASCRIPT_INPAGE']);
        expect(result[0]!.inpageTagFormats).toEqual(['STANDARD', 'IFRAME_JAVASCRIPT_INPAGE']);
      });

      it('should handle an empty directory site list', async () => {
        (mockApi.directorySites.list as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: { directorySites: undefined },
        });

        const result = await client.listDirectorySites('111');

        expect(mockApi.directorySites.list).toHaveBeenCalledWith({ profileId: '111' });
        expect(result).toEqual([]);
      });
    });

    describe('getDirectorySite', () => {
      it('should get a directory site by ID', async () => {
        (mockApi.directorySites.get as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: apiDirectorySite,
        });

        const result = await client.getDirectorySite('111', '900');

        expect(mockApi.directorySites.get).toHaveBeenCalledWith({ profileId: '111', id: '900' });
        expect(result).toEqual({
          id: '900',
          name: 'BuzzFeed',
          url: 'https://www.buzzfeed.com',
          active: true,
          interstitialTagFormats: ['STANDARD', 'JAVASCRIPT_INPAGE'],
          inpageTagFormats: ['STANDARD', 'IFRAME_JAVASCRIPT_INPAGE'],
        });
      });

      it('should return null when the directory site is not found (404)', async () => {
        (mockApi.directorySites.get as ReturnType<typeof vi.fn>).mockRejectedValue({
          code: 404,
          message: 'Not found',
        });

        const result = await client.getDirectorySite('111', 'missing');

        expect(result).toBeNull();
      });

      it('should rethrow non-404 errors', async () => {
        (mockApi.directorySites.get as ReturnType<typeof vi.fn>).mockRejectedValue({
          code: 500,
          message: 'Server error',
        });

        await expect(client.getDirectorySite('111', '900')).rejects.toMatchObject({ code: 500 });
      });
    });

    describe('insertDirectorySite', () => {
      it('should insert a directory site and map the result through the inline shape', async () => {
        (mockApi.directorySites.insert as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: apiDirectorySite,
        });

        const result = await client.insertDirectorySite('111', '900');

        expect(mockApi.directorySites.insert).toHaveBeenCalledWith({
          profileId: '111',
          requestBody: { id: '900' },
        });
        expect(result).toEqual({
          id: '900',
          name: 'BuzzFeed',
          url: 'https://www.buzzfeed.com',
          active: true,
          interstitialTagFormats: ['STANDARD', 'JAVASCRIPT_INPAGE'],
          inpageTagFormats: ['STANDARD', 'IFRAME_JAVASCRIPT_INPAGE'],
        });
      });
    });
  });

  describe('change logs', () => {
    const apiChangeLog = {
      id: '1000',
      userProfileId: '55',
      userProfileName: 'Trafficker One',
      objectType: 'OBJECT_PLACEMENT',
      objectId: '800',
      action: 'ACTION_UPDATE',
      fieldName: 'name',
      oldValue: 'Old Name',
      newValue: 'New Name',
      changeTime: '2026-03-01T12:00:00Z',
    };

    describe('listChangeLogs', () => {
      it('should list change logs with filters mapped to the real param names', async () => {
        (mockApi.changeLogs.list as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: { changeLogs: [apiChangeLog] },
        });

        const result = await client.listChangeLogs('111', {
          objectType: 'OBJECT_PLACEMENT',
          objectId: '800',
          action: 'ACTION_UPDATE',
          minChangeTime: '2026-01-01T00:00:00Z',
          maxChangeTime: '2026-12-31T23:59:59Z',
          searchString: 'name',
          maxResults: 10,
        });

        expect(mockApi.changeLogs.list).toHaveBeenCalledWith({
          profileId: '111',
          objectType: 'OBJECT_PLACEMENT',
          objectIds: ['800'],
          action: 'ACTION_UPDATE',
          minChangeTime: '2026-01-01T00:00:00Z',
          maxChangeTime: '2026-12-31T23:59:59Z',
          searchString: 'name',
          maxResults: 10,
        });
        expect(result).toEqual([
          {
            id: '1000',
            userProfileId: '55',
            userProfileName: 'Trafficker One',
            objectType: 'OBJECT_PLACEMENT',
            objectId: '800',
            action: 'ACTION_UPDATE',
            fieldName: 'name',
            oldValue: 'Old Name',
            newValue: 'New Name',
            changeTime: '2026-03-01T12:00:00Z',
          },
        ]);
      });

      it('should handle an empty change log list', async () => {
        (mockApi.changeLogs.list as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: { changeLogs: undefined },
        });

        const result = await client.listChangeLogs('111');

        expect(result).toEqual([]);
      });
    });

    describe('getChangeLog', () => {
      it('should get a change log by ID', async () => {
        (mockApi.changeLogs.get as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: apiChangeLog,
        });

        const result = await client.getChangeLog('111', '1000');

        expect(mockApi.changeLogs.get).toHaveBeenCalledWith({ profileId: '111', id: '1000' });
        expect(result).toMatchObject({ id: '1000', objectId: '800', action: 'ACTION_UPDATE' });
      });

      it('should return null when the change log is not found (404)', async () => {
        (mockApi.changeLogs.get as ReturnType<typeof vi.fn>).mockRejectedValue({
          code: 404,
          message: 'Not found',
        });

        const result = await client.getChangeLog('111', 'missing');

        expect(result).toBeNull();
      });
    });
  });
});
