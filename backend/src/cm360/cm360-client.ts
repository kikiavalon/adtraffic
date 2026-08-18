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
  CM360Size,
  CM360LandingPage,
  CM360CreateLandingPageInput,
  CM360Placement,
  CM360CreatePlacementInput,
  CM360Creative,
  CM360CreateCreativeInput,
  CM360Ad,
  CM360ClickThroughUrl,
  CM360ClickThroughUrlSuffixProperties,
  CM360PlacementTag,
  CM360AdvertiserStatus,
  CM360PlacementStatus,
  CM360PlacementActiveStatus,
  CM360TagFormat,
  CM360CreativeType,
  CM360CampaignCreativeAssociation,
  CM360CreativeAssetMetadata,
  CM360CreativeAssetType,
  CM360UpdateCampaignInput,
  CM360UpdateLandingPageInput,
  CM360UpdatePlacementInput,
  CM360UpdateCreativeInput,
  CM360UpdateAdInput,
  CM360EventTag,
  CM360EventTagType,
  CM360EventTagStatus,
  CM360CreateEventTagInput,
  CM360UpdateEventTagInput,
  CM360PlacementGroup,
  CM360PlacementGroupType,
  CM360CreatePlacementGroupInput,
  CM360UpdatePlacementGroupInput,
  CM360ChangeLog,
  CM360ChangeLogObjectType,
  CM360ChangeLogAction,
  CM360Report,
  CM360ReportType,
  CM360ReportFile,
  CM360ReportFileStatus,
  CM360CompatibleFields,
  CM360CreateReportInput,
  CM360FloodlightActivity,
  CM360FloodlightActivityType,
  CM360FloodlightCountingMethod,
  CM360FloodlightTagFormat,
  CM360FloodlightActivityStatus,
  CM360FloodlightActivityGroup,
  CM360FloodlightConfiguration,
  CM360FloodlightTag,
  CM360CreateFloodlightActivityInput,
  CM360CreateFloodlightActivityGroupInput,
  CM360AccountUserProfile,
  CM360CreateAccountUserProfileInput,
  CM360UserRole,
  CM360CreateUserRoleInput,
  CM360UserRolePermission,
  CM360UserRolePermissionGroup,
  CM360Subaccount,
  CM360ObjectFilter,
  CM360ObjectFilterStatus,
  CM360UserLocale,
} from '@adtraffic/shared';
import { isGoogleAPIError } from './errors.js';
import { Readable } from 'node:stream';

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

  async getSite(profileId: string, siteId: string): Promise<CM360Site | null> {
    try {
      const res = await this.api.sites.get({ profileId, id: siteId });
      if (!res.data) return null;
      return {
        id: String(res.data.id ?? ''),
        name: res.data.name ?? '',
        accountId: String(res.data.accountId ?? ''),
        approved: res.data.approved ?? false,
        directorySiteId: res.data.directorySiteId ? String(res.data.directorySiteId) : undefined,
      };
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
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

  async getLandingPage(profileId: string, landingPageId: string): Promise<CM360LandingPage | null> {
    try {
      const res = await this.api.advertiserLandingPages.get({ profileId, id: landingPageId });
      if (!res.data) return null;
      return {
        id: String(res.data.id ?? ''),
        name: res.data.name ?? '',
        advertiserId: String(res.data.advertiserId ?? ''),
        url: res.data.url ?? '',
        archived: res.data.archived ?? false,
      };
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
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

  async getCreative(profileId: string, creativeId: string): Promise<CM360Creative | null> {
    try {
      const res = await this.api.creatives.get({ profileId, id: creativeId });
      if (!res.data) return null;
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
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  async createCreative(profileId: string, input: CM360CreateCreativeInput): Promise<CM360Creative> {
    const res = await this.api.creatives.insert({
      profileId,
      requestBody: {
        advertiserId: input.advertiserId,
        name: input.name,
        type: input.type,
        size: { width: input.size.width, height: input.size.height },
        active: input.active ?? true,
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
    input: {
      campaignId: string;
      name: string;
      placementIds: string[];
      creativeId: string;
      landingPageId?: string;
      customClickThroughUrl?: string;
      clickThroughUrlSuffix?: string;
    },
  ): Promise<CM360Ad> {
    const res = await this.api.ads.insert({
      profileId,
      requestBody: {
        campaignId: input.campaignId,
        name: input.name,
        type: 'AD_SERVING_STANDARD_AD',
        ...(input.clickThroughUrlSuffix !== undefined && {
          clickThroughUrlSuffixProperties: {
            clickThroughUrlSuffix: input.clickThroughUrlSuffix,
            overrideInheritedSuffix: true,
          },
        }),
        placementAssignments: input.placementIds.map(id => ({
          placementId: id,
          active: true,
        })),
        creativeRotation: {
          creativeAssignments: [{
            creativeId: input.creativeId,
            active: true,
            clickThroughUrl: input.customClickThroughUrl
              ? { customClickThroughUrl: input.customClickThroughUrl }
              : input.landingPageId
                ? { landingPageId: input.landingPageId }
                : { defaultLandingPage: true },
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
    if (input.clickThroughUrlSuffix !== undefined) {
      requestBody.clickThroughUrlSuffixProperties = {
        clickThroughUrlSuffix: input.clickThroughUrlSuffix,
        overrideInheritedSuffix: true,
      };
    }
    if (input.placementIds !== undefined) {
      requestBody.placementAssignments = input.placementIds.map(id => ({
        placementId: id,
        active: true,
      }));
    }
    // CM360 patch replaces whole nested objects — sending a partial creativeRotation
    // clobbers it. When the rotation must change (creative or click-through), get the
    // existing ad first and rebuild the rotation preserving existing assignments,
    // overriding only what changed.
    if (
      input.creativeId !== undefined ||
      input.landingPageId !== undefined ||
      input.customClickThroughUrl !== undefined
    ) {
      const existing = await this.api.ads.get({ profileId, id: adId });
      const rotation = (existing.data?.creativeRotation ?? {}) as Record<string, unknown>;
      const assignments =
        (rotation.creativeAssignments as Array<Record<string, unknown>> | undefined) ?? [];
      const newClickThrough: Record<string, unknown> | undefined =
        input.customClickThroughUrl !== undefined
          ? { customClickThroughUrl: input.customClickThroughUrl }
          : input.landingPageId !== undefined
            ? { landingPageId: input.landingPageId }
            : undefined;
      let newAssignments: Array<Record<string, unknown>>;
      if (input.creativeId !== undefined) {
        // Creative swap: carry the existing click-through forward unless it also changed.
        const existingClickThrough = assignments[0]?.clickThroughUrl as
          | Record<string, unknown>
          | undefined;
        newAssignments = [{
          creativeId: input.creativeId,
          active: true,
          clickThroughUrl: newClickThrough ?? existingClickThrough ?? { defaultLandingPage: true },
        }];
      } else {
        // Click-through-only change: preserve every existing assignment.
        newAssignments = assignments.map(a => ({
          ...a,
          clickThroughUrl: newClickThrough ?? a.clickThroughUrl,
        }));
      }
      requestBody.creativeRotation = {
        ...rotation,
        type: (rotation.type as string | undefined) ?? 'CREATIVE_ROTATION_TYPE_RANDOM',
        creativeAssignments: newAssignments,
      };
    }
    const res = await this.api.ads.patch({
      profileId,
      id: adId,
      requestBody,
    });
    return mapAd(res.data);
  }

  // ---------- Sizes ----------

  async listSizes(
    profileId: string,
    opts?: { width?: number; height?: number; iabStandard?: boolean },
  ): Promise<CM360Size[]> {
    const res = await this.api.sizes.list({
      profileId,
      width: opts?.width,
      height: opts?.height,
      iabStandard: opts?.iabStandard,
    });
    return (res.data.sizes ?? []).map(s => ({
      id: String(s.id ?? ''),
      width: s.width ?? 0,
      height: s.height ?? 0,
      iab: s.iab ?? false,
    }));
  }

  // ---------- Campaign-Creative Associations (Phase B) ----------

  async associateCreativeCampaign(
    profileId: string,
    campaignId: string,
    creativeId: string,
  ): Promise<CM360CampaignCreativeAssociation> {
    const res = await this.api.campaignCreativeAssociations.insert({
      profileId,
      campaignId,
      requestBody: { creativeId },
    });
    return {
      creativeId: String(res.data.creativeId ?? creativeId),
    };
  }

  async listCampaignCreativeAssociations(
    profileId: string,
    campaignId: string,
    opts?: { maxResults?: number },
  ): Promise<CM360CampaignCreativeAssociation[]> {
    const res = await this.api.campaignCreativeAssociations.list({
      profileId,
      campaignId,
      maxResults: opts?.maxResults,
    });
    return (res.data.campaignCreativeAssociations ?? []).map(a => ({
      creativeId: String(a.creativeId ?? ''),
    }));
  }

  // ---------- Creative Assets (Phase B) ----------

  async uploadCreativeAsset(
    profileId: string,
    advertiserId: string,
    assetName: string,
    assetType: CM360CreativeAssetType,
    assetData: string, // base64
  ): Promise<CM360CreativeAssetMetadata> {
    const buffer = Buffer.from(assetData, 'base64');
    const res = await this.api.creativeAssets.insert({
      profileId,
      advertiserId,
      requestBody: {
        assetIdentifier: {
          name: assetName,
          type: assetType,
        },
      },
      media: {
        mimeType: getMimeType(assetName, assetType),
        body: Readable.from(buffer),
      },
    });

    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
    const data = res.data as any;
    return {
      assetIdentifier: {
        name: String(data?.assetIdentifier?.name ?? assetName),
        type: (String(data?.assetIdentifier?.type ?? assetType)) as CM360CreativeAssetType,
      },
      id: String(data?.id ?? ''),
      fileSize: (data?.fileSize as number) ?? buffer.length,
    };
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
  }

  // ---------- Event Tags ----------

  async listEventTags(profileId: string, campaignId: string, opts?: { advertiserId?: string; searchString?: string }): Promise<CM360EventTag[]> {
    const res = await this.api.eventTags.list({
      profileId,
      campaignId,
      advertiserId: opts?.advertiserId,
      searchString: opts?.searchString,
    });
    return (res.data.eventTags ?? []).map(t => mapEventTag(t));
  }

  async getEventTag(profileId: string, eventTagId: string): Promise<CM360EventTag | null> {
    try {
      const res = await this.api.eventTags.get({ profileId, id: eventTagId });
      if (!res.data) return null;
      return mapEventTag(res.data);
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  async createEventTag(profileId: string, input: CM360CreateEventTagInput): Promise<CM360EventTag> {
    const res = await this.api.eventTags.insert({
      profileId,
      requestBody: {
        advertiserId: input.advertiserId,
        campaignId: input.campaignId,
        name: input.name,
        url: input.url,
        type: input.type,
        siteIds: input.siteIds,
        enabledByDefault: input.enabledByDefault,
      },
    });
    return mapEventTag(res.data);
  }

  async updateEventTag(profileId: string, eventTagId: string, input: CM360UpdateEventTagInput): Promise<CM360EventTag> {
    const res = await this.api.eventTags.patch({
      profileId,
      id: eventTagId,
      requestBody: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.url !== undefined && { url: input.url }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.siteIds !== undefined && { siteIds: input.siteIds }),
        ...(input.enabledByDefault !== undefined && { enabledByDefault: input.enabledByDefault }),
      },
    });
    return mapEventTag(res.data);
  }

  // ---------- Placement Groups ----------

  async listPlacementGroups(profileId: string, campaignId: string, opts?: { advertiserId?: string; searchString?: string; maxResults?: number }): Promise<CM360PlacementGroup[]> {
    const res = await this.api.placementGroups.list({
      profileId,
      campaignIds: [campaignId],
      advertiserIds: opts?.advertiserId ? [opts.advertiserId] : undefined,
      searchString: opts?.searchString,
      maxResults: opts?.maxResults ?? 100,
      sortField: 'NAME',
      sortOrder: 'ASCENDING',
    });
    return (res.data.placementGroups ?? []).map(pg => mapPlacementGroup(pg));
  }

  async getPlacementGroup(profileId: string, placementGroupId: string): Promise<CM360PlacementGroup | null> {
    try {
      const res = await this.api.placementGroups.get({ profileId, id: placementGroupId });
      if (!res.data) return null;
      return mapPlacementGroup(res.data);
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  async createPlacementGroup(profileId: string, input: CM360CreatePlacementGroupInput): Promise<CM360PlacementGroup> {
    // NOTE: childPlacementIds is OUTPUT-ONLY on the CM360 API — a placement's group
    // membership is established solely by patching each placement's placementGroupId
    // (see setPlacementGroup). Never send childPlacementIds in the group body: on the
    // live path it is at best dead payload and at worst rejected by the API. The
    // executor groups the requested placements via setPlacementGroup after this returns.
    const res = await this.api.placementGroups.insert({
      profileId,
      requestBody: {
        campaignId: input.campaignId,
        siteId: input.siteId,
        name: input.name,
        placementGroupType: input.placementGroupType,
        pricingSchedule: {
          startDate: input.startDate,
          endDate: input.endDate,
        },
      },
    });
    return mapPlacementGroup(res.data);
  }

  async updatePlacementGroup(profileId: string, placementGroupId: string, input: CM360UpdatePlacementGroupInput): Promise<CM360PlacementGroup> {
    // childPlacementIds is OUTPUT-ONLY (see createPlacementGroup). Membership changes are
    // reconciled by the executor via setPlacementGroup, never written here. Only
    // group-level fields (name, activeStatus, pricing dates) are patched.
    const res = await this.api.placementGroups.patch({
      profileId,
      id: placementGroupId,
      requestBody: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.activeStatus !== undefined && { activeStatus: input.activeStatus }),
        ...((input.startDate !== undefined || input.endDate !== undefined) && {
          pricingSchedule: {
            ...(input.startDate !== undefined && { startDate: input.startDate }),
            ...(input.endDate !== undefined && { endDate: input.endDate }),
          },
        }),
      },
    });
    return mapPlacementGroup(res.data);
  }

  /**
   * Set (or clear) a placement's parent placement group by patching the placement.
   * `Schema$Placement.placementGroupId` is writable; passing `null` removes the
   * placement from its group. This is the real grouping mechanism in CM360 —
   * membership lives on each placement, not only on the group's childPlacementIds.
   */
  async setPlacementGroup(profileId: string, placementId: string, placementGroupId: string | null): Promise<void> {
    await this.api.placements.patch({
      profileId,
      id: placementId,
      requestBody: { placementGroupId },
    });
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

  // ---------- Directory Sites ----------

  async listDirectorySites(profileId: string, opts?: { searchString?: string; active?: boolean }): Promise<Array<{
    id: string; name: string; url: string; active: boolean;
    interstitialTagFormats: string[]; inpageTagFormats: string[];
  }>> {
    const res = await this.api.directorySites.list({
      profileId,
      ...(opts?.searchString && { searchString: opts.searchString }),
      ...(opts?.active !== undefined && { active: opts.active }),
    });
    return (res.data.directorySites ?? []).map(mapDirectorySite);
  }

  async getDirectorySite(profileId: string, directorySiteId: string): Promise<{
    id: string; name: string; url: string; active: boolean;
    interstitialTagFormats: string[]; inpageTagFormats: string[];
  } | null> {
    try {
      const res = await this.api.directorySites.get({
        profileId,
        id: directorySiteId,
      });
      return mapDirectorySite(res.data);
    } catch (err) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  /**
   * Insert a directory site into the account's site directory. The CM360
   * `directorySites.insert` method returns the created directory-site entry
   * (a Schema$DirectorySite) — it does not approve anything or return a Site.
   */
  async insertDirectorySite(profileId: string, directorySiteId: string): Promise<{
    id: string; name: string; url: string; active: boolean;
    interstitialTagFormats: string[]; inpageTagFormats: string[];
  }> {
    const res = await this.api.directorySites.insert({
      profileId,
      requestBody: {
        id: directorySiteId,
      },
    });
    return mapDirectorySite(res.data);
  }

  // ---------------------------------------------------------------------------
  // Change Logs (read-only audit trail)
  // ---------------------------------------------------------------------------

  /** List change logs with optional filters — returns newest first. */
  async listChangeLogs(
    profileId: string,
    filter: {
      objectType?: CM360ChangeLogObjectType;
      objectId?: string;
      action?: CM360ChangeLogAction;
      minChangeTime?: string;
      maxChangeTime?: string;
      searchString?: string;
      maxResults?: number;
    } = {},
  ): Promise<CM360ChangeLog[]> {
    const res = await this.api.changeLogs.list({
      profileId,
      objectType: filter.objectType,
      objectIds: filter.objectId ? [filter.objectId] : undefined,
      action: filter.action,
      minChangeTime: filter.minChangeTime,
      maxChangeTime: filter.maxChangeTime,
      searchString: filter.searchString,
      maxResults: filter.maxResults,
    });
    const items = res.data.changeLogs ?? [];
    return items.map(mapChangeLog);
  }

  /** Get a single change log entry by ID. Returns null if not found. */
  async getChangeLog(profileId: string, changeLogId: string): Promise<CM360ChangeLog | null> {
    try {
      const res = await this.api.changeLogs.get({ profileId, id: changeLogId });
      return mapChangeLog(res.data);
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  // --- Reports ---

  /** List all saved report definitions in the account. */
  async listReports(profileId: string): Promise<CM360Report[]> {
    const res = await this.api.reports.list({ profileId });
    return (res.data.items ?? []).map(mapReport);
  }

  /** Get a single report definition by ID. Returns null if not found. */
  async getReport(profileId: string, reportId: string): Promise<CM360Report | null> {
    try {
      const res = await this.api.reports.get({ profileId, reportId });
      return res.data ? mapReport(res.data) : null;
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  /** Run a saved report. Returns the file metadata (status will be PROCESSING initially). */
  async runReport(profileId: string, reportId: string): Promise<CM360ReportFile> {
    const res = await this.api.reports.run({ profileId, reportId });
    const file = res.data;
    return {
      reportId,
      fileId: String(file.id ?? ''),
      status: (file.status as CM360ReportFileStatus) ?? 'PROCESSING',
      fileName: (file.fileName as string) ?? undefined,
      cm360Link: `https://campaignmanager.google.com/#/reporting/${profileId}/report/${reportId}`,
      message: 'Report execution started. Use cm360_get_report_file to retrieve results.',
    };
  }

  /** Get a report file. If status is REPORT_AVAILABLE, downloads and parses the CSV. */
  async getReportFile(profileId: string, reportId: string, fileId: string, maxRows = 50): Promise<CM360ReportFile> {
    // First check the file status
    const meta = await this.api.reports.files.get({ profileId, reportId, fileId });
    const status = (meta.data.status as CM360ReportFileStatus) ?? 'PROCESSING';
    const cm360Link = `https://campaignmanager.google.com/#/reporting/${profileId}/report/${reportId}`;

    if (status !== 'REPORT_AVAILABLE') {
      return {
        reportId,
        fileId,
        status,
        cm360Link,
        message: status === 'PROCESSING'
          ? 'Report is still generating. Check back in a moment or view in CM360.'
          : `Report file status: ${status}`,
      };
    }

    // Download the actual file content
    const fileRes = await this.api.reports.files.get({
      profileId,
      reportId,
      fileId,
      alt: 'media',
    });

    // Parse CSV content
    const csvContent = typeof fileRes.data === 'string' ? fileRes.data : '';
    const { columns, rows, totalRows } = this.parseCSV(csvContent, maxRows);

    const summary = this.computeReportSummary(rows, columns);

    return {
      reportId,
      fileId,
      status: 'REPORT_AVAILABLE',
      fileName: (meta.data.fileName as string) ?? undefined,
      totalRows,
      rowsReturned: rows.length,
      truncated: rows.length < totalRows,
      columns,
      rows,
      summary,
      cm360Link,
    };
  }

  /** Create a new report definition */
  async createReport(profileId: string, input: Omit<CM360CreateReportInput, 'type'> & { type: string }): Promise<CM360Report> {
    const res = await this.api.reports.insert({
      profileId,
      requestBody: {
        name: input.name,
        type: input.type,
        criteria: {
          dateRange: {
            startDate: input.startDate,
            endDate: input.endDate,
          },
          dimensions: input.dimensions.map((d: string) => ({ name: d })),
          metricNames: input.metricNames,
          ...(input.filters?.length ? {
            dimensionFilters: input.filters.map((f: { dimensionName: string; value: string }) => ({
              dimensionName: f.dimensionName,
              value: f.value,
            })),
          } : {}),
        },
      },
    });
    const r = res.data;
    return {
      id: String(r.id ?? ''),
      name: (r.name as string) ?? '',
      type: (r.type as CM360ReportType) ?? 'STANDARD',
      accountId: String(r.accountId ?? ''),
      ownerProfileId: String(r.ownerProfileId ?? profileId),
      criteria: {
        dateRange: {
          startDate: input.startDate,
          endDate: input.endDate,
        },
        dimensions: input.dimensions,
        metricNames: input.metricNames,
        ...(input.filters?.length ? { filters: input.filters } : {}),
      },
      lastModifiedTime: (r.lastModifiedTime as string) ?? new Date().toISOString(),
    };
  }

  /** Query which dimensions/metrics/filters are compatible for a given report type */
  async queryCompatibleFields(profileId: string, reportType: string): Promise<CM360CompatibleFields> {
    const res = await this.api.reports.compatibleFields.query({
      profileId,
      requestBody: { type: reportType, criteria: {} },
    });

    const fields = res.data.reportCompatibleFields;
    return {
      reportType: reportType as CM360ReportType,
      dimensions: (Array.isArray(fields?.dimensions) ? fields.dimensions : []).map((d) => String(d.name ?? '')),
      metrics: (Array.isArray(fields?.metrics) ? fields.metrics : []).map((m) => String(m.name ?? '')),
      dimensionFilters: (Array.isArray(fields?.dimensionFilters) ? fields.dimensionFilters : []).map((f) => String(f.name ?? '')),
      pivotedActivityMetrics: (Array.isArray(fields?.pivotedActivityMetrics) ? fields.pivotedActivityMetrics : []).map((m) => String(m.name ?? '')),
    };
  }

  // --- Floodlight Activities ---

  async listFloodlightActivities(
    profileId: string,
    advertiserId: string,
    opts?: { floodlightActivityGroupId?: string; searchString?: string },
  ): Promise<CM360FloodlightActivity[]> {
    const res = await this.api.floodlightActivities.list({
      profileId,
      advertiserId,
      floodlightActivityGroupIds: opts?.floodlightActivityGroupId ? [opts.floodlightActivityGroupId] : undefined,
      searchString: opts?.searchString,
    });
    return (res.data.floodlightActivities ?? []).map(a => mapFloodlightActivity(a));
  }

  async getFloodlightActivity(
    profileId: string,
    floodlightActivityId: string,
  ): Promise<CM360FloodlightActivity | null> {
    try {
      const res = await this.api.floodlightActivities.get({
        profileId,
        id: floodlightActivityId,
      });
      if (!res.data) return null;
      return mapFloodlightActivity(res.data);
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  async createFloodlightActivity(
    profileId: string,
    input: CM360CreateFloodlightActivityInput,
  ): Promise<CM360FloodlightActivity> {
    const res = await this.api.floodlightActivities.insert({
      profileId,
      requestBody: {
        advertiserId: input.advertiserId,
        floodlightActivityGroupId: input.floodlightActivityGroupId,
        name: input.name,
        countingMethod: input.countingMethod,
        tagString: input.tagString,
        tagFormat: input.tagFormat,
        expectedUrl: input.expectedUrl,
        notes: input.notes,
      },
    });
    return mapFloodlightActivity(res.data);
  }

  async generateFloodlightTag(
    profileId: string,
    floodlightActivityId: string,
  ): Promise<CM360FloodlightTag> {
    const res = await this.api.floodlightActivities.generatetag({
      profileId,
      floodlightActivityId,
    });
    return {
      globalSiteTagGlobalSnippet: res.data.globalSiteTagGlobalSnippet ?? undefined,
      globalSiteTagEventSnippet: res.data.floodlightActivityTag ?? undefined,
      iframeTag: undefined,
      imageTag: undefined,
    };
  }

  // --- Floodlight Activity Groups ---

  async listFloodlightActivityGroups(
    profileId: string,
    advertiserId: string,
    opts?: { searchString?: string },
  ): Promise<CM360FloodlightActivityGroup[]> {
    const res = await this.api.floodlightActivityGroups.list({
      profileId,
      advertiserId,
      searchString: opts?.searchString,
    });
    return (res.data.floodlightActivityGroups ?? []).map(g => mapFloodlightActivityGroup(g));
  }

  async getFloodlightActivityGroup(
    profileId: string,
    floodlightActivityGroupId: string,
  ): Promise<CM360FloodlightActivityGroup | null> {
    try {
      const res = await this.api.floodlightActivityGroups.get({
        profileId,
        id: floodlightActivityGroupId,
      });
      if (!res.data) return null;
      return mapFloodlightActivityGroup(res.data);
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  async createFloodlightActivityGroup(
    profileId: string,
    input: CM360CreateFloodlightActivityGroupInput,
  ): Promise<CM360FloodlightActivityGroup> {
    const res = await this.api.floodlightActivityGroups.insert({
      profileId,
      requestBody: {
        advertiserId: input.advertiserId,
        name: input.name,
        type: input.type,
        tagString: input.tagString,
      },
    });
    return mapFloodlightActivityGroup(res.data);
  }

  // --- Floodlight Configurations (read-only) ---

  async listFloodlightConfigurations(
    profileId: string,
    advertiserId: string,
  ): Promise<CM360FloodlightConfiguration[]> {
    const res = await this.api.floodlightConfigurations.list({
      profileId,
      ids: [advertiserId],
    });
    return (res.data.floodlightConfigurations ?? []).map(c => mapFloodlightConfiguration(c));
  }

  /** Parse CM360 CSV report content into structured data */
  private parseCSV(csv: string, maxRows: number): { columns: string[]; rows: Array<Record<string, string>>; totalRows: number } {
    const lines = csv.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return { columns: [], rows: [], totalRows: 0 };

    // CM360 reports have a header section — find the actual data header
    let dataStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.includes(',') && !lines[i]!.startsWith('Report')) {
        dataStartIndex = i;
        break;
      }
    }

    const columns = lines[dataStartIndex]!.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
    const dataLines = lines.slice(dataStartIndex + 1);
    const totalRows = dataLines.length;

    const rows: Array<Record<string, string>> = [];
    for (let i = 0; i < Math.min(dataLines.length, maxRows); i++) {
      const values = dataLines[i]!.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      for (let j = 0; j < columns.length; j++) {
        row[columns[j]!] = values[j] ?? '';
      }
      rows.push(row);
    }

    return { columns, rows, totalRows };
  }

  /** Compute summary aggregates from parsed report rows */
  private computeReportSummary(rows: Array<Record<string, string>>, columns: string[]): CM360ReportFile['summary'] {
    const summary: CM360ReportFile['summary'] = {};
    const lowerCols = columns.map(c => c.toLowerCase());

    const sumColumn = (name: string): number =>
      rows.reduce((sum, r) => {
        const key = columns.find((_, i) => lowerCols[i] === name.toLowerCase());
        return sum + (parseFloat(r[key ?? ''] ?? '0') || 0);
      }, 0);

    if (lowerCols.includes('impressions')) summary.totalImpressions = Math.round(sumColumn('impressions'));
    if (lowerCols.includes('clicks')) summary.totalClicks = Math.round(sumColumn('clicks'));
    if (summary.totalImpressions && summary.totalClicks) {
      summary.averageCTR = summary.totalImpressions > 0 ? summary.totalClicks / summary.totalImpressions : 0;
    }
    if (lowerCols.some(c => c.includes('conversion'))) {
      const convCol = lowerCols.find(c => c.includes('conversion'))!;
      summary.totalConversions = Math.round(sumColumn(convCol));
    }
    if (lowerCols.some(c => c.includes('cost') || c.includes('spend'))) {
      const costCol = lowerCols.find(c => c.includes('cost') || c.includes('spend'))!;
      summary.totalSpend = Math.round(sumColumn(costCol) * 100) / 100;
    }

    return summary;
  }

  // ---------------------------------------------------------------------------
  // Account User Profiles
  // ---------------------------------------------------------------------------

  async listAccountUserProfiles(profileId: string, filter?: {
    searchString?: string; userRoleId?: string; subaccountId?: string; active?: boolean; maxResults?: number;
  }): Promise<CM360AccountUserProfile[]> {
    const res = await this.api.accountUserProfiles.list({
      profileId,
      ...(filter?.searchString && { searchString: filter.searchString }),
      ...(filter?.userRoleId && { userRoleId: filter.userRoleId }),
      ...(filter?.subaccountId && { subaccountId: filter.subaccountId }),
      ...(filter?.active !== undefined && { active: filter.active }),
      ...(filter?.maxResults && { maxResults: filter.maxResults }),
    });
    return (res.data.accountUserProfiles ?? []).map(mapAccountUserProfile);
  }

  async getAccountUserProfile(profileId: string, accountUserProfileId: string): Promise<CM360AccountUserProfile | null> {
    try {
      const res = await this.api.accountUserProfiles.get({ profileId, id: accountUserProfileId });
      return res.data ? mapAccountUserProfile(res.data) : null;
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  async createAccountUserProfile(profileId: string, input: CM360CreateAccountUserProfileInput): Promise<CM360AccountUserProfile> {
    const makeFilter = (f?: CM360ObjectFilter) => f ? {
      status: f.status,
      ...(f.objectIds.length > 0 && { objectIds: f.objectIds }),
    } : undefined;

    const res = await this.api.accountUserProfiles.insert({
      profileId,
      requestBody: {
        email: input.email,
        name: input.name,
        userRoleId: input.userRoleId,
        ...(input.subaccountId && { subaccountId: input.subaccountId }),
        locale: input.locale ?? 'en',
        active: input.active ?? true,
        ...(input.siteFilter && { siteFilter: makeFilter(input.siteFilter) }),
        ...(input.campaignFilter && { campaignFilter: makeFilter(input.campaignFilter) }),
        ...(input.advertiserFilter && { advertiserFilter: makeFilter(input.advertiserFilter) }),
        ...(input.userRoleFilter && { userRoleFilter: makeFilter(input.userRoleFilter) }),
      },
    });
    return mapAccountUserProfile(res.data);
  }

  // ---------------------------------------------------------------------------
  // User Roles
  // ---------------------------------------------------------------------------

  async listUserRoles(profileId: string, filter?: {
    searchString?: string; subaccountId?: string; accountUserRoleOnly?: boolean;
  }): Promise<CM360UserRole[]> {
    const res = await this.api.userRoles.list({
      profileId,
      ...(filter?.searchString && { searchString: filter.searchString }),
      ...(filter?.subaccountId && { subaccountId: filter.subaccountId }),
      ...(filter?.accountUserRoleOnly && { accountUserRoleOnly: filter.accountUserRoleOnly }),
    });
    return (res.data.userRoles ?? []).map(mapUserRole);
  }

  async getUserRole(profileId: string, userRoleId: string): Promise<CM360UserRole | null> {
    try {
      const res = await this.api.userRoles.get({ profileId, id: userRoleId });
      return res.data ? mapUserRole(res.data) : null;
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  async createUserRole(profileId: string, input: CM360CreateUserRoleInput): Promise<CM360UserRole> {
    const res = await this.api.userRoles.insert({
      profileId,
      requestBody: {
        name: input.name,
        parentUserRoleId: input.parentUserRoleId,
        ...(input.subaccountId && { subaccountId: input.subaccountId }),
        ...(input.permissionIds && { permissions: input.permissionIds.map(id => ({ id })) }),
      },
    });
    return mapUserRole(res.data);
  }

  // ---------------------------------------------------------------------------
  // User Role Permissions (read-only catalog)
  // ---------------------------------------------------------------------------

  async listUserRolePermissions(profileId: string): Promise<CM360UserRolePermission[]> {
    const res = await this.api.userRolePermissions.list({ profileId });
    return (res.data.userRolePermissions ?? []).map(mapUserRolePermission);
  }

  async getUserRolePermission(profileId: string, permissionId: string): Promise<CM360UserRolePermission | null> {
    try {
      const res = await this.api.userRolePermissions.get({ profileId, id: permissionId });
      return res.data ? mapUserRolePermission(res.data) : null;
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // User Role Permission Groups (read-only catalog)
  // ---------------------------------------------------------------------------

  async listUserRolePermissionGroups(profileId: string): Promise<CM360UserRolePermissionGroup[]> {
    const res = await this.api.userRolePermissionGroups.list({ profileId });
    return (res.data.userRolePermissionGroups ?? []).map(mapUserRolePermissionGroup);
  }

  async getUserRolePermissionGroup(profileId: string, permissionGroupId: string): Promise<CM360UserRolePermissionGroup | null> {
    try {
      const res = await this.api.userRolePermissionGroups.get({ profileId, id: permissionGroupId });
      return res.data ? mapUserRolePermissionGroup(res.data) : null;
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Subaccounts (read-only)
  // ---------------------------------------------------------------------------

  async listSubaccounts(profileId: string, filter?: { searchString?: string }): Promise<CM360Subaccount[]> {
    const res = await this.api.subaccounts.list({
      profileId,
      ...(filter?.searchString && { searchString: filter.searchString }),
    });
    return (res.data.subaccounts ?? []).map(mapSubaccount);
  }

  async getSubaccount(profileId: string, subaccountId: string): Promise<CM360Subaccount | null> {
    try {
      const res = await this.api.subaccounts.get({ profileId, id: subaccountId });
      return res.data ? mapSubaccount(res.data) : null;
    } catch (err: unknown) {
      if (isGoogleAPIError(err) && err.code === 404) return null;
      throw err;
    }
  }
}

// ---------- Mapping Helpers ----------

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-base-to-string */
function mapAdvertiser(a: any): CM360Advertiser {
  return {
    id: String(a.id ?? ''),
    name: (a.name as string) ?? '',
    accountId: String(a.accountId ?? ''),
    status: ((a.status as string) ?? 'APPROVED') as CM360AdvertiserStatus,
    clickThroughUrlSuffix: (a.clickThroughUrlSuffix as string) ?? undefined,
  };
}

function mapSuffixProperties(sp: any): CM360ClickThroughUrlSuffixProperties | undefined {
  if (!sp) return undefined;
  return {
    clickThroughUrlSuffix: (sp.clickThroughUrlSuffix as string) ?? undefined,
    overrideInheritedSuffix: (sp.overrideInheritedSuffix as boolean) ?? undefined,
  };
}

function mapClickThroughUrl(ct: any): CM360ClickThroughUrl | undefined {
  if (!ct) return undefined;
  return {
    defaultLandingPage: (ct.defaultLandingPage as boolean) ?? undefined,
    landingPageId: ct.landingPageId != null ? String(ct.landingPageId) : undefined,
    customClickThroughUrl: (ct.customClickThroughUrl as string) ?? undefined,
    computedClickThroughUrl: (ct.computedClickThroughUrl as string) ?? undefined,
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
    clickThroughUrlSuffixProperties: mapSuffixProperties(c.clickThroughUrlSuffixProperties),
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
    type: ((ad.type as string) ?? 'AD_SERVING_DEFAULT_AD') as CM360Ad['type'],
    active: (ad.active as boolean) ?? true,
    archived: (ad.archived as boolean) ?? false,
    startTime: (ad.startTime as string) ?? undefined,
    endTime: (ad.endTime as string) ?? undefined,
    placementAssignments: (placements ?? []).map(pa => ({
      placementId: String(pa.placementId ?? ''),
    })),
    creativeRotation: {
      type: ((rotation?.type as string) ?? 'CREATIVE_ROTATION_TYPE_RANDOM') as CM360Ad['creativeRotation']['type'],
      creativeAssignments: (assignments ?? []).map(ca => ({
        creativeId: String(ca.creativeId ?? ''),
        clickThroughUrl: mapClickThroughUrl(ca.clickThroughUrl),
      })),
    },
    clickThroughUrlSuffixProperties: mapSuffixProperties(ad.clickThroughUrlSuffixProperties),
  };
}
function mapEventTag(t: any): CM360EventTag {
  return {
    id: String(t.id ?? ''),
    accountId: String(t.accountId ?? ''),
    advertiserId: String(t.advertiserId ?? ''),
    campaignId: String(t.campaignId ?? ''),
    name: String(t.name ?? ''),
    url: String(t.url ?? ''),
    type: (t.type ?? 'IMPRESSION_IMAGE_EVENT_TAG') as CM360EventTagType,
    status: (t.status ?? 'ENABLED') as CM360EventTagStatus,
    siteIds: ((t.siteIds ?? []) as unknown[]).map(String),
    enabledByDefault: Boolean(t.enabledByDefault),
    excludeFromAdxRequests: Boolean(t.excludeFromAdxRequests),
    sslCompliant: Boolean(t.sslCompliant),
  };
}

function mapPlacementGroup(pg: any): CM360PlacementGroup {
  const pricing = pg.pricingSchedule as Record<string, unknown> | undefined;
  return {
    id: String(pg.id ?? ''),
    name: (pg.name as string) ?? '',
    accountId: String(pg.accountId ?? ''),
    advertiserId: String(pg.advertiserId ?? ''),
    campaignId: String(pg.campaignId ?? ''),
    siteId: String(pg.siteId ?? ''),
    placementGroupType: ((pg.placementGroupType as string) ?? 'PLACEMENT_PACKAGE') as CM360PlacementGroupType,
    placementIds: ((pg.childPlacementIds ?? []) as unknown[]).map(String),
    activeStatus: ((pg.activeStatus as string) ?? 'ACTIVE') as CM360PlacementGroup['activeStatus'],
    pricingSchedule: {
      startDate: (pricing?.startDate as string) ?? '',
      endDate: (pricing?.endDate as string) ?? '',
    },
  };
}
function mapDirectorySite(ds: any): {
  id: string; name: string; url: string; active: boolean;
  interstitialTagFormats: string[]; inpageTagFormats: string[];
} {
  // Schema$DirectorySite.interstitialTagFormats / inpageTagFormats are plain
  // string[] (e.g. 'STANDARD', 'JAVASCRIPT_INPAGE'), not objects — pass them
  // through as-is rather than reading a nonexistent `.type` field.
  const interstitialFormats = ds.interstitialTagFormats ?? [];
  const inpageFormats = ds.inpageTagFormats ?? [];
  return {
    id: String(ds.id ?? ''),
    name: ds.name ?? '',
    url: ds.url ?? '',
    active: ds.active ?? true,
    interstitialTagFormats: (interstitialFormats as unknown[]).map(String),
    inpageTagFormats: (inpageFormats as unknown[]).map(String),
  };
}

function mapChangeLog(cl: any): CM360ChangeLog {
  return {
    id: String(cl.id ?? ''),
    userProfileId: String(cl.userProfileId ?? ''),
    userProfileName: (cl.userProfileName as string) ?? '',
    objectType: (cl.objectType ?? 'OBJECT_CAMPAIGN') as CM360ChangeLogObjectType,
    objectId: String(cl.objectId ?? ''),
    action: (cl.action ?? 'ACTION_UPDATE') as CM360ChangeLogAction,
    fieldName: (cl.fieldName as string) ?? undefined,
    oldValue: (cl.oldValue as string) ?? undefined,
    newValue: (cl.newValue as string) ?? undefined,
    changeTime: (cl.changeTime as string) ?? new Date().toISOString(),
  };
}

function mapReport(r: any): CM360Report {
  return {
    id: String(r.id ?? ''),
    name: (r.name as string) ?? '',
    type: ((r.type as string) ?? 'STANDARD') as CM360ReportType,
    accountId: String(r.accountId ?? ''),
    ownerProfileId: String(r.ownerProfileId ?? ''),
    criteria: {
      dateRange: {
        startDate: (r.criteria?.dateRange?.startDate as string) ?? '',
        endDate: (r.criteria?.dateRange?.endDate as string) ?? '',
        ...(r.criteria?.dateRange?.relativeDateRange && {
          relativeDateRange: r.criteria.dateRange.relativeDateRange as string,
        }),
      },
      dimensions: ((r.criteria?.dimensions as any[]) ?? []).map((d: any) => String(d.name ?? d)),
      metricNames: ((r.criteria?.metricNames as string[]) ?? []),
      ...(r.criteria?.dimensionFilters && {
        filters: (r.criteria.dimensionFilters as any[]).map((f: any) => ({
          dimensionName: String(f.dimensionName ?? ''),
          value: String(f.value ?? ''),
        })),
      }),
    },
    ...(r.schedule && {
      schedule: {
        active: (r.schedule.active as boolean) ?? false,
        repeats: (r.schedule.repeats as string) ?? '',
        every: (r.schedule.every as number) ?? 0,
      },
    }),
    lastModifiedTime: (r.lastModifiedTime as string) ?? '',
  };
}
function mapFloodlightActivity(a: any): CM360FloodlightActivity {
  return {
    id: String(a.id ?? ''),
    name: String(a.name ?? ''),
    accountId: String(a.accountId ?? ''),
    advertiserId: String(a.advertiserId ?? ''),
    floodlightConfigurationId: String(a.floodlightConfigurationId ?? ''),
    floodlightActivityGroupId: String(a.floodlightActivityGroupId ?? ''),
    floodlightActivityGroupName: String(a.floodlightActivityGroupName ?? ''),
    floodlightActivityGroupType: (a.floodlightActivityGroupType ?? 'COUNTER') as CM360FloodlightActivityType,
    type: (a.floodlightActivityGroupType ?? 'COUNTER') as CM360FloodlightActivityType,
    countingMethod: (a.countingMethod ?? 'STANDARD_COUNTING') as CM360FloodlightCountingMethod,
    tagString: String(a.tagString ?? ''),
    tagFormat: (a.tagFormat ?? 'GLOBAL_SITE_TAG') as CM360FloodlightTagFormat,
    expectedUrl: a.expectedUrl ? String(a.expectedUrl) : undefined,
    status: (a.status ?? 'ACTIVE') as CM360FloodlightActivityStatus,
    sslRequired: Boolean(a.sslRequired),
    notes: a.notes ? String(a.notes) : undefined,
  };
}

function mapFloodlightActivityGroup(g: any): CM360FloodlightActivityGroup {
  return {
    id: String(g.id ?? ''),
    name: String(g.name ?? ''),
    accountId: String(g.accountId ?? ''),
    advertiserId: String(g.advertiserId ?? ''),
    floodlightConfigurationId: String(g.floodlightConfigurationId ?? ''),
    type: (g.type ?? 'COUNTER') as CM360FloodlightActivityType,
    tagString: String(g.tagString ?? ''),
  };
}

function mapFloodlightConfiguration(c: any): CM360FloodlightConfiguration {
  return {
    id: String(c.id ?? ''),
    accountId: String(c.accountId ?? ''),
    advertiserId: String(c.advertiserId ?? ''),
    lookbackClickDays: Number(c.lookbackConfiguration?.clickDuration ?? 30),
    lookbackImpressionDays: Number(c.lookbackConfiguration?.postImpressionActivitiesDuration ?? 7),
    naturalSearchConversionAttributionOption: String(c.naturalSearchConversionAttributionOption ?? ''),
    tagSettings: {
      dynamicTagEnabled: Boolean(c.tagSettings?.dynamicTagEnabled),
      imageTagEnabled: Boolean(c.tagSettings?.imageTagEnabled),
    },
  };
}

function mapAccountUserProfile(u: any): CM360AccountUserProfile {
  const mapFilter = (f: any): CM360ObjectFilter => ({
    status: ((f?.status as string) ?? 'NONE') as CM360ObjectFilterStatus,
    objectIds: ((f?.objectIds as string[]) ?? []).map(String),
  });
  return {
    id: String(u.id ?? ''),
    accountId: String(u.accountId ?? ''),
    ...(u.subaccountId && { subaccountId: String(u.subaccountId) }),
    email: (u.email as string) ?? '',
    name: (u.name as string) ?? '',
    userRoleId: String(u.userRoleId ?? ''),
    ...(u.userRole && { userRoleName: (u.userRole.name as string) ?? undefined }),
    active: (u.active as boolean) ?? false,
    locale: ((u.locale as string) ?? 'en') as CM360UserLocale,
    ...(u.userAccessType && { userAccessType: u.userAccessType as string }),
    ...(u.traffickerType && { traffickerType: u.traffickerType as string }),
    siteFilter: mapFilter(u.siteFilter),
    campaignFilter: mapFilter(u.campaignFilter),
    advertiserFilter: mapFilter(u.advertiserFilter),
    userRoleFilter: mapFilter(u.userRoleFilter),
  };
}

function mapUserRole(r: any): CM360UserRole {
  return {
    id: String(r.id ?? ''),
    accountId: String(r.accountId ?? ''),
    ...(r.subaccountId && { subaccountId: String(r.subaccountId) }),
    name: (r.name as string) ?? '',
    defaultUserRole: (r.defaultUserRole as boolean) ?? false,
    ...(r.parentUserRoleId && { parentUserRoleId: String(r.parentUserRoleId) }),
    ...(r.parentUserRole && { parentUserRoleName: (r.parentUserRole.name as string) ?? undefined }),
    permissionIds: ((r.permissions as any[]) ?? []).map((p: any) => String(p.id ?? '')).filter(Boolean),
  };
}

function mapUserRolePermission(p: any): CM360UserRolePermission {
  return {
    id: String(p.id ?? ''),
    name: (p.name as string) ?? '',
    permissionGroupId: String(p.permissionGroupId ?? ''),
    availability: ((p.availability as string) ?? 'ACCOUNT_ALWAYS') as CM360UserRolePermission['availability'],
  };
}

function mapUserRolePermissionGroup(pg: any): CM360UserRolePermissionGroup {
  return {
    id: String(pg.id ?? ''),
    name: (pg.name as string) ?? '',
  };
}

function mapSubaccount(s: any): CM360Subaccount {
  return {
    id: String(s.id ?? ''),
    accountId: String(s.accountId ?? ''),
    name: (s.name as string) ?? '',
    availablePermissionIds: ((s.availablePermissionIds as any[]) ?? []).map(String),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-base-to-string */

/** Determine MIME type for creative asset upload based on filename extension and asset type */
function getMimeType(filename: string, assetType: CM360CreativeAssetType): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (assetType === 'VIDEO' || assetType === 'PARENT_VIDEO') {
    if (ext === 'webm') return 'video/webm';
    return 'video/mp4';
  }
  if (assetType === 'AUDIO' || assetType === 'PARENT_AUDIO') {
    return 'audio/mpeg';
  }
  if (assetType === 'HTML' || assetType === 'HTML_IMAGE') {
    if (ext === 'zip') return 'application/zip';
    return 'text/html';
  }
  // IMAGE type
  switch (ext) {
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    default: return 'image/jpeg';
  }
}
