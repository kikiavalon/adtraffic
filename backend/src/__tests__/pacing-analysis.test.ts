import { describe, it, expect, beforeEach } from 'vitest';
import { mockStore } from '../cm360/mock-data-store.js';
import { executeTool } from '../cm360/tool-executor.js';
import { CM360_TOOLS, TOOL_FLAG_MAP } from '../claude/tool-definitions.js';
import { KIKI_SYSTEM_PROMPT } from '../claude/system-prompt.js';

const PROFILE_ID = '12345';

beforeEach(() => {
  mockStore.reset();
});

describe('placement pricing data', () => {
  it('placements have pricingType and pricingPeriods', () => {
    const placements = mockStore.listPlacements({});
    const placement = placements[0]!;
    expect(placement.pricingSchedule).toBeDefined();
    expect(placement.pricingSchedule.pricingType).toBeDefined();
    expect(placement.pricingSchedule.pricingPeriods).toBeDefined();
    expect(placement.pricingSchedule.pricingPeriods!.length).toBeGreaterThan(0);
  });

  it('pricing periods have rate and units', () => {
    const placements = mockStore.listPlacements({});
    const period = placements[0]!.pricingSchedule.pricingPeriods![0]!;
    expect(period.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(period.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(period.rateOrCostNanos).toBeGreaterThan(0);
    expect(period.units).toBeGreaterThan(0);
  });
});

describe('cm360_pacing_analysis (mock store)', () => {
  it('returns pacing analysis for a campaign', () => {
    const campaigns = mockStore.listCampaigns({});
    const campaign = campaigns[0]!;
    const result = mockStore.getPacingAnalysis(campaign.id);
    expect(result).toBeDefined();
    expect(result.campaignName).toBe(campaign.name);
    expect(result.analysisDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.overallStatus).toMatch(/^(ahead|behind|on_track|completed|not_started)$/);
    expect(result.placements.length).toBeGreaterThan(0);
    expect(result.summary).toBeTruthy();
  });

  it('placement pacing has all expected fields', () => {
    const campaigns = mockStore.listCampaigns({});
    const campaign = campaigns[0]!;
    const result = mockStore.getPacingAnalysis(campaign.id);
    const p = result.placements[0]!;
    expect(p.placementId).toBeDefined();
    expect(p.placementName).toBeDefined();
    expect(p.siteName).toBeDefined();
    expect(p.flightStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p.flightEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof p.daysElapsed).toBe('number');
    expect(typeof p.daysRemaining).toBe('number');
    expect(typeof p.percentTimeElapsed).toBe('number');
    expect(typeof p.impressionsGoal).toBe('number');
    expect(typeof p.impressionsDelivered).toBe('number');
    expect(typeof p.impressionsExpected).toBe('number');
    expect(typeof p.impressionsPacingPercent).toBe('number');
    expect(p.impressionsStatus).toMatch(/^(ahead|behind|on_track|completed|not_started)$/);
  });

  it('returns error for non-existent campaign', () => {
    expect(() => mockStore.getPacingAnalysis('nonexistent-id')).toThrow();
  });

  it('skips placements without pricing periods', () => {
    const campaigns = mockStore.listCampaigns({});
    const campaign = campaigns[0]!;
    const result = mockStore.getPacingAnalysis(campaign.id);
    const placements = mockStore.listPlacements({ campaignId: campaign.id });
    const placementsWithPricing = placements.filter(p => p.pricingSchedule.pricingPeriods && p.pricingSchedule.pricingPeriods.length > 0);
    expect(result.placements.length).toBe(placementsWithPricing.length);
  });

  it('computes spend pacing when CPM pricing is available', () => {
    const campaigns = mockStore.listCampaigns({});
    const campaign = campaigns[0]!;
    const result = mockStore.getPacingAnalysis(campaign.id);
    const p = result.placements[0]!;
    expect(typeof p.budget).toBe('number');
    expect(typeof p.spend).toBe('number');
    expect(p.budget).toBeGreaterThan(0);
  });
});

describe('cm360_pacing_analysis (executor integration)', () => {
  it('executeTool dispatches to mock store', async () => {
    const campaigns = mockStore.listCampaigns({});
    const campaign = campaigns[0]!;
    const result = await executeTool('cm360_pacing_analysis', {
      profileId: PROFILE_ID,
      campaignId: campaign.id,
    });
    expect(result.isError).toBe(false);
    expect((result.result as Record<string, unknown>).campaignName).toBe(campaign.name);
  });

  it('CM360_TOOLS includes cm360_pacing_analysis', () => {
    const tool = CM360_TOOLS.find((t) => t.name === 'cm360_pacing_analysis');
    expect(tool).toBeDefined();
    expect(tool!.input_schema.required).toContain('profileId');
    expect(tool!.input_schema.required).toContain('campaignId');
  });

  it('TOOL_FLAG_MAP gates pacing under read_operations', () => {
    expect(TOOL_FLAG_MAP['cm360_pacing_analysis']).toBe('cm360.read_operations');
  });
});

describe('system prompt includes pacing workflow', () => {
  it('mentions cm360_pacing_analysis tool', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('cm360_pacing_analysis');
  });

  it('describes pacing workflow steps', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('Pacing');
    expect(KIKI_SYSTEM_PROMPT).toContain('under-delivering');
  });
});
