import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { assertZipDecompressesWithinLimit } from './zip-guard.js';

/**
 * Process an Excel or CSV file (base64-encoded) into structured text
 * suitable for Claude extraction.
 *
 * Returns a text representation with sheet names and tabular data.
 * Each sheet is rendered as a markdown-style table.
 */
export async function processExcel(base64Data: string, filename: string): Promise<string> {
  // Validate base64 encoding before processing
  if (!/^[A-Za-z0-9+/\n\r]*={0,2}$/.test(base64Data)) {
    throw new Error('Invalid base64 data');
  }

  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length === 0) {
    throw new Error('Empty file data');
  }

  const workbook = new ExcelJS.Workbook();
  const isCsv = filename.toLowerCase().endsWith('.csv');
  if (isCsv) {
    await workbook.csv.read(Readable.from(buffer));
  } else {
    await assertZipDecompressesWithinLimit(buffer);
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  }

  const sections: string[] = [];

  for (const sheet of workbook.worksheets) {
    const rows: string[][] = [];
    sheet.eachRow((row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map(cellText));
    });

    if (rows.length === 0) continue;

    // Build a markdown-style table
    const lines: string[] = [];
    lines.push(`## Sheet: ${sheet.name}`);
    lines.push('');

    // Header row
    const headerRow = rows[0];
    if (!headerRow) continue;
    const header = headerRow.map((cell) => cell.trim());
    lines.push(`| ${header.join(' | ')} |`);
    lines.push(`| ${header.map(() => '---').join(' | ')} |`);

    // Data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const cells = row.map((cell) => cell.trim());
      // Pad to header length
      while (cells.length < header.length) cells.push('');
      lines.push(`| ${cells.join(' | ')} |`);
    }

    sections.push(lines.join('\n'));
  }

  if (sections.length === 0) {
    return `File: ${filename}\n(Empty workbook — no data found)`;
  }

  return `File: ${filename}\n\n${sections.join('\n\n')}`;
}

/** Render an ExcelJS cell value as plain text. */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('');
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('error' in value) return String(value.error);
    return '';
  }
  return String(value);
}
