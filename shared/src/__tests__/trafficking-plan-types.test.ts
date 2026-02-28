import { describe, it, expect } from 'vitest';
import type { TraffickingPlan } from '../types/trafficking-plan.js';

describe('TraffickingPlan types', () => {
  it('accepts a minimal valid trafficking plan', () => {
    const plan: TraffickingPlan = {
      campaign: {
        name: 'Nike Q2 2026',
        advertiserName: 'Nike Inc.',
        startDate: '2026-04-01',
        endDate: '2026-06-30',
      },
      placements: [
        {
          siteName: 'ESPN.com',
          name: 'ESPN_300x250_Apr2026_ROS',
          size: '300x250',
          startDate: '2026-04-01',
          endDate: '2026-06-30',
        },
      ],
      confidence: 'high',
    };
    expect(plan.campaign.name).toBe('Nike Q2 2026');
    expect(plan.placements).toHaveLength(1);
    expect(plan.confidence).toBe('high');
  });

  it('accepts a fully populated trafficking plan', () => {
    const plan: TraffickingPlan = {
      ioNumber: 'IO-2026-0412',
      version: 'v2.1',
      publisherRep: 'Jane Smith',
      agencyContact: 'John Doe',
      approvalDate: '2026-03-15',
      campaign: {
        name: 'Nike Q2 2026 - Digital',
        advertiserName: 'Nike Inc.',
        startDate: '2026-04-01',
        endDate: '2026-06-30',
        budget: 150000,
        notes: 'Focus on brand awareness',
        kpis: [{ metric: 'CTR', target: '0.15%' }],
        reportingRequirements: {
          frequency: 'Weekly',
          metrics: ['impressions', 'clicks'],
          format: 'Excel',
          recipients: ['john@agency.com'],
        },
      },
      billing: {
        paymentTerms: 'Net 30',
        poNumber: 'PO-2026-NK-042',
        agencyCommission: 15,
        billingContact: 'finance@agency.com',
        adServingFee: { rate: 0.10, paidBy: 'Advertiser', included: false },
      },
      terms: {
        cancellation: { noticePeriod: '30 days', fee: '50% of remaining', minimumCommitment: '$10,000' },
        makeGood: { policy: 'Under-delivery by >10%', threshold: 10 },
      },
      qualityRequirements: {
        viewability: { minimumPercentage: 70, standard: 'MRC', vendor: 'DoubleVerify' },
        brandSafety: {
          blockedCategories: ['Adult', 'Gambling'],
          blockedKeywords: ['competitor'],
          verificationVendor: 'DoubleVerify',
          customSettings: 'Exclude UGC',
        },
      },
      placementGroups: [
        { name: 'ESPN Homepage Roadblock', type: 'Roadblock', placementIndices: [0, 1], sharedBudget: 25000 },
      ],
      placements: [
        {
          siteName: 'ESPN.com',
          name: 'ESPN_300x250_Apr2026_ROS',
          size: '300x250',
          startDate: '2026-04-01',
          endDate: '2026-06-30',
          rate: 12,
          rateType: 'CPM',
          impressions: 1250000,
          cost: 15000,
          creativeType: 'Display',
          creativeRotation: 'Even',
          companionSizes: ['728x90'],
          backupImage: true,
          frequencyCap: { impressions: 3, period: 'Day', perUser: true },
          targeting: { geo: ['US'], devices: ['Desktop', 'Mobile'], audiences: ['Sports Enthusiasts'] },
          tracking: { thirdPartyPixels: ['https://pixel.example.com/imp'], verificationVendor: 'DoubleVerify' },
          environment: { type: ['Web', 'In-App'], crossDevice: true },
          groupName: 'ESPN Homepage Roadblock',
          landingPageUrl: 'https://nike.com/q2',
          notes: 'Above the fold preferred',
        },
      ],
      taxonomy: {
        campaignNameFormat: '{Advertiser}_{Quarter}-{Year}_{Channel}',
        placementNameFormat: '{Site}_{Size}_{Month}{Year}_{Type}',
        utmSettings: {
          source: '{site}',
          medium: 'display',
          campaign: '{advertiser}_{quarter}_{year}',
          content: '{size}_{placement_type}',
        },
        confirmed: false,
      },
      confidence: 'medium',
      warnings: ['Could not determine creative type for placement 1'],
      rawFieldsUnmapped: ['Special Terms Section'],
    };
    expect(plan.ioNumber).toBe('IO-2026-0412');
    expect(plan.billing?.paymentTerms).toBe('Net 30');
    expect(plan.taxonomy?.confirmed).toBe(false);
  });

  it('requires campaign, placements, and confidence fields', () => {
    const plan: TraffickingPlan = {
      campaign: { name: 'Test', advertiserName: 'Test Inc', startDate: '2026-01-01', endDate: '2026-12-31' },
      placements: [],
      confidence: 'low',
    };
    expect(plan.campaign).toBeDefined();
    expect(plan.placements).toBeDefined();
    expect(plan.confidence).toBeDefined();
  });
});
