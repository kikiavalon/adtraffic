import XLSX from 'xlsx';

/**
 * Process an Excel or CSV file (base64-encoded) into structured text
 * suitable for Claude extraction.
 *
 * Returns a text representation with sheet names and tabular data.
 * Each sheet is rendered as a markdown-style table.
 */
export function processExcel(base64Data: string, filename: string): string {
  // Validate base64 encoding before processing
  if (!/^[A-Za-z0-9+/\n\r]*={0,2}$/.test(base64Data)) {
    throw new Error('Invalid base64 data');
  }

  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length === 0) {
    throw new Error('Empty file data');
  }

  // Detect CSV by extension — xlsx library handles both
  const isCsv = filename.toLowerCase().endsWith('.csv');
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    ...(isCsv ? { raw: true } : {}),
  });

  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (rows.length === 0) continue;

    // Build a markdown-style table
    const lines: string[] = [];
    lines.push(`## Sheet: ${sheetName}`);
    lines.push('');

    // Header row
    const headerRow = rows[0];
    if (!headerRow) continue;
    const header = headerRow.map((cell) => String(cell ?? '').trim());
    lines.push(`| ${header.join(' | ')} |`);
    lines.push(`| ${header.map(() => '---').join(' | ')} |`);

    // Data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const cells = row.map((cell) => String(cell ?? '').trim());
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
