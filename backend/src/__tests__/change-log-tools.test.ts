/**
 * Tests for the 2 change log tools:
 * - cm360_list_change_logs (list with filters)
 * - cm360_get_change_log (get single entry by ID)
 *
 * Tests cover:
 * - Tool executor mock path (executeTool)
 * - Zod input validation (schema rejection of bad inputs)
 * - Happy path list/get
 * - Filtering by objectType, action, date range, searchString
 * - maxResults limit
 * - Not-found error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';

const PROFILE_ID = '12345';

beforeEach(() => {
  mockStore.reset();
});

// ---------------------------------------------------------------------------
// cm360_list_change_logs
// ---------------------------------------------------------------------------

describe('cm360_list_change_logs', () => {
  it('returns all change logs when no filters applied', async () => {
    const result = await executeTool('cm360_list_change_logs', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { changeLogs: unknown[]; totalResults: number };
    expect(data.changeLogs.length).toBeGreaterThanOrEqual(10);
    expect(data.totalResults).toBe(data.changeLogs.length);
  });

  it('filters by objectType', async () => {
    const result = await executeTool('cm360_list_change_logs', {
      profileId: PROFILE_ID,
      objectType: 'OBJECT_CAMPAIGN',
    });
    expect(result.isError).toBe(false);
    const data = result.result as { changeLogs: Array<{ objectType: string }> };
    expect(data.changeLogs.length).toBeGreaterThan(0);
    for (const cl of data.changeLogs) {
      expect(cl.objectType).toBe('OBJECT_CAMPAIGN');
    }
  });

  it('filters by action', async () => {
    const result = await executeTool('cm360_list_change_logs', {
      profileId: PROFILE_ID,
      action: 'ACTION_CREATE',
    });
    expect(result.isError).toBe(false);
    const data = result.result as { changeLogs: Array<{ action: string }> };
    expect(data.changeLogs.length).toBeGreaterThan(0);
    for (const cl of data.changeLogs) {
      expect(cl.action).toBe('ACTION_CREATE');
    }
  });

  it('filters by date range (minChangeTime)', async () => {
    // Get all change logs first to find a date to filter on
    const allResult = await executeTool('cm360_list_change_logs', {
      profileId: PROFILE_ID,
    });
    const allLogs = (allResult.result as { changeLogs: Array<{ changeTime: string }> }).changeLogs;
    // Sort ascending, take middle timestamp as min filter
    const sorted = [...allLogs].sort((a, b) => new Date(a.changeTime).getTime() - new Date(b.changeTime).getTime());
    const midTime = sorted[Math.floor(sorted.length / 2)]!.changeTime;

    const result = await executeTool('cm360_list_change_logs', {
      profileId: PROFILE_ID,
      minChangeTime: midTime,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { changeLogs: Array<{ changeTime: string }> };
    for (const cl of data.changeLogs) {
      expect(new Date(cl.changeTime).getTime()).toBeGreaterThanOrEqual(new Date(midTime).getTime());
    }
  });

  it('respects maxResults limit', async () => {
    const result = await executeTool('cm360_list_change_logs', {
      profileId: PROFILE_ID,
      maxResults: 3,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { changeLogs: unknown[] };
    expect(data.changeLogs.length).toBeLessThanOrEqual(3);
  });

  it('returns results sorted by changeTime descending (newest first)', async () => {
    const result = await executeTool('cm360_list_change_logs', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { changeLogs: Array<{ changeTime: string }> };
    for (let i = 1; i < data.changeLogs.length; i++) {
      const prev = new Date(data.changeLogs[i - 1]!.changeTime).getTime();
      const curr = new Date(data.changeLogs[i]!.changeTime).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('filters by searchString', async () => {
    const result = await executeTool('cm360_list_change_logs', {
      profileId: PROFILE_ID,
      searchString: 'name',
    });
    expect(result.isError).toBe(false);
    const data = result.result as { changeLogs: Array<{ fieldName?: string; oldValue?: string; newValue?: string; objectType: string; action: string }> };
    // Each result should contain 'name' somewhere in its searchable fields
    for (const cl of data.changeLogs) {
      const searchable = [
        cl.objectType,
        cl.action,
        cl.fieldName ?? '',
        cl.oldValue ?? '',
        cl.newValue ?? '',
      ].join(' ').toLowerCase();
      expect(searchable).toContain('name');
    }
  });

  it('rejects missing profileId', async () => {
    const result = await executeTool('cm360_list_change_logs', {});
    expect(result.isError).toBe(true);
    const details = (result.result as Record<string, string>)?.details ?? '';
    expect(details).toContain('profileId');
  });

  it('rejects invalid objectType', async () => {
    const result = await executeTool('cm360_list_change_logs', {
      profileId: PROFILE_ID,
      objectType: 'INVALID_TYPE',
    });
    expect(result.isError).toBe(true);
  });

  it('rejects invalid action', async () => {
    const result = await executeTool('cm360_list_change_logs', {
      profileId: PROFILE_ID,
      action: 'INVALID_ACTION',
    });
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cm360_get_change_log
// ---------------------------------------------------------------------------

describe('cm360_get_change_log', () => {
  it('returns a change log entry by ID', async () => {
    // First, list to get a valid ID
    const listResult = await executeTool('cm360_list_change_logs', {
      profileId: PROFILE_ID,
      maxResults: 1,
    });
    const firstLog = (listResult.result as { changeLogs: Array<{ id: string }> }).changeLogs[0]!;

    const result = await executeTool('cm360_get_change_log', {
      profileId: PROFILE_ID,
      changeLogId: firstLog.id,
    });
    expect(result.isError).toBe(false);
    const log = result.result as { id: string; objectType: string; action: string; changeTime: string };
    expect(log.id).toBe(firstLog.id);
    expect(log.objectType).toBeTruthy();
    expect(log.action).toBeTruthy();
    expect(log.changeTime).toBeTruthy();
  });

  it('returns error for nonexistent change log', async () => {
    const result = await executeTool('cm360_get_change_log', {
      profileId: PROFILE_ID,
      changeLogId: 'nonexistent-id',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });

  it('rejects missing profileId', async () => {
    const result = await executeTool('cm360_get_change_log', {
      changeLogId: '123',
    });
    expect(result.isError).toBe(true);
    const details = (result.result as Record<string, string>)?.details ?? '';
    expect(details).toContain('profileId');
  });

  it('rejects missing changeLogId', async () => {
    const result = await executeTool('cm360_get_change_log', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(true);
    const details = (result.result as Record<string, string>)?.details ?? '';
    expect(details).toContain('changeLogId');
  });
});
