import { describe, it, expect } from 'vitest';
import { qaRead, QA_READ_ALLOWLIST, QA_READ_EXTRA, QAReadOnlyViolationError } from '../qa/qa-read.js';
import { mockStore } from '../cm360/mock-data-store.js';

describe('qa-read read-only invariant', () => {
  it('every allowlisted tool is a list/get tool', () => {
    for (const name of QA_READ_ALLOWLIST) {
      expect(name).toMatch(/^cm360_(list|get)_/);
    }
  });

  it('throws QAReadOnlyViolationError for a mutating tool', async () => {
    await expect(qaRead('cm360_update_ad', { profileId: 'p', adId: '1', name: 'x' }))
      .rejects.toThrow(QAReadOnlyViolationError);
  });

  it('throws even for read-shaped tools not on the allowlist', async () => {
    await expect(qaRead('cm360_list_reports', { profileId: 'p' }))
      .rejects.toThrow(QAReadOnlyViolationError);
  });

  it('executes an allowlisted read against the mock store', async () => {
    const campaign = mockStore.listCampaigns()[0]!;
    const result = await qaRead('cm360_get_campaign', { profileId: 'p', campaignId: campaign.id });
    expect(result.isError).toBe(false);
    expect((result.result as { id: string }).id).toBe(campaign.id);
  });

  it('QA_READ_EXTRA contains exactly the generate-tags carve-out', () => {
    expect([...QA_READ_EXTRA]).toEqual(['cm360_generate_tags']);
  });

  it('executes cm360_generate_tags (read-only tag export) against the mock store', async () => {
    const campaign = mockStore.listCampaigns()[0]!;
    const placement = mockStore.listPlacements({ campaignId: campaign.id })[0]!;
    const result = await qaRead('cm360_generate_tags', { profileId: 'p', campaignId: campaign.id, placementIds: [placement.id] });
    expect(result.isError).toBe(false);
  });
});
