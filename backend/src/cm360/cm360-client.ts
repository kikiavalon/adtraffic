/**
 * CM360 Client — wraps @googleapis/dfareporting with type mapping to our CM360* shared types.
 *
 * This class isolates all Google SDK quirks:
 *   - Parameter name mismatches (advertiserId → advertiserIds array)
 *   - Nested object patterns (defaultLandingPageId → defaultLandingPage.id)
 *   - Nullable ID coercion (string | null | undefined → string)
 *   - Date format handling (YYYY-MM-DD)
 *   - Error normalization (GaxiosError → CM360APIError)
 *
 * The mock data store (mock-data-store.ts) and this client both return
 * the same CM360* types from @adtraffic/shared — allowing seamless fallback.
 */

import type { dfareporting_v5 } from '@googleapis/dfareporting';
import type {
  CM360UserProfile,
  CM360Advertiser,
  CM360Campaign,
  CM360CreateCampaignInput,
  CM360Site,
  CM360LandingPage,
  CM360CreateLandingPageInput,
  CM360Placement,
  CM360CreatePlacementInput,
  CM360Creative,
  CM360Ad,
  CM360PlacementTag,
  CM360AdvertiserStatus,
  CM360PlacementStatus,
  CM360PlacementActiveStatus,
  CM360TagFormat,
  CM360CreativeType,
  CM360UpdateCampaignInput,
  CM360UpdateLandingPageInput,
  CM360UpdatePlacementInput,
  CM360UpdateCreativeInput,
  CM360UpdateAdInput,
} from '@adtraffic/shared';
import { isGoogleAPIError } from './errors.js';

export class CM360Client {
  constructor(private api: dfareporting_v5.Dfareporting) {}

  // ---------- User Profiles ----------

  async listProfiles(): Promise<CM360UserProfile[]> {
    const res = await this.api.userProfiles.list();
    return (res.data.items ?? []).map(p => ({
      profileId: String(p.profileId ?? ''),
      accountId: String(p.accountId ?? ''),
      accountName: p.accountName ?? '',
      userName: p.userName ?? '',
      etag: p.etag ?? '',
    }));
  }

  // ---------- Advertisers ----------

  async listAdvertisers(
    profileId: string,
    opts?: { searchString?: string; maxResults?: number },
  ): Promise<CM360Advertiser[]> {
    const res = await this.api.advertisers.list({
      profileId,
      searchString: opts?.searchString,
      maxResults: opts?.maxResults ?? 100,
      sortField: 'NAME',
      sortOrder: 'ASCENDING',
    });
    return (res.data.advertisers ?? []).map(a => mapAdvertiser(a));
  }

