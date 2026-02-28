import { describe, it, expect } from 'vitest';
import { TraffickingPlanSchema } from '../schemas/trafficking-plan.js';

describe('TraffickingPlanSchema', () => {
  const minimalValid = {
    campaign: {
      name: 'Nike Q2',
      advertiserName: 'Nike',
      startDate: '2026-04-01',
      endDate: '2026-06-30',
    },
    placements: [{
      siteName: 'ESPN.com',
      name: 'ESPN_300x250',
      size: '300x250',
      startDate: '2026-04-01',
      endDate: '2026-06-30',
    }],
    confidence: 'high',
  };

  it('validates a minimal plan', () => {
    const result = TraffickingPlanSchema.safeParse(minimalValid);
    expect(result.success).toBe(true);
  });

  it('rejects missing campaign', () => {
    const result = TraffickingPlanSchema.safeParse({ placements: [], confidence: 'high' });
    expect(result.success).toBe(false);
  });

  it('rejects missing placements', () => {
    const result = TraffickingPlanSchema.safeParse({ campaign: minimalValid.campaign, confidence: 'high' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid confidence level', () => {
    const result = TraffickingPlanSchema.safeParse({ ...minimalValid, confidence: 'very-high' });
    expect(result.success).toBe(false);
  });

  it('validates rateType enum', () => {
    const plan = {
      ...minimalValid,
      placements: [{ ...minimalValid.placements[0], rateType: 'CPM' }],
    };
    expect(TraffickingPlanSchema.safeParse(plan).success).toBe(true);
    const bad = {
      ...minimalValid,
      placements: [{ ...minimalValid.placements[0], rateType: 'PPC' }],
    };
    expect(TraffickingPlanSchema.safeParse(bad).success).toBe(false);
  });

  it('validates creativeType enum', () => {
    const plan = {
      ...minimalValid,
      placements: [{ ...minimalValid.placements[0], creativeType: 'Video' }],
    };
    expect(TraffickingPlanSchema.safeParse(plan).success).toBe(true);
  });

  it('validates placement group type enum', () => {
    const plan = {
      ...minimalValid,
      placementGroups: [{ name: 'Group 1', type: 'Package', placementIndices: [0] }],
    };
    expect(TraffickingPlanSchema.safeParse(plan).success).toBe(true);
  });

  it('validates frequency cap period enum', () => {
    const plan = {
      ...minimalValid,
      placements: [{
        ...minimalValid.placements[0],
        frequencyCap: { impressions: 3, period: 'Day', perUser: true },
      }],
    };
    expect(TraffickingPlanSchema.safeParse(plan).success).toBe(true);
  });

  it('validates billing adServingFee paidBy enum', () => {
    const plan = {
      ...minimalValid,
      billing: { adServingFee: { paidBy: 'Advertiser' } },
    };
    expect(TraffickingPlanSchema.safeParse(plan).success).toBe(true);
  });

  it('validates a fully populated plan', () => {
    const fullPlan = {
      ...minimalValid,
      ioNumber: 'IO-123',
      version: 'v1',
      publisherRep: 'Rep Name',
      agencyContact: 'Contact',
      approvalDate: '2026-03-01',
      billing: {
        paymentTerms: 'Net 30',
        poNumber: 'PO-123',
        agencyCommission: 15,
        billingContact: 'finance@co.com',
        adServingFee: { rate: 0.10, paidBy: 'Publisher', included: true },
      },
      terms: {
        cancellation: { noticePeriod: '30 days' },
        makeGood: { policy: 'Under-delivery', threshold: 10 },
      },
      qualityRequirements: {
        viewability: { minimumPercentage: 70, standard: 'MRC', vendor: 'MOAT' },
        brandSafety: { blockedCategories: ['Adult'], verificationVendor: 'IAS' },
      },
      taxonomy: {
        campaignNameFormat: '{Advertiser}_{Year}',
        placementNameFormat: '{Site}_{Size}',
        confirmed: false,
      },
      warnings: ['Some warning'],
      rawFieldsUnmapped: ['Unknown field'],
    };
    const result = TraffickingPlanSchema.safeParse(fullPlan);
    expect(result.success).toBe(true);
  });

  it('strips unknown fields', () => {
    const plan = { ...minimalValid, unknownField: 'should be stripped' };
    const result = TraffickingPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
    if (result.success) {
      expect('unknownField' in result.data).toBe(false);
    }
  });
});
