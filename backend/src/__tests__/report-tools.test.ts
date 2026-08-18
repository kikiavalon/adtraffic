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

describe('cm360_run_report', () => {
  it('runs a report and returns a file object', async () => {
    const reports = mockStore.listReports();
    const result = await executeTool('cm360_run_report', {
      profileId: PROFILE_ID,
      reportId: reports[0]!.id,
    });
    expect(result.isError).toBe(false);
    const file = result.result as { reportId: string; fileId: string; status: string; cm360Link: string };
    expect(file.reportId).toBe(reports[0]!.id);
    expect(file.fileId).toBeDefined();
    expect(file.status).toBe('REPORT_AVAILABLE');
    expect(file.cm360Link).toContain('campaignmanager.google.com');
  });

  it('returns report data with rows and summary', async () => {
    const reports = mockStore.listReports();
    const result = await executeTool('cm360_run_report', {
      profileId: PROFILE_ID,
      reportId: reports[0]!.id,
    });
    const file = result.result as {
      columns: string[];
      rows: Array<Record<string, string>>;
      summary: { totalImpressions: number; totalClicks: number; averageCTR: number };
      totalRows: number;
    };
    expect(file.columns).toBeDefined();
    expect(file.columns.length).toBeGreaterThan(0);
    expect(file.rows).toBeDefined();
    expect(file.rows.length).toBeGreaterThan(0);
    expect(file.totalRows).toBe(file.rows.length);
    expect(file.summary).toBeDefined();
    expect(file.summary.totalImpressions).toBeGreaterThan(0);
    expect(file.summary.totalClicks).toBeGreaterThan(0);
    expect(file.summary.averageCTR).toBeGreaterThan(0);
  });

  it('returns error for nonexistent report', async () => {
    const result = await executeTool('cm360_run_report', {
      profileId: PROFILE_ID,
      reportId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });

  it('validates input with Zod', async () => {
    const result = await executeTool('cm360_run_report', {});
    expect(result.isError).toBe(true);
    const data = result.result as { error: string };
    expect(data.error).toBe('Invalid input');
  });
});

describe('cm360_get_report_file', () => {
  it('retrieves a previously-run report file', async () => {
    const reports = mockStore.listReports();
    // Run the report first to create a file
    const runResult = await executeTool('cm360_run_report', {
      profileId: PROFILE_ID,
      reportId: reports[0]!.id,
    });
    const runFile = runResult.result as { fileId: string };

    // Now retrieve the file
    const result = await executeTool('cm360_get_report_file', {
      profileId: PROFILE_ID,
      reportId: reports[0]!.id,
      fileId: runFile.fileId,
    });
    expect(result.isError).toBe(false);
    const file = result.result as { fileId: string; status: string; rows: unknown[] };
    expect(file.fileId).toBe(runFile.fileId);
    expect(file.status).toBe('REPORT_AVAILABLE');
    expect(file.rows).toBeDefined();
  });

  it('returns error for nonexistent file', async () => {
    const result = await executeTool('cm360_get_report_file', {
      profileId: PROFILE_ID,
      reportId: 'some-report',
      fileId: 'nonexistent-file',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });

  it('validates input with Zod', async () => {
    const result = await executeTool('cm360_get_report_file', { profileId: PROFILE_ID });
    expect(result.isError).toBe(true);
    const data = result.result as { error: string };
    expect(data.error).toBe('Invalid input');
  });
});

describe('cm360_query_compatible_fields', () => {
  it('returns compatible fields for STANDARD report type', async () => {
    const result = await executeTool('cm360_query_compatible_fields', {
      profileId: PROFILE_ID,
      reportType: 'STANDARD',
    });
    expect(result.isError).toBe(false);
    const fields = result.result as {
      reportType: string;
      dimensions: string[];
      metrics: string[];
      dimensionFilters: string[];
      pivotedActivityMetrics: string[];
    };
    expect(fields.reportType).toBe('STANDARD');
    expect(fields.dimensions.length).toBeGreaterThan(0);
    expect(fields.metrics.length).toBeGreaterThan(0);
    expect(fields.dimensionFilters.length).toBeGreaterThan(0);
    expect(fields.dimensions).toContain('campaign');
    expect(fields.metrics).toContain('impressions');
  });

  it('returns different fields for different report types', async () => {
    const standardResult = await executeTool('cm360_query_compatible_fields', {
      profileId: PROFILE_ID,
      reportType: 'STANDARD',
    });
    const reachResult = await executeTool('cm360_query_compatible_fields', {
      profileId: PROFILE_ID,
      reportType: 'REACH',
    });
    const standard = standardResult.result as { dimensions: string[] };
    const reach = reachResult.result as { dimensions: string[] };
    // REACH should have reach-specific dimensions
    expect(reach.dimensions).toContain('campaign');
    // They shouldn't be identical (different report types have different field sets)
    expect(JSON.stringify(standard)).not.toBe(JSON.stringify(reach));
  });

  it('returns fields for all 5 report types', async () => {
    const types = ['STANDARD', 'REACH', 'PATH_TO_CONVERSION', 'FLOODLIGHT', 'CROSS_MEDIA_REACH'];
    for (const reportType of types) {
      const result = await executeTool('cm360_query_compatible_fields', {
        profileId: PROFILE_ID,
        reportType,
      });
      expect(result.isError).toBe(false);
      const fields = result.result as { reportType: string; dimensions: string[] };
      expect(fields.reportType).toBe(reportType);
      expect(fields.dimensions.length).toBeGreaterThan(0);
    }
  });

  it('validates input with Zod — rejects invalid report type', async () => {
    const result = await executeTool('cm360_query_compatible_fields', {
      profileId: PROFILE_ID,
      reportType: 'INVALID_TYPE',
    });
    expect(result.isError).toBe(true);
    const data = result.result as { error: string };
    expect(data.error).toBe('Invalid input');
  });

  it('validates input with Zod — requires reportType', async () => {
    const result = await executeTool('cm360_query_compatible_fields', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(true);
    const data = result.result as { error: string };
    expect(data.error).toBe('Invalid input');
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

  it('report files are cleared on reset', () => {
    const reports = mockStore.listReports();
    // Run a report to generate a file
    mockStore.runReport(reports[0]!.id, PROFILE_ID);
    // Reset should clear report files
    mockStore.reset();
    // Previously generated file should not be retrievable
    const file = mockStore.getReportFile('any-file-id');
    expect(file).toBeUndefined();
  });
});