  async getAdvertiser(profileId: string, advertiserId: string): Promise<CM360Advertiser | null> {
    try {
      const res = await this.api.advertisers.get({ profileId, id: advertiserId });
      if (!res.data) return null;
      return mapAdvertiser(res.data);
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  // ---------- Campaigns ----------

  async listCampaigns(
    profileId: string,
    opts?: { advertiserId?: string; searchString?: string; maxResults?: number },
  ): Promise<CM360Campaign[]> {
    const res = await this.api.campaigns.list({
      profileId,
      advertiserIds: opts?.advertiserId ? [opts.advertiserId] : undefined,
      searchString: opts?.searchString,
      maxResults: opts?.maxResults ?? 100,
    });
    return (res.data.campaigns ?? []).map(c => mapCampaign(c));
  }

  async createCampaign(
    profileId: string,
    input: CM360CreateCampaignInput,
  ): Promise<CM360Campaign> {
    const res = await this.api.campaigns.insert({
      profileId,
      requestBody: {
        advertiserId: input.advertiserId,
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        defaultLandingPageId: input.defaultLandingPageId,
      },
    });
    return mapCampaign(res.data);
  }

  async getCampaign(profileId: string, campaignId: string): Promise<CM360Campaign | null> {
    try {
      const res = await this.api.campaigns.get({ profileId, id: campaignId });
      if (!res.data) return null;
      return mapCampaign(res.data);
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  async patchCampaign(profileId: string, campaignId: string, input: CM360UpdateCampaignInput): Promise<CM360Campaign> {
    const res = await this.api.campaigns.patch({
      profileId,
      id: campaignId,
      requestBody: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.startDate !== undefined && { startDate: input.startDate }),
        ...(input.endDate !== undefined && { endDate: input.endDate }),
        ...(input.archived !== undefined && { archived: input.archived }),
        ...(input.defaultLandingPageId !== undefined && { defaultLandingPageId: input.defaultLandingPageId }),
      },
    });
    return mapCampaign(res.data);
  }

  // ---------- Sites ----------

  async listSites(
    profileId: string,
    opts?: { searchString?: string; maxResults?: number },
  ): Promise<CM360Site[]> {
    const res = await this.api.sites.list({
      profileId,
      searchString: opts?.searchString,
      maxResults: opts?.maxResults ?? 100,
    });
    return (res.data.sites ?? []).map(s => ({
      id: String(s.id ?? ''),
      name: s.name ?? '',
      accountId: String(s.accountId ?? ''),
      approved: s.approved ?? false,
      directorySiteId: s.directorySiteId ? String(s.directorySiteId) : undefined,
    }));
  }

  // ---------- Landing Pages ----------

  async listLandingPages(
    profileId: string,
    opts?: { advertiserId?: string; searchString?: string; maxResults?: number },
  ): Promise<CM360LandingPage[]> {
    const res = await this.api.advertiserLandingPages.list({
      profileId,
      advertiserIds: opts?.advertiserId ? [opts.advertiserId] : undefined,
      searchString: opts?.searchString,
      maxResults: opts?.maxResults ?? 100,
    });
    return (res.data.landingPages ?? []).map(lp => ({
      id: String(lp.id ?? ''),
      name: lp.name ?? '',
      advertiserId: String(lp.advertiserId ?? ''),
      url: lp.url ?? '',
      archived: lp.archived ?? false,
    }));
  }

  async createLandingPage(
    profileId: string,
    input: CM360CreateLandingPageInput,
  ): Promise<CM360LandingPage> {
    const res = await this.api.advertiserLandingPages.insert({
      profileId,
      requestBody: {
        advertiserId: input.advertiserId,
        name: input.name,
        url: input.url,
      },
    });
    return {
      id: String(res.data.id ?? ''),
      name: res.data.name ?? '',
      advertiserId: String(res.data.advertiserId ?? ''),
      url: res.data.url ?? '',
      archived: res.data.archived ?? false,
    };
  }

  async patchLandingPage(profileId: string, landingPageId: string, input: CM360UpdateLandingPageInput): Promise<CM360LandingPage> {
    const res = await this.api.advertiserLandingPages.patch({
      profileId,
      id: landingPageId,
      requestBody: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.url !== undefined && { url: input.url }),
        ...(input.archived !== undefined && { archived: input.archived }),
      },
    });
    return {
      id: String(res.data.id ?? ''),
      name: res.data.name ?? '',
      advertiserId: String(res.data.advertiserId ?? ''),
      url: res.data.url ?? '',
      archived: res.data.archived ?? false,
    };
  }

  // ---------- Placements ----------

  async listPlacements(
    profileId: string,
    opts?: { campaignId?: string; advertiserId?: string; searchString?: string; maxResults?: number },
  ): Promise<CM360Placement[]> {
    const res = await this.api.placements.list({
      profileId,
      campaignIds: opts?.campaignId ? [opts.campaignId] : undefined,
      advertiserIds: opts?.advertiserId ? [opts.advertiserId] : undefined,
      searchString: opts?.searchString,
      maxResults: opts?.maxResults ?? 100,
    });
    return (res.data.placements ?? []).map(p => mapPlacement(p));
  }

  async createPlacement(
    profileId: string,
    input: CM360CreatePlacementInput,
  ): Promise<CM360Placement> {
    const res = await this.api.placements.insert({
      profileId,
      requestBody: {
        campaignId: input.campaignId,
        siteId: input.siteId,
        name: input.name,
        size: { width: input.size.width, height: input.size.height },
        pricingSchedule: {
          startDate: input.startDate,
          endDate: input.endDate,
        },
        paymentSource: input.paymentSource,
        compatibility: input.compatibility,
      },
    });
    return mapPlacement(res.data);
  }

