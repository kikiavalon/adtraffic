import { describe, it, expect, vi } from 'vitest';
import { processPdf, assertPagesWithinPixelBudget } from '../io/pdf-processor.js';

// Mock pdf-to-img (rendering) but NOT pdfjs — the pixel-budget pre-check runs
// real pdfjs against the actual PDF bytes.
vi.mock('pdf-to-img', () => ({
  pdf: vi.fn(),
}));

/** Minimal single-page PDF with the given MediaBox. pdfjs reconstructs the
 * cross-reference table, so this is enough to read page dimensions. */
function makePdf(mediaBox: string): Buffer {
  return Buffer.from(
    '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[${mediaBox}]>>endobj\n` +
      'trailer<</Root 1 0 R>>\n%%EOF',
  );
}

const NORMAL_PDF_B64 = makePdf('0 0 612 792').toString('base64');

describe('assertPagesWithinPixelBudget', () => {
  it('accepts a normal-size page', async () => {
    await expect(assertPagesWithinPixelBudget(makePdf('0 0 612 792'))).resolves.toBeUndefined();
  });

  it('rejects a huge-MediaBox page before it is rendered (raster bomb)', async () => {
    // 14400x14400 at scale 2.0 is ~830 megapixels.
    await expect(assertPagesWithinPixelBudget(makePdf('0 0 14400 14400'))).rejects.toThrow(/too large/i);
  });
});

describe('PDF Processor', () => {
  it('rejects a non-PDF file declared as a PDF (content/type mismatch)', async () => {
    const notPdf = Buffer.from('this is plainly not a pdf').toString('base64');
    await expect(processPdf(notPdf)).rejects.toThrow(/does not match its declared PDF type/i);
  });

  it('converts PDF pages to base64 PNG images', async () => {
    const { pdf } = await import('pdf-to-img');
    const mockPdf = vi.mocked(pdf);

    const fakePng1 = Buffer.from('fake-png-page-1');
    const fakePng2 = Buffer.from('fake-png-page-2');

    mockPdf.mockResolvedValue({
      length: 2,
      getPage: async (n: number) => (n === 1 ? fakePng1 : fakePng2),
    } as unknown as Awaited<ReturnType<typeof pdf>>);

    const result = await processPdf(NORMAL_PDF_B64);

    expect(result).toHaveLength(2);
    const first = result[0]!;
    expect(first.type).toBe('image');
    const source = first.source as { type: string; media_type: string; data: string };
    expect(source.type).toBe('base64');
    expect(source.media_type).toBe('image/png');
    expect(Buffer.from(source.data, 'base64').toString()).toBe('fake-png-page-1');
  });

  it('returns empty array for empty PDF', async () => {
    const { pdf } = await import('pdf-to-img');
    const mockPdf = vi.mocked(pdf);

    mockPdf.mockResolvedValue({
      length: 0,
      getPage: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof pdf>>);

    const result = await processPdf(NORMAL_PDF_B64);
    expect(result).toHaveLength(0);
  });

  it('caps at 20 pages to prevent token explosion', async () => {
    const { pdf } = await import('pdf-to-img');
    const mockPdf = vi.mocked(pdf);

    const getPage = vi.fn(async (n: number) => Buffer.from(`page-${n}`));
    mockPdf.mockResolvedValue({
      length: 25,
      getPage,
    } as unknown as Awaited<ReturnType<typeof pdf>>);

    const result = await processPdf(NORMAL_PDF_B64);
    expect(result).toHaveLength(20);
    // The renderer must never be asked for page 21 (off-by-one raster-bomb guard).
    expect(getPage).toHaveBeenCalledTimes(20);
    expect(getPage).not.toHaveBeenCalledWith(21);
  });
});
