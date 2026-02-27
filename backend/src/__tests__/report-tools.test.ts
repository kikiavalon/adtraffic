import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';

const PROFILE_ID = '12345';

beforeEach(() => {
  mockStore.reset();
});

describe('cm360_list_reports', () => {
  it('lists all seeded reports', async () => {
    const result = await executeTool('cm360_list_reports', { profileId: PROFILE_ID });
    expect(result.isError).toBe(false);
    const data = result.result as { reports: unknown[]; totalResults: number };
    expect(data.reports.length).toBe(5);
    expect(data.totalResults).toBe(5);
  });

  it('returns reports with expected structure', async () => {
    const result = await executeTool('cm360_list_reports', { profileId: PROFILE_ID });
    const data = result.result as { reports: Array<{ id: string; name: string; type: string; criteria: { dimensions: string[]; metricNames: string[] } }> };
    const report = data.reports[0]!;
    expect(report.id).toBeDefined();
    expect(report.name).toBeDefined();
    expect(report.type).toBeDefined();
    expect(report.criteria.dimensions.length).toBeGreaterThan(0);
    expect(report.criteria.metricNames.length).toBeGreaterThan(0);
  });

  it('includes STANDARD and REACH report types', async () => {
    const result = await executeTool('cm360_list_reports', { profileId: PROFILE_ID });
    const data = result.result as { reports: Array<{ type: string }> };
    const types = data.reports.map((r) => r.type);
    expect(types).toContain('STANDARD');
    expect(types).toContain('REACH');
  });
});

describe('cm360_get_report', () => {
  it('returns report by ID', async () => {
    const reports = mockStore.listReports();
    const result = await executeTool('cm360_get_report', {
      profileId: PROFILE_ID,
      reportId: reports[0]!.id,
    });
    expect(result.isError).toBe(false);
    expect(result.result).toMatchObject({ id: reports[0]!.id, name: reports[0]!.name });
  });

  it('returns error for nonexistent report', async () => {
    const result = await executeTool('cm360_get_report', {
      profileId: PROFILE_ID,
      reportId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });

  it('includes criteria with dimensions and metrics', async () => {
    const reports = mockStore.listReports();
    const result = await executeTool('cm360_get_report', {
      profileId: PROFILE_ID,
      reportId: reports[0]!.id,
    });
    const report = result.result as { criteria: { dimensions: string[]; metricNames: string[]; dateRange: { startDate: string; endDate: string } } };
    expect(report.criteria.dimensions.length).toBeGreaterThan(0);
    expect(report.criteria.metricNames.length).toBeGreaterThan(0);
    expect(report.criteria.dateRange.startDate).toBeDefined();
    expect(report.criteria.dateRange.endDate).toBeDefined();
  });

  it('includes schedule for scheduled reports', async () => {
    const reports = mockStore.listReports();
    const scheduledReport = reports.find((r) => r.schedule);
    expect(scheduledReport).toBeDefined();
    const result = await executeTool('cm360_get_report', {
      profileId: PROFILE_ID,
      reportId: scheduledReport!.id,
    });
    const report = result.result as { schedule: { active: boolean; repeats: string; every: number } };
    expect(report.schedule).toBeDefined();
    expect(report.schedule.active).toBe(true);
    expect(report.schedule.repeats).toBe('MONTHLY');
  });
});

describe('Report seed data integrity', () => {
  it('has 5 seeded reports', () => {
    expect(mockStore.listReports()).toHaveLength(5);
  });

  it('all reports have valid types', () => {
    const validTypes = ['STANDARD', 'REACH', 'PATH_TO_CONVERSION', 'FLOODLIGHT', 'CROSS_MEDIA_REACH'];
    for (const report of mockStore.listReports()) {
      expect(validTypes).toContain(report.type);
    }
  });
});
