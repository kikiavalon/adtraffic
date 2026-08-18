/**
 * Impact analyzer tests — verifies downstream impact warnings
 * for elevated/destructive write operations before confirmation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../cm360/mock-data-store.js', () => ({
  mockStore: {
    listPlacements: vi.fn(),
    listAds: vi.fn(),
  },
}));

import { analyzeImpact } from '../cm360/impact-analyzer.js';
import { mockStore } from '../cm360/mock-data-store.js';

const mockedStore = vi.mocked(mockStore);

describe('analyzeImpact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Read-only tools return no warnings ---
  describe('non-write tools', () => {
    it('returns empty array for read-only tools', async () => {
      const result = await analyzeImpact('cm360_list_campaigns', {});
      expect(result).toEqual([]);
    });

    it('returns empty array for cm360_get_campaign', async () => {
      const result = await analyzeImpact('cm360_get_campaign', { campaignId: '123' });
      expect(result).toEqual([]);
    });

    it('returns empty array for cm360_list_placements', async () => {
      const result = await analyzeImpact('cm360_list_placements', { campaignId: '123' });
      expect(result).toEqual([]);
    });
  });

  // --- Standard write tools (no archive/deactivate) return no warnings ---
  describe('standard write tools without archive/deactivate', () => {
    it('returns empty array for create operations', async () => {
      const result = await analyzeImpact('cm360_create_campaign', {
        name: 'Test Campaign',
        advertiserId: '123',
      });
      expect(result).toEqual([]);
    });

    it('returns empty array for update with no archive/deactivate', async () => {
      const result = await analyzeImpact('cm360_update_campaign', {
        campaignId: '123',
        name: 'New Name',
      });
      expect(result).toEqual([]);
    });

    it('returns empty array for placement update with ACTIVE status', async () => {
      const result = await analyzeImpact('cm360_update_placement', {
        placementId: '456',
        activeStatus: 'ACTIVE',
      });
      expect(result).toEqual([]);
    });
  });

  // --- Campaign archive ---
  describe('cm360_update_campaign with archived: true', () => {
    it('warns about active placements in the campaign', async () => {
      mockedStore.listPlacements.mockReturnValue([
        { id: '1', name: 'Placement 1', campaignId: '123', activeStatus: 'ACTIVE' },
        { id: '2', name: 'Placement 2', campaignId: '123', activeStatus: 'ACTIVE' },
        { id: '3', name: 'Placement 3', campaignId: '123', activeStatus: 'INACTIVE' },
      ] as never);
      mockedStore.listAds.mockReturnValue([]);

      const result = await analyzeImpact('cm360_update_campaign', {
        campaignId: '123',
        archived: true,
      });

      expect(result).toContainEqual(
        expect.stringContaining('2 active placement(s)'),
      );
      expect(mockedStore.listPlacements).toHaveBeenCalledWith({ campaignId: '123' });
    });

    it('warns about active (non-archived) ads in the campaign', async () => {
      mockedStore.listPlacements.mockReturnValue([]);
      mockedStore.listAds.mockReturnValue([
        { id: '10', name: 'Ad 1', campaignId: '123', archived: false },
        { id: '11', name: 'Ad 2', campaignId: '123', archived: false },
        { id: '12', name: 'Ad 3', campaignId: '123', archived: true },
      ] as never);

      const result = await analyzeImpact('cm360_update_campaign', {
        campaignId: '123',
        archived: true,
      });

      // Only 2 non-archived ads should be counted
      expect(result).toContainEqual(
        expect.stringContaining('2 active ad(s)'),
      );
      expect(mockedStore.listAds).toHaveBeenCalledWith({ campaignId: '123' });
    });

    it('returns both placement and ad warnings when both exist', async () => {
      mockedStore.listPlacements.mockReturnValue([
        { id: '1', name: 'P1', campaignId: '123', activeStatus: 'ACTIVE' },
      ] as never);
      mockedStore.listAds.mockReturnValue([
        { id: '10', name: 'A1', campaignId: '123', archived: false },
        { id: '11', name: 'A2', campaignId: '123', archived: false },
      ] as never);

      const result = await analyzeImpact('cm360_update_campaign', {
        campaignId: '123',
        archived: true,
      });

      expect(result.length).toBe(2);
      expect(result).toContainEqual(expect.stringContaining('1 active placement(s)'));
      expect(result).toContainEqual(expect.stringContaining('2 active ad(s)'));
    });

    it('returns empty array when campaign has no placements or ads', async () => {
      mockedStore.listPlacements.mockReturnValue([]);
      mockedStore.listAds.mockReturnValue([]);

      const result = await analyzeImpact('cm360_update_campaign', {
        campaignId: '123',
        archived: true,
      });

      expect(result).toEqual([]);
    });

    it('does not count already-archived ads', async () => {
      mockedStore.listPlacements.mockReturnValue([]);
      mockedStore.listAds.mockReturnValue([
        { id: '10', name: 'Ad 1', campaignId: '123', archived: true },
        { id: '11', name: 'Ad 2', campaignId: '123', archived: true },
      ] as never);

      const result = await analyzeImpact('cm360_update_campaign', {
        campaignId: '123',
        archived: true,
      });

      const adWarning = result.find((w) => w.includes('ad(s)'));
      expect(adWarning).toBeUndefined();
    });

    it('only counts active placements, not inactive or archived', async () => {
      mockedStore.listPlacements.mockReturnValue([
        { id: '1', activeStatus: 'INACTIVE' },
        { id: '2', activeStatus: 'ARCHIVED' },
        { id: '3', activeStatus: 'PERMANENTLY_ARCHIVED' },
      ] as never);
      mockedStore.listAds.mockReturnValue([]);

      const result = await analyzeImpact('cm360_update_campaign', {
        campaignId: '123',
        archived: true,
      });

      // No active placements, so no placement warning
      const placementWarning = result.find((w) => w.includes('active placement'));
      expect(placementWarning).toBeUndefined();
    });
  });

  // --- Placement deactivation/archive ---
  describe('cm360_update_placement status changes', () => {
    it('warns about INACTIVE status change', async () => {
      const result = await analyzeImpact('cm360_update_placement', {
        placementId: '456',
        activeStatus: 'INACTIVE',
      });

      expect(result).toContainEqual(
        expect.stringContaining('will stop serving ads'),
      );
    });

    it('warns about ARCHIVED status', async () => {
      const result = await analyzeImpact('cm360_update_placement', {
        placementId: '456',
        activeStatus: 'ARCHIVED',
      });

      expect(result).toContainEqual(
        expect.stringContaining('will stop serving ads'),
      );
    });

    it('warns PERMANENTLY_ARCHIVED is irreversible', async () => {
      const result = await analyzeImpact('cm360_update_placement', {
        placementId: '456',
        activeStatus: 'PERMANENTLY_ARCHIVED',
      });

      expect(result).toContainEqual(
        expect.stringContaining('permanent'),
      );
      expect(result).toContainEqual(
        expect.stringContaining('cannot be undone'),
      );
    });
  });

  // --- Creative archive ---
  describe('cm360_update_creative with archived: true', () => {
    it('warns about ads that may reference the creative', async () => {
      const result = await analyzeImpact('cm360_update_creative', {
        creativeId: '789',
        archived: true,
      });

      expect(result).toContainEqual(
        expect.stringContaining('ads that reference'),
      );
    });

    it('returns empty array when not archiving', async () => {
      const result = await analyzeImpact('cm360_update_creative', {
        creativeId: '789',
        name: 'New Creative Name',
      });

      expect(result).toEqual([]);
    });
  });

  // --- Ad archive ---
  describe('cm360_update_ad with archived: true', () => {
    it('warns about stopping serving', async () => {
      const result = await analyzeImpact('cm360_update_ad', {
        adId: '101',
        archived: true,
      });

      expect(result).toContainEqual(
        expect.stringContaining('stop it from serving'),
      );
    });

    it('returns empty array when not archiving', async () => {
      const result = await analyzeImpact('cm360_update_ad', {
        adId: '101',
        name: 'New Ad Name',
      });

      expect(result).toEqual([]);
    });
  });

  // --- Landing page archive ---
  describe('cm360_update_landing_page with archived: true', () => {
    it('warns about campaigns that may use the landing page', async () => {
      const result = await analyzeImpact('cm360_update_landing_page', {
        landingPageId: '202',
        archived: true,
      });

      expect(result).toContainEqual(
        expect.stringContaining('campaigns that use them as default'),
      );
    });

    it('returns empty array when not archiving', async () => {
      const result = await analyzeImpact('cm360_update_landing_page', {
        landingPageId: '202',
        name: 'New Landing Page Name',
      });

      expect(result).toEqual([]);
    });
  });

  // --- Edge cases ---
  describe('edge cases', () => {
    it('handles missing campaignId gracefully for campaign archive', async () => {
      const result = await analyzeImpact('cm360_update_campaign', {
        archived: true,
        // no campaignId — shouldn't crash
      });

      // Should not throw, should return empty (no campaign to analyze)
      expect(result).toEqual([]);
    });

    it('works identically with or without userId parameter', async () => {
      mockedStore.listPlacements.mockReturnValue([
        { id: '1', activeStatus: 'ACTIVE' },
      ] as never);
      mockedStore.listAds.mockReturnValue([]);

      const withUser = await analyzeImpact('cm360_update_campaign', {
        campaignId: '123',
        archived: true,
      }, 'user-123');

      vi.clearAllMocks();
      mockedStore.listPlacements.mockReturnValue([
        { id: '1', activeStatus: 'ACTIVE' },
      ] as never);
      mockedStore.listAds.mockReturnValue([]);

      const withoutUser = await analyzeImpact('cm360_update_campaign', {
        campaignId: '123',
        archived: true,
      });

      expect(withUser).toEqual(withoutUser);
    });

    it('handles unknown tool names gracefully', async () => {
      const result = await analyzeImpact('cm360_unknown_tool', {
        archived: true,
      });

      expect(result).toEqual([]);
    });

    it('handles mock store errors gracefully', async () => {
      mockedStore.listPlacements.mockImplementation(() => {
        throw new Error('Mock store error');
      });

      // Should not throw — should return empty array
      const result = await analyzeImpact('cm360_update_campaign', {
        campaignId: '123',
        archived: true,
      });

      expect(result).toEqual([]);
    });
  });
});