  async getPlacement(profileId: string, placementId: string): Promise<CM360Placement | null> {
    try {
      const res = await this.api.placements.get({ profileId, id: placementId });
      if (!res.data) return null;
      return mapPlacement(res.data);
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  async patchPlacement(profileId: string, placementId: string, input: CM360UpdatePlacementInput): Promise<CM360Placement> {
    const requestBody: Record<string, unknown> = {};
    if (input.name !== undefined) requestBody.name = input.name;
    if (input.activeStatus !== undefined) requestBody.activeStatus = input.activeStatus;
    if (input.archived !== undefined) requestBody.archived = input.archived;
    if (input.startDate !== undefined || input.endDate !== undefined) {
      requestBody.pricingSchedule = {
        ...(input.startDate !== undefined && { startDate: input.startDate }),
        ...(input.endDate !== undefined && { endDate: input.endDate }),
      };
    }
    const res = await this.api.placements.patch({
      profileId,
      id: placementId,
      requestBody,
    });
    return mapPlacement(res.data);
  }

  // ---------- Creatives ----------

  async listCreatives(
    profileId: string,
    opts?: { advertiserId?: string; searchString?: string; maxResults?: number },
  ): Promise<CM360Creative[]> {
    const res = await this.api.creatives.list({
      profileId,
      advertiserId: opts?.advertiserId,
      searchString: opts?.searchString,
      maxResults: opts?.maxResults ?? 100,
    });
    return (res.data.creatives ?? []).map(c => ({
      id: String(c.id ?? ''),
      name: c.name ?? '',
      advertiserId: String(c.advertiserId ?? ''),
      type: (c.type ?? 'DISPLAY') as CM360CreativeType,
      size: {
        id: String(c.size?.id ?? ''),
        width: c.size?.width ?? 0,
        height: c.size?.height ?? 0,
        iab: c.size?.iab ?? false,
      },
      active: c.active ?? true,
      archived: c.archived ?? false,
    }));
  }

  async patchCreative(profileId: string, creativeId: string, input: CM360UpdateCreativeInput): Promise<CM360Creative> {
    const res = await this.api.creatives.patch({
      profileId,
      id: creativeId,
      requestBody: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.active !== undefined && { active: input.active }),
        ...(input.archived !== undefined && { archived: input.archived }),
      },
    });
    return {
      id: String(res.data.id ?? ''),
      name: res.data.name ?? '',
      advertiserId: String(res.data.advertiserId ?? ''),
      type: (res.data.type ?? 'DISPLAY') as CM360CreativeType,
      size: {
        id: String(res.data.size?.id ?? ''),
        width: res.data.size?.width ?? 0,
        height: res.data.size?.height ?? 0,
        iab: res.data.size?.iab ?? false,
      },
      active: res.data.active ?? true,
      archived: res.data.archived ?? false,
    };
  }

  // ---------- Ads ----------

  async listAds(
    profileId: string,
    opts?: { campaignId?: string; advertiserId?: string; searchString?: string; maxResults?: number },
  ): Promise<CM360Ad[]> {
    const res = await this.api.ads.list({
      profileId,
      campaignIds: opts?.campaignId ? [opts.campaignId] : undefined,
      advertiserId: opts?.advertiserId,
      searchString: opts?.searchString,
      maxResults: opts?.maxResults ?? 100,
    });
    return (res.data.ads ?? []).map(ad => mapAd(ad));
  }

  async createAd(
    profileId: string,
    input: { campaignId: string; name: string; placementIds: string[]; creativeId: string },
  ): Promise<CM360Ad> {
    const res = await this.api.ads.insert({
      profileId,
      requestBody: {
        campaignId: input.campaignId,
        name: input.name,
        type: 'AD_SERVING_STANDARD_AD',
        placementAssignments: input.placementIds.map(id => ({
          placementId: id,
          active: true,
        })),
        creativeRotation: {
          creativeAssignments: [{
            creativeId: input.creativeId,
            active: true,
          }],
          type: 'CREATIVE_ROTATION_TYPE_RANDOM',
        },
      },
    });
    return mapAd(res.data);
  }

