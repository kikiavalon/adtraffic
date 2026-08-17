import { describe, it, expect } from 'vitest';
import { assessAd, fetchCampaignContext } from '../qa/click-resolver.js';
import { mockStore } from '../cm360/mock-data-store.js';
import type { CM360Ad, CM360Campaign, CM360Creative } from '@adtraffic/shared';

function seededContextParts() {
  const advertiser = mockStore.listAdvertisers()[0]!;          // has clickThroughUrlSuffix (Phase 0 seed)
  const campaign = mockStore.listCampaigns({ advertiserId: advertiser.id })[0]!;
  const ads = mockStore.listAds({ campaignId: campaign.id });
  const landingPages = mockStore.listLandingPages({ advertiserId: advertiser.id });
  const creatives = new Map(mockStore.listCreatives({ advertiserId: advertiser.id }).map((c) => [c.id, c]));
  return { advertiser, campaign, ads, landingPages, creatives };
}

describe('assessAd', () => {
  it('passes click-through resolution for a seeded ad and produces the expected URL', () => {
    const { advertiser, campaign, ads, landingPages, creatives } = seededContextParts();
    const result = assessAd({ ad: ads[0]!, campaign, advertiser, landingPages, creatives });
    expect(result.expectedUrl).toBeDefined();
    const resolve = result.checks.find((c) => c.checkKey === `config.click_through.ad:${ads[0]!.id}`);
    expect(resolve?.status).toBe('pass');
  });

  it('fails check 15 when the click-through cannot resolve', () => {
    const { advertiser, campaign, ads, creatives } = seededContextParts();
    const ad: CM360Ad = {
      ...ads[0]!,
      creativeRotation: {
        ...ads[0]!.creativeRotation,
        creativeAssignments: [{ creativeId: [...creatives.keys()][0]!, clickThroughUrl: { landingPageId: 'does-not-exist' } }],
      },
    };
    const result = assessAd({ ad, campaign, advertiser, landingPages: [], creatives });
    const resolve = result.checks.find((c) => c.checkKey === `config.click_through.ad:${ad.id}`);
    expect(resolve?.status).toBe('fail');
  });

  it('warns on a lower-level suffix override (check 13)', () => {
    const { advertiser, ads, landingPages, creatives } = seededContextParts();
    const campaign: CM360Campaign = {
      ...mockStore.listCampaigns({ advertiserId: advertiser.id })[0]!,
      clickThroughUrlSuffixProperties: { clickThroughUrlSuffix: 'utm_content=camp-override', overrideInheritedSuffix: true },
    };
    const result = assessAd({ ad: ads[0]!, campaign, advertiser, landingPages, creatives });
    const override = result.checks.find((c) => c.checkKey.startsWith('config.suffix_override'));
    expect(override?.status).toBe('warn');
  });

  it('fails check 16 when there is no creative assignment', () => {
    const { advertiser, campaign, ads, landingPages, creatives } = seededContextParts();
    const ad: CM360Ad = { ...ads[0]!, creativeRotation: { ...ads[0]!.creativeRotation, creativeAssignments: [] } };
    const result = assessAd({ ad, campaign, advertiser, landingPages, creatives });
    const assignment = result.checks.find((c) => c.checkKey.startsWith('config.creative_assignment'));
    expect(assignment?.status).toBe('fail');
  });

  it('fails check 16 when the assigned creative is archived', () => {
    const { advertiser, campaign, ads, landingPages } = seededContextParts();
    const ad = ads[0]!;
    const creativeId = ad.creativeRotation.creativeAssignments[0]!.creativeId;
    const archived: CM360Creative = { ...mockStore.getCreative(creativeId)!, archived: true };
    const result = assessAd({ ad, campaign, advertiser, landingPages, creatives: new Map([[creativeId, archived]]) });
    const assignment = result.checks.find((c) => c.checkKey.startsWith('config.creative_assignment'));
    expect(assignment?.status).toBe('fail');
  });

  it('flags insane ad date windows', () => {
    const { advertiser, campaign, ads, landingPages, creatives } = seededContextParts();
    const ad: CM360Ad = { ...ads[0]!, startTime: '2026-12-31T00:00:00Z', endTime: '2026-01-01T00:00:00Z' };
    const result = assessAd({ ad, campaign, advertiser, landingPages, creatives });
    expect(result.checks.some((c) => c.checkKey.startsWith('config.ad_dates') && c.status === 'fail')).toBe(true);
  });
});

describe('fetchCampaignContext', () => {
  it('fetches campaign, advertiser, ads, placements, landing pages, creatives via read tools', async () => {
    const campaign = mockStore.listCampaigns()[0]!;
    const ctx = await fetchCampaignContext('p', campaign.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.campaign.id).toBe(campaign.id);
    expect(ctx!.ads.length).toBeGreaterThan(0);
    expect(ctx!.placements.length).toBeGreaterThan(0);
    expect(ctx!.creatives.size).toBeGreaterThan(0);
  });

  it('returns null for an unknown campaign', async () => {
    expect(await fetchCampaignContext('p', 'no-such-campaign')).toBeNull();
  });
});
