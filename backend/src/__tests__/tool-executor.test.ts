import { describe, it, expect } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';

describe('tool-executor', () => {
  describe('cm360_list_profiles', () => {
    it('returns mock profiles', async () => {
      const result = await executeTool('cm360_list_profiles', {});
      expect(result.isError).toBe(false);
      expect(result.result).toHaveProperty('profiles');
      const profiles = (result.result as { profiles: unknown[] }).profiles;
      expect(profiles.length).toBeGreaterThan(0);
    });
  });

  describe('cm360_list_advertisers', () => {
    it('returns all advertisers without filter', async () => {
      const result = await executeTool('cm360_list_advertisers', { profileId: '12345' });
      expect(result.isError).toBe(false);
      const data = result.result as { advertisers: unknown[] };
      expect(data.advertisers.length).toBe(3);
    });

    it('filters advertisers by search string', async () => {
      const result = await executeTool('cm360_list_advertisers', {
        profileId: '12345',
        searchString: 'toyota',
      });
      expect(result.isError).toBe(false);
      const data = result.result as { advertisers: Array<{ name: string }> };
      expect(data.advertisers.length).toBe(1);
      expect(data.advertisers[0]!.name).toBe('Toyota USA');
    });
  });

  describe('cm360_get_advertiser', () => {
    it('returns advertiser by ID', async () => {
      const result = await executeTool('cm360_get_advertiser', {
        profileId: '12345',
        advertiserId: '100',
      });
      expect(result.isError).toBe(false);
      expect(result.result).toHaveProperty('name', 'Toyota USA');
    });

    it('returns error for unknown advertiser', async () => {
      const result = await executeTool('cm360_get_advertiser', {
        profileId: '12345',
        advertiserId: '999',
      });
      expect(result.isError).toBe(true);
      expect(result.errorMessage).toContain('not found');
    });
  });

  describe('cm360_list_campaigns', () => {
    it('returns campaigns filtered by advertiser', async () => {
      const result = await executeTool('cm360_list_campaigns', {
        profileId: '12345',
        advertiserId: '100',
      });
      expect(result.isError).toBe(false);
      const data = result.result as { campaigns: unknown[] };
      expect(data.campaigns.length).toBe(2);
    });
  });

  describe('cm360_create_campaign', () => {
    it('returns created campaign with mock flag', async () => {
      const result = await executeTool('cm360_create_campaign', {
        profileId: '12345',
        advertiserId: '100',
        name: 'Test Campaign',
        startDate: '2026-03-01',
        endDate: '2026-06-30',
        defaultLandingPageId: '5001',
      });
      expect(result.isError).toBe(false);
      const campaign = result.result as { name: string; _mock: boolean };
      expect(campaign.name).toBe('Test Campaign');
      expect(campaign._mock).toBe(true);
    });
  });

  describe('cm360_list_sites', () => {
    it('returns sites filtered by search', async () => {
      const result = await executeTool('cm360_list_sites', {
        profileId: '12345',
        searchString: 'espn',
      });
      expect(result.isError).toBe(false);
      const data = result.result as { sites: Array<{ name: string }> };
      expect(data.sites.length).toBe(1);
      expect(data.sites[0]!.name).toBe('ESPN.com');
    });
  });

  describe('cm360_generate_tags', () => {
    it('returns tags for placement IDs', async () => {
      const result = await executeTool('cm360_generate_tags', {
        profileId: '12345',
        campaignId: '1001',
        placementIds: ['3001', '3002'],
      });
      expect(result.isError).toBe(false);
      const data = result.result as { placementTags: Array<{ placementId: string }> };
      expect(data.placementTags.length).toBe(2);
      expect(data.placementTags[0]!.placementId).toBe('3001');
    });
  });

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const result = await executeTool('cm360_nonexistent', {});
      expect(result.isError).toBe(true);
      expect(result.errorMessage).toContain('Unknown tool');
    });
  });
});
