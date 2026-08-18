import { describe, it, expect, vi } from 'vitest';
import { executeToolReal } from '../cm360/tool-executor.js';
import type { CM360Client } from '../cm360/cm360-client.js';
import type { CM360PlacementGroup } from '@adtraffic/shared';

const PROFILE = { profileId: '111', accountId: '222', accountName: 'Agency', userName: 'u@test.com', etag: 'e' };

function group(overrides: Partial<CM360PlacementGroup> = {}): CM360PlacementGroup {
  return {
    id: '700',
    name: 'Roadblock',
    accountId: '222',
    advertiserId: '100',
    campaignId: '500',
    siteId: '400',
    placementGroupType: 'PLACEMENT_ROADBLOCK',
    placementIds: [],
    activeStatus: 'ACTIVE',
    pricingSchedule: { startDate: '2026-01-01', endDate: '2026-03-31' },
    ...overrides,
  };
}

/** Minimal fake client — only the methods the placement-group cases touch. */
function fakeClient(overrides: Partial<Record<keyof CM360Client, unknown>> = {}): CM360Client {
  return {
    listProfiles: vi.fn().mockResolvedValue([PROFILE]),
    listPlacementGroups: vi.fn(),
    getPlacementGroup: vi.fn(),
    createPlacementGroup: vi.fn(),
    updatePlacementGroup: vi.fn(),
    setPlacementGroup: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as CM360Client;
}

describe('executeToolReal — placement groups (live grouping)', () => {
  describe('cm360_list_placement_groups', () => {
    it('lists groups for a campaign passing filters through', async () => {
      const groups = [group()];
      const client = fakeClient({ listPlacementGroups: vi.fn().mockResolvedValue(groups) });

      const result = await executeToolReal('cm360_list_placement_groups', {
        profileId: 'ignored', campaignId: '500', advertiserId: '100', searchString: 'road', maxResults: 50,
      }, client, 'user1');

      expect(result.isError).toBe(false);
      expect(result.result).toEqual({ placementGroups: groups });
      expect(client.listPlacementGroups).toHaveBeenCalledWith('111', '500', {
        advertiserId: '100', searchString: 'road', maxResults: 50,
      });
    });
  });

  describe('cm360_get_placement_group', () => {
    it('returns the group when found', async () => {
      const g = group();
      const client = fakeClient({ getPlacementGroup: vi.fn().mockResolvedValue(g) });

      const result = await executeToolReal('cm360_get_placement_group', {
        profileId: 'x', placementGroupId: '700',
      }, client, 'user1');

      expect(result.isError).toBe(false);
      expect(result.result).toEqual(g);
    });

    it('returns a not-found error when null', async () => {
      const client = fakeClient({ getPlacementGroup: vi.fn().mockResolvedValue(null) });

      const result = await executeToolReal('cm360_get_placement_group', {
        profileId: 'x', placementGroupId: '999',
      }, client, 'user1');

      expect(result.isError).toBe(true);
      expect(result.errorMessage).toBe('Placement group 999 not found');
    });
  });

  describe('cm360_create_placement_group', () => {
    const baseInput = {
      profileId: 'x', campaignId: '500', siteId: '400', name: 'Roadblock',
      placementGroupType: 'PLACEMENT_ROADBLOCK', startDate: '2026-01-01', endDate: '2026-03-31',
    };

    it('creates the group and groups each placement via setPlacementGroup', async () => {
      // Insert returns a group with EMPTY membership (childPlacementIds is output-only);
      // the re-read after the setPlacementGroup patches reports truthful membership.
      const inserted = group({ id: '700', placementIds: [] });
      const reRead = group({ id: '700', placementIds: ['800', '801'] });
      const setPlacementGroup = vi.fn().mockResolvedValue(undefined);
      const client = fakeClient({
        createPlacementGroup: vi.fn().mockResolvedValue(inserted),
        getPlacementGroup: vi.fn().mockResolvedValue(reRead),
        setPlacementGroup,
      });

      const result = await executeToolReal('cm360_create_placement_group', {
        ...baseInput, placementIds: ['800', '801'],
      }, client, 'user1');

      expect(result.isError).toBe(false);
      // The returned group is the RE-READ one, so group.placementIds reflects the grouped members.
      expect(result.result).toEqual({ group: reRead, grouped: ['800', '801'], failedToGroup: [] });
      expect((result.result as { group: CM360PlacementGroup }).group.placementIds).toEqual(['800', '801']);
      expect(client.getPlacementGroup).toHaveBeenCalledWith('111', '700');
      expect(setPlacementGroup).toHaveBeenCalledWith('111', '800', '700');
      expect(setPlacementGroup).toHaveBeenCalledWith('111', '801', '700');
    });

    it('falls back to the insert response if the re-read returns null', async () => {
      const inserted = group({ id: '700', placementIds: [] });
      const client = fakeClient({
        createPlacementGroup: vi.fn().mockResolvedValue(inserted),
        getPlacementGroup: vi.fn().mockResolvedValue(null),
      });

      const result = await executeToolReal('cm360_create_placement_group', {
        ...baseInput, placementIds: ['800'],
      }, client, 'user1');

      expect(result.isError).toBe(false);
      expect(result.result).toEqual({ group: inserted, grouped: ['800'], failedToGroup: [] });
    });

    it('returns empty arrays when no placementIds are supplied', async () => {
      const g = group({ id: '700' });
      const setPlacementGroup = vi.fn();
      const client = fakeClient({
        createPlacementGroup: vi.fn().mockResolvedValue(g),
        setPlacementGroup,
      });

      const result = await executeToolReal('cm360_create_placement_group', baseInput, client, 'user1');

      expect(result.isError).toBe(false);
      expect(result.result).toEqual({ group: g, grouped: [], failedToGroup: [] });
      expect(setPlacementGroup).not.toHaveBeenCalled();
    });

    it('never silently drops a grouping failure — it lands in failedToGroup', async () => {
      const g = group({ id: '700' });
      const setPlacementGroup = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('placement 801 is on another campaign'));
      const client = fakeClient({
        createPlacementGroup: vi.fn().mockResolvedValue(g),
        setPlacementGroup,
      });

      const result = await executeToolReal('cm360_create_placement_group', {
        ...baseInput, placementIds: ['800', '801'],
      }, client, 'user1');

      expect(result.isError).toBe(false);
      expect(result.result).toEqual({
        group: g,
        grouped: ['800'],
        failedToGroup: [{ id: '801', error: 'placement 801 is on another campaign' }],
      });
    });
  });

  describe('cm360_update_placement_group', () => {
    it('reconciles membership — adds new, unsets removed, and returns the re-read group', async () => {
      // Current members: 800, 801. Desired: 801, 802 → add 802, remove 800.
      const before = group({ id: '700', placementIds: ['800', '801'] });
      // Truthful post-reconciliation state (re-read at the end reflects the per-placement patches).
      const after = group({ id: '700', placementIds: ['801', '802'] });
      const setPlacementGroup = vi.fn().mockResolvedValue(undefined);
      const getPlacementGroup = vi.fn()
        .mockResolvedValueOnce(before) // snapshot
        .mockResolvedValueOnce(after); // truthful re-read
      const client = fakeClient({
        getPlacementGroup,
        updatePlacementGroup: vi.fn().mockResolvedValue(before),
        setPlacementGroup,
      });

      const result = await executeToolReal('cm360_update_placement_group', {
        profileId: 'x', placementGroupId: '700', name: 'Renamed', placementIds: ['801', '802'],
      }, client, 'user1');

      expect(result.isError).toBe(false);
      // group is the RE-READ (after) object, not the pre-reconciliation snapshot.
      expect(result.result).toEqual({ group: after, added: ['802'], removed: ['800'], failed: [] });
      // Added placement gets the group id; removed placement gets null.
      expect(setPlacementGroup).toHaveBeenCalledWith('111', '802', '700');
      expect(setPlacementGroup).toHaveBeenCalledWith('111', '800', null);
      // Unchanged member 801 is left alone.
      expect(setPlacementGroup).toHaveBeenCalledTimes(2);
    });

    it('skips the group patch entirely when only placementIds is supplied (no empty patch)', async () => {
      const before = group({ id: '700', placementIds: ['800'] });
      const after = group({ id: '700', placementIds: ['900'] });
      const updatePlacementGroup = vi.fn();
      const getPlacementGroup = vi.fn()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      const client = fakeClient({
        getPlacementGroup,
        updatePlacementGroup,
        setPlacementGroup: vi.fn().mockResolvedValue(undefined),
      });

      const result = await executeToolReal('cm360_update_placement_group', {
        profileId: 'x', placementGroupId: '700', placementIds: ['900'],
      }, client, 'user1');

      expect(result.isError).toBe(false);
      // With no group-level field, updatePlacementGroup must NOT be called (would be an empty patch).
      expect(updatePlacementGroup).not.toHaveBeenCalled();
      expect(result.result).toEqual({ group: after, added: ['900'], removed: ['800'], failed: [] });
    });

    it('snapshots current members BEFORE the group patch (reconciliation is not a no-op)', async () => {
      const before = group({ id: '700', placementIds: ['800'] });
      const after = group({ id: '700', placementIds: ['900'] });
      const getPlacementGroup = vi.fn()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      const updatePlacementGroup = vi.fn().mockResolvedValue(group({ id: '700', name: 'Renamed' }));
      const client = fakeClient({ getPlacementGroup, updatePlacementGroup, setPlacementGroup: vi.fn().mockResolvedValue(undefined) });

      await executeToolReal('cm360_update_placement_group', {
        profileId: 'x', placementGroupId: '700', name: 'Renamed', placementIds: ['900'],
      }, client, 'user1');

      // getPlacementGroup (snapshot) must be invoked before updatePlacementGroup (patch).
      const getOrder = getPlacementGroup.mock.invocationCallOrder[0]!;
      const updateOrder = updatePlacementGroup.mock.invocationCallOrder[0]!;
      expect(getOrder).toBeLessThan(updateOrder);
    });

    it('only updates group fields when placementIds is absent (no reconciliation)', async () => {
      const after = group({ id: '700', name: 'Renamed' });
      // No snapshot when not reconciling; getPlacementGroup is called once for the truthful re-read.
      const getPlacementGroup = vi.fn().mockResolvedValue(after);
      const setPlacementGroup = vi.fn();
      const updatePlacementGroup = vi.fn().mockResolvedValue(after);
      const client = fakeClient({ updatePlacementGroup, getPlacementGroup, setPlacementGroup });

      const result = await executeToolReal('cm360_update_placement_group', {
        profileId: 'x', placementGroupId: '700', name: 'Renamed',
      }, client, 'user1');

      expect(result.isError).toBe(false);
      expect(result.result).toEqual({ group: after });
      expect(updatePlacementGroup).toHaveBeenCalledTimes(1);
      // getPlacementGroup called once (re-read only — no membership snapshot when not reconciling).
      expect(getPlacementGroup).toHaveBeenCalledTimes(1);
      expect(setPlacementGroup).not.toHaveBeenCalled();
    });

    it('reports a failed ADD in the failed array (added placement not dropped)', async () => {
      const before = group({ id: '700', placementIds: [] });
      const after = group({ id: '700', placementIds: [] });
      const setPlacementGroup = vi.fn().mockRejectedValue(new Error('placement on another campaign'));
      const getPlacementGroup = vi.fn()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      const client = fakeClient({
        getPlacementGroup,
        updatePlacementGroup: vi.fn(),
        setPlacementGroup,
      });

      const result = await executeToolReal('cm360_update_placement_group', {
        profileId: 'x', placementGroupId: '700', placementIds: ['802'],
      }, client, 'user1');

      expect(result.isError).toBe(false);
      expect(result.result).toEqual({
        group: after,
        added: [],
        removed: [],
        failed: [{ id: '802', error: 'placement on another campaign' }],
      });
    });

    it('reports a failed unset in the failed array (removed placement not dropped)', async () => {
      const before = group({ id: '700', placementIds: ['800'] });
      const after = group({ id: '700', placementIds: ['800'] }); // still a member — the unset failed
      const setPlacementGroup = vi.fn().mockRejectedValue(new Error('locked'));
      const getPlacementGroup = vi.fn()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      const client = fakeClient({
        getPlacementGroup,
        updatePlacementGroup: vi.fn(),
        setPlacementGroup,
      });

      const result = await executeToolReal('cm360_update_placement_group', {
        profileId: 'x', placementGroupId: '700', placementIds: [],
      }, client, 'user1');

      expect(result.isError).toBe(false);
      expect(result.result).toEqual({
        group: after,
        added: [],
        removed: [],
        failed: [{ id: '800', error: 'locked' }],
      });
    });
  });
});
