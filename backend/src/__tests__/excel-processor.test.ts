import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { processExcel } from '../io/excel-processor.js';

describe('Excel/CSV Processor', () => {
  // Helper: create a minimal XLSX file as base64 using exceljs
  async function createTestWorkbook(rows: string[][]): Promise<string> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRows(rows);
    const buffer = await wb.xlsx.writeBuffer();
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
    const wb = new ExcelJS.Workbook();
    const ws1 = wb.addWorksheet('Campaign');
    ws1.addRows([['Campaign Info'], ['Nike Q2 2026']]);
    const ws2 = wb.addWorksheet('Placements');
    ws2.addRows([['Placements'], ['ESPN.com', '300x250']]);
    const buffer = await wb.xlsx.writeBuffer();
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

  it('handles quoted CSV fields containing commas', async () => {
    const csvContent = 'Site,Notes\nESPN.com,"takeover, homepage"\n';
    const data = Buffer.from(csvContent).toString('base64');

    const result = await processExcel(data, 'test.csv');

    expect(result).toContain('takeover, homepage');
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
