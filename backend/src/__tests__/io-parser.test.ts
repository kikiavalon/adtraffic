import { describe, it, expect, vi } from 'vitest';
import type { FileAttachment } from '@adtraffic/shared';
import { prepareIOContent } from '../io/io-parser.js';

// Mock the processors
vi.mock('../io/pdf-processor.js', () => ({
  processPdf: vi.fn().mockResolvedValue([
    {
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'fakePngBase64' },
    },
  ]),
}));

vi.mock('../io/excel-processor.js', () => ({
  processExcel: vi.fn().mockResolvedValue('| Site | Size |\n| --- | --- |\n| ESPN | 300x250 |'),
}));

describe('IO Parser', () => {
  it('routes PDF files to the PDF processor', async () => {
    const attachment: FileAttachment = {
      name: 'campaign-io.pdf',
      type: 'application/pdf',
      data: 'fakeBase64',
      sizeBytes: 1000,
    };

    const result = await prepareIOContent(attachment);

    expect(result.contentBlocks.length).toBeGreaterThan(0);
    expect(result.contentBlocks[0]!.type).toBe('image');
    expect(result.isPdf).toBe(true);
  });

  it('routes XLSX files to the Excel processor', async () => {
    const attachment: FileAttachment = {
      name: 'campaign-io.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: 'fakeBase64',
      sizeBytes: 1000,
    };

    const result = await prepareIOContent(attachment);

    expect(result.contentBlocks.length).toBe(1);
    expect(result.contentBlocks[0]!.type).toBe('text');
    expect(result.isPdf).toBe(false);
  });

  it('routes XLS files to the Excel processor', async () => {
    const attachment: FileAttachment = {
      name: 'old-io.xls',
      type: 'application/vnd.ms-excel',
      data: 'fakeBase64',
      sizeBytes: 1000,
    };

    const result = await prepareIOContent(attachment);

    expect(result.contentBlocks[0]!.type).toBe('text');
    expect(result.isPdf).toBe(false);
  });

  it('routes CSV files to the Excel processor', async () => {
    const attachment: FileAttachment = {
      name: 'placements.csv',
      type: 'text/csv',
      data: 'fakeBase64',
      sizeBytes: 500,
    };

    const result = await prepareIOContent(attachment);

    expect(result.contentBlocks[0]!.type).toBe('text');
    expect(result.isPdf).toBe(false);
  });

  it('throws for unsupported file types', async () => {
    const attachment = {
      name: 'image.png',
      type: 'image/png',
      data: 'fakeBase64',
      sizeBytes: 500,
    } as unknown as FileAttachment;

    await expect(prepareIOContent(attachment)).rejects.toThrow('Unsupported');
  });
});
