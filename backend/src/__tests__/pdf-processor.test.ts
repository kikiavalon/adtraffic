import { describe, it, expect, vi } from 'vitest';
import { processPdf } from '../io/pdf-processor.js';

// Mock pdf-to-img since it requires native deps that may not be available in CI
vi.mock('pdf-to-img', () => ({
  pdf: vi.fn(),
}));

describe('PDF Processor', () => {
  it('converts PDF pages to base64 PNG images', async () => {
    const { pdf } = await import('pdf-to-img');
    const mockPdf = vi.mocked(pdf);

    // Mock the async iterable that pdf-to-img returns
    const fakePng1 = Buffer.from('fake-png-page-1');
    const fakePng2 = Buffer.from('fake-png-page-2');

    mockPdf.mockResolvedValue({
      length: 2,
      [Symbol.asyncIterator]: async function* () {
        yield fakePng1;
        yield fakePng2;
      },
    } as unknown as Awaited<ReturnType<typeof pdf>>);

    const result = await processPdf('fake-base64-data');

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('image');
    expect(result[0].source.type).toBe('base64');
    expect(result[0].source.media_type).toBe('image/png');
    expect(typeof result[0].source.data).toBe('string');
    // Verify it's valid base64 of our fake PNG
    expect(Buffer.from(result[0].source.data, 'base64').toString()).toBe('fake-png-page-1');
  });

  it('returns empty array for empty PDF', async () => {
    const { pdf } = await import('pdf-to-img');
    const mockPdf = vi.mocked(pdf);

    mockPdf.mockResolvedValue({
      length: 0,
      [Symbol.asyncIterator]: async function* () {
        // No pages
      },
    } as unknown as Awaited<ReturnType<typeof pdf>>);

    const result = await processPdf('fake-base64-data');
    expect(result).toHaveLength(0);
  });

  it('caps at 20 pages to prevent token explosion', async () => {
    const { pdf } = await import('pdf-to-img');
    const mockPdf = vi.mocked(pdf);

    const pages = Array.from({ length: 25 }, (_, i) => Buffer.from(`page-${i}`));
    mockPdf.mockResolvedValue({
      length: 25,
      [Symbol.asyncIterator]: async function* () {
        for (const page of pages) yield page;
      },
    } as unknown as Awaited<ReturnType<typeof pdf>>);

    const result = await processPdf('fake-base64-data');
    expect(result.length).toBeLessThanOrEqual(20);
  });
});
