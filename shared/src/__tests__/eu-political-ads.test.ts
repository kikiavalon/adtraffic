import { describe, it, expect } from 'vitest';
import {
  CreateCampaignInputSchema,
  UpdateCampaignInputSchema,
} from '../mock-cm360/tool-input-schemas.js';

const baseCreate = {
  profileId: 'p1',
  advertiserId: 'adv1',
  name: 'Toyota Q3 2026',
  startDate: '2026-07-01',
  endDate: '2026-09-30',
  defaultLandingPageId: 'lp1',
};

describe('euPoliticalAdsDeclaration — campaign create schema', () => {
  it('accepts CONTAINS_EU_POLITICAL_ADS and preserves it', () => {
    const r = CreateCampaignInputSchema.safeParse({
      ...baseCreate,
      euPoliticalAdsDeclaration: 'CONTAINS_EU_POLITICAL_ADS',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.euPoliticalAdsDeclaration).toBe('CONTAINS_EU_POLITICAL_ADS');
  });

  it('accepts DOES_NOT_CONTAIN_EU_POLITICAL_ADS', () => {
    const r = CreateCampaignInputSchema.safeParse({
      ...baseCreate,
      euPoliticalAdsDeclaration: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADS',
    });
    expect(r.success).toBe(true);
  });

  it('allows the field to be omitted (optional)', () => {
    const r = CreateCampaignInputSchema.safeParse(baseCreate);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.euPoliticalAdsDeclaration).toBeUndefined();
  });

  it('rejects an invalid declaration value', () => {
    const r = CreateCampaignInputSchema.safeParse({
      ...baseCreate,
      euPoliticalAdsDeclaration: 'MAYBE',
    });
    expect(r.success).toBe(false);
  });
});

describe('euPoliticalAdsDeclaration — campaign update schema', () => {
  it('accepts a valid declaration and preserves it', () => {
    const r = UpdateCampaignInputSchema.safeParse({
      profileId: 'p1',
      campaignId: 'c1',
      euPoliticalAdsDeclaration: 'CONTAINS_EU_POLITICAL_ADS',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.euPoliticalAdsDeclaration).toBe('CONTAINS_EU_POLITICAL_ADS');
  });

  it('rejects an invalid declaration value', () => {
    const r = UpdateCampaignInputSchema.safeParse({
      profileId: 'p1',
      campaignId: 'c1',
      euPoliticalAdsDeclaration: 'NOPE',
    });
    expect(r.success).toBe(false);
  });
});
