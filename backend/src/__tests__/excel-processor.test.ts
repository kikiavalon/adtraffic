import { describe, it, expect } from 'vitest';
import { processExcel } from '../io/excel-processor.js';

describe('Excel/CSV Processor', () => {
  // Helper: create a minimal XLSX file as base64 using xlsx library
  async function createTestWorkbook(rows: string[][]): Promise<string> {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buffer).toString('base64');
  }

  it('converts Excel data to structured text table', async () => {
    const data = await createTestWorkbook([
      ['Site', 'Size', 'Start Date', 'End Date', 'Rate', 'Rate Type'],
      ['ESPN.com', '300x250', '2026-04-01', '2026-06-30', '12', 'CPM'],
      ['NYT.com', '728x90', '2026-04-15', '2026-05-31', '18', 'CPM'],
    ]);

    const result = await processExcel(data, 'test.xlsx');

    expect(result).toContain('ESPN.com');
    expect(result).toContain('NYT.com');
    expect(result).toContain('300x250');
    expect(result).toContain('728x90');
    expect(result).toContain('CPM');
  });

  it('handles multiple sheets', async () => {
    const XLSX = await import('xlsx');
    const ws1 = XLSX.utils.aoa_to_sheet([['Campaign Info'], ['Nike Q2 2026']]);
    const ws2 = XLSX.utils.aoa_to_sheet([['Placements'], ['ESPN.com', '300x250']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Campaign');
    XLSX.utils.book_append_sheet(wb, ws2, 'Placements');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const data = Buffer.from(buffer).toString('base64');

    const result = await processExcel(data, 'test.xlsx');

    expect(result).toContain('Campaign');
    expect(result).toContain('Placements');
    expect(result).toContain('Nike Q2 2026');
    expect(result).toContain('ESPN.com');
  });

  it('handles CSV files', async () => {
    const csvContent = 'Site,Size,Rate\nESPN.com,300x250,12\n';
    const data = Buffer.from(csvContent).toString('base64');

    const result = await processExcel(data, 'test.csv');

    expect(result).toContain('ESPN.com');
    expect(result).toContain('300x250');
  });

  it('handles empty workbook gracefully', async () => {
    const data = await createTestWorkbook([]);
    const result = await processExcel(data, 'empty.xlsx');
    expect(typeof result).toBe('string');
  });

  it('throws on invalid base64 data', async () => {
    await expect(processExcel('not-valid-base64!!!', 'bad.xlsx')).rejects.toThrow();
  });
});
