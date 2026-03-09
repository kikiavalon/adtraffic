import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';

const PROFILE_ID = '12345';

beforeEach(() => {
  mockStore.reset();
});

describe('Article 50(2) — AI-generated output metadata', () => {
  describe('cm360_generate_tags', () => {
    it('includes AI attribution comment in generated tag code', async () => {
      const campaigns = mockStore.listCampaigns();
      const placements = mockStore.listPlacements({ campaignId: campaigns[0]!.id });
      const result = await executeTool('cm360_generate_tags', {
        profileId: PROFILE_ID,
        campaignId: campaigns[0]!.id,
        placementIds: [placements[0]!.id],
      });
      expect(result.isError).toBe(false);
      const resultStr = JSON.stringify(result);
      expect(resultStr).toContain('AI-Generated');
      expect(resultStr).toContain('AdTraffic.ai');
    });
  });

  describe('cm360_generate_floodlight_tag', () => {
    it('includes AI attribution comment in floodlight tag code', async () => {
      const advertisers = mockStore.listAdvertisers();
      const activities = mockStore.listFloodlightActivities(advertisers[0]!.id);
      const result = await executeTool('cm360_generate_floodlight_tag', {
        profileId: PROFILE_ID,
        floodlightActivityId: activities[0]!.id,
      });
      expect(result.isError).toBe(false);
      const resultStr = JSON.stringify(result);
      expect(resultStr).toContain('AI-Generated');
      expect(resultStr).toContain('AdTraffic.ai');
    });
  });

  describe('cm360_get_report_file', () => {
    it('includes _ai_generated metadata in report results', async () => {
      const reports = mockStore.listReports();
      // Run the report first to create a file
      const runResult = await executeTool('cm360_run_report', {
        profileId: PROFILE_ID,
        reportId: reports[0]!.id,
      });
      const runFile = runResult.result as { fileId: string };

      const result = await executeTool('cm360_get_report_file', {
        profileId: PROFILE_ID,
        reportId: reports[0]!.id,
        fileId: runFile.fileId,
      });
      expect(result.isError).toBe(false);
      const resultStr = JSON.stringify(result);
      expect(resultStr).toContain('_ai_generated');
      expect(resultStr).toContain('adtraffic.ai');
    });
  });
});
