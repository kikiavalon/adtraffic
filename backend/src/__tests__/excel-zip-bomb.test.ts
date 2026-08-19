import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { assertZipDecompressesWithinLimit } from '../io/zip-guard.js';
import { processExcel } from '../io/excel-processor.js';

// A small bomb (compresses to a few KB) plus an injected small cap proves the
// streaming guard aborts once decompressed output exceeds the limit — without
// inflating hundreds of megabytes, which timed out on slower CI runners.
const BOMB = Buffer.alloc(6 * 1024 * 1024); // 6 MB of zeros -> a few KB compressed
const TEST_MAX_BYTES = 2 * 1024 * 1024; // 2 MB cap for the rejection tests

/** Local file record + central directory header for one DEFLATE entry. */
function bombRecords(name: string, content: Buffer, localOffset: number): { local: Buffer; cdh: Buffer } {
  const data = deflateRawSync(content);
  const nameBuf = Buffer.from(name);
  const lfh = Buffer.alloc(30 + nameBuf.length);
  lfh.writeUInt32LE(0x04034b50, 0);
  lfh.writeUInt16LE(20, 4);
  lfh.writeUInt16LE(8, 8);
  lfh.writeUInt32LE(data.length, 18);
  lfh.writeUInt32LE(content.length >>> 0, 22);
  lfh.writeUInt16LE(nameBuf.length, 26);
  nameBuf.copy(lfh, 30);
  const cdh = Buffer.alloc(46 + nameBuf.length);
  cdh.writeUInt32LE(0x02014b50, 0);
  cdh.writeUInt16LE(20, 6);
  cdh.writeUInt16LE(8, 10);
  cdh.writeUInt32LE(data.length, 20);
  cdh.writeUInt32LE(content.length >>> 0, 24);
  cdh.writeUInt16LE(nameBuf.length, 28);
  cdh.writeUInt32LE(localOffset, 42);
  nameBuf.copy(cdh, 46);
  return { local: Buffer.concat([lfh, data]), cdh };
}

/** Append a bomb entry to a real ZIP WITHOUT incrementing the EOCD entry count —
 * the exact structure that fools a reader which trusts that count. JSZip reads
 * central-directory records by signature and sees the bomb anyway. */
async function makeCountBypassZip(): Promise<Buffer> {
  const base = await new JSZip().file('good.txt', 'ok').generateAsync({ type: 'nodebuffer' });
  const eocd = base.length - 22;
  const count = base.readUInt16LE(eocd + 10);
  const cdOffset = base.readUInt32LE(eocd + 16);
  const cdSize = base.readUInt32LE(eocd + 12);

  const baseLocals = base.subarray(0, cdOffset);
  const baseCentral = base.subarray(cdOffset, cdOffset + cdSize);
  const { local, cdh } = bombRecords('xl/BOMB.xml', BOMB, baseLocals.length);

  const newLocals = Buffer.concat([baseLocals, local]);
  const newCentral = Buffer.concat([baseCentral, cdh]);
  const newEocd = Buffer.from(base.subarray(eocd)); // 22-byte EOCD
  newEocd.writeUInt16LE(count, 8); // entries this disk — UNCHANGED (the bypass)
  newEocd.writeUInt16LE(count, 10); // total entries — UNCHANGED
  newEocd.writeUInt32LE(newCentral.length, 12);
  newEocd.writeUInt32LE(newLocals.length, 16);
  return Buffer.concat([newLocals, newCentral, newEocd]);
}

describe('assertZipDecompressesWithinLimit', () => {
  it('rejects a real DEFLATE bomb', async () => {
    const zip = new JSZip();
    zip.file('xl/worksheets/sheet1.xml', BOMB);
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await expect(assertZipDecompressesWithinLimit(buffer, TEST_MAX_BYTES)).rejects.toThrow(/too large/i);
  });

  it('rejects a bomb appended past the EOCD entry count (enumeration parity with JSZip)', async () => {
    const evil = await makeCountBypassZip();
    // The library ExcelJS uses DOES enumerate the appended bomb...
    const parsed = await JSZip.loadAsync(evil);
    expect(Object.keys(parsed.files)).toContain('xl/BOMB.xml');
    // ...so the guard, using the same enumeration, must reject it.
    await expect(assertZipDecompressesWithinLimit(evil, TEST_MAX_BYTES)).rejects.toThrow(/too large/i);
  });

  it('does not throw on a non-ZIP buffer (leaves rejection to the parser)', async () => {
    await expect(assertZipDecompressesWithinLimit(Buffer.from('not a zip file'))).resolves.toBeUndefined();
  });

  it('accepts and parses a real generated workbook', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['name', 'value']);
    ws.addRow(['alpha', 1]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    await expect(assertZipDecompressesWithinLimit(buffer)).resolves.toBeUndefined();
    const text = await processExcel(buffer.toString('base64'), 'data.xlsx');
    expect(text).toContain('alpha');
  });
});