  async getAd(profileId: string, adId: string): Promise<CM360Ad | null> {
    try {
      const res = await this.api.ads.get({ profileId, id: adId });
      if (!res.data) return null;
      return mapAd(res.data);
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  async patchAd(profileId: string, adId: string, input: CM360UpdateAdInput): Promise<CM360Ad> {
    const requestBody: Record<string, unknown> = {};
    if (input.name !== undefined) requestBody.name = input.name;
    if (input.active !== undefined) requestBody.active = input.active;
    if (input.archived !== undefined) requestBody.archived = input.archived;
    if (input.startTime !== undefined) requestBody.startTime = input.startTime;
    if (input.endTime !== undefined) requestBody.endTime = input.endTime;
    if (input.placementIds !== undefined) {
      requestBody.placementAssignments = input.placementIds.map(id => ({
        placementId: id,
        active: true,
      }));
    }
    if (input.creativeId !== undefined) {
      requestBody.creativeRotation = {
        creativeAssignments: [{ creativeId: input.creativeId, active: true }],
        type: 'CREATIVE_ROTATION_TYPE_RANDOM',
      };
    }
    const res = await this.api.ads.patch({
      profileId,
      id: adId,
      requestBody,
    });
    return mapAd(res.data);
  }

  // ---------- Tag Generation ----------

  async generateTags(
    profileId: string,
    campaignId: string,
    placementIds: string[],
  ): Promise<CM360PlacementTag[]> {
    // Note: method name is lowercase 'generatetags' in the Google SDK
    const res = await this.api.placements.generatetags({
      profileId,
      campaignId,
      placementIds,
    });
    return (res.data.placementTags ?? []).map(pt => ({
      placementId: String(pt.placementId ?? ''),
      tagData: (pt.tagDatas ?? []).map(td => ({
        format: (td.format ?? 'PLACEMENT_TAG_STANDARD') as CM360TagFormat,
        impressionTag: td.impressionTag ?? '',
        clickTag: td.clickTag ?? '',
      })),
    }));
  }
}

// ---------- Mapping Helpers ----------

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-base-to-string */
function mapAdvertiser(a: any): CM360Advertiser {
  return {
    id: String(a.id ?? ''),
    name: (a.name as string) ?? '',
    accountId: String(a.accountId ?? ''),
    status: ((a.status as string) ?? 'APPROVED') as CM360AdvertiserStatus,
  };
}

function mapCampaign(c: any): CM360Campaign {
  const defaultLP = c.defaultLandingPage as Record<string, unknown> | undefined;
  return {
    id: String(c.id ?? ''),
    name: (c.name as string) ?? '',
    accountId: String(c.accountId ?? ''),
    advertiserId: String(c.advertiserId ?? ''),
    startDate: (c.startDate as string) ?? '',
    endDate: (c.endDate as string) ?? '',
    defaultLandingPageId: String(defaultLP?.id ?? c.defaultLandingPageId ?? ''),
    archived: (c.archived as boolean) ?? false,
  };
}

function mapPlacement(p: any): CM360Placement {
  const size = p.size as Record<string, unknown> | undefined;
  const pricing = p.pricingSchedule as Record<string, unknown> | undefined;
  return {
    id: String(p.id ?? ''),
    name: (p.name as string) ?? '',
    accountId: String(p.accountId ?? ''),
    advertiserId: String(p.advertiserId ?? ''),
    campaignId: String(p.campaignId ?? ''),
    siteId: String(p.siteId ?? ''),
    size: {
      id: String(size?.id ?? ''),
      width: (size?.width as number) ?? 0,
      height: (size?.height as number) ?? 0,
      iab: (size?.iab as boolean) ?? false,
    },
    status: ((p.status as string) ?? 'DRAFT') as CM360PlacementStatus,
    activeStatus: ((p.activeStatus as string) ?? 'ACTIVE') as CM360PlacementActiveStatus,
    pricingSchedule: {
      startDate: (pricing?.startDate as string) ?? '',
      endDate: (pricing?.endDate as string) ?? '',
    },
    tagFormats: ((p.tagFormats as string[]) ?? []) as CM360TagFormat[],
  };
}

function mapAd(ad: any): CM360Ad {
  const placements = ad.placementAssignments as Array<Record<string, unknown>> | undefined;
  const rotation = ad.creativeRotation as Record<string, unknown> | undefined;
  const assignments = rotation?.creativeAssignments as Array<Record<string, unknown>> | undefined;
  return {
    id: String(ad.id ?? ''),
    name: (ad.name as string) ?? '',
    campaignId: String(ad.campaignId ?? ''),
    advertiserId: String(ad.advertiserId ?? ''),
    active: (ad.active as boolean) ?? true,
    archived: (ad.archived as boolean) ?? false,
    startTime: (ad.startTime as string) ?? undefined,
    endTime: (ad.endTime as string) ?? undefined,
    placementAssignments: (placements ?? []).map(pa => ({
      placementId: String(pa.placementId ?? ''),
    })),
    creativeRotation: {
      creativeAssignments: (assignments ?? []).map(ca => ({
        creativeId: String(ca.creativeId ?? ''),
      })),
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-base-to-string */
