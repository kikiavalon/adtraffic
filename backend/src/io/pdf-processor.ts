import type Anthropic from '@anthropic-ai/sdk';

const MAX_PDF_PAGES = 20;

/**
 * Convert a PDF (base64-encoded) into an array of Anthropic image content blocks.
 * Each page becomes a base64 PNG image for Claude vision processing.
 */
export async function processPdf(
  base64Data: string,
): Promise<Anthropic.ImageBlockParam[]> {
  const { pdf } = await import('pdf-to-img');

  const buffer = Buffer.from(base64Data, 'base64');
  const document = await pdf(buffer, { scale: 2.0 });

  const images: Anthropic.ImageBlockParam[] = [];
  let pageCount = 0;

  for await (const pageImage of document) {
    if (pageCount >= MAX_PDF_PAGES) break;

    images.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: Buffer.from(pageImage).toString('base64'),
      },
    });

    pageCount++;
  }

  return images;
}
