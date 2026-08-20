import type Anthropic from '@anthropic-ai/sdk';
import { detectMagic } from './detect-magic.js';

const MAX_PDF_PAGES = 20;
const RENDER_SCALE = 2.0;
// Cap the per-page rasterized bitmap. A 14400x14400 PDF MediaBox at scale 2.0
// would be ~830 megapixels (~3.3 GB of RGBA), so the page-count limit alone
// does not stop a single huge-MediaBox page from OOMing the process.
const MAX_RENDER_PIXELS = 64_000_000;

// Minimal surface of pdfjs-dist we depend on, typed locally so we do not couple
// to the transitive package's exported types.
interface PdfjsPage {
  getViewport(options: { scale: number }): { width: number; height: number };
}
interface PdfjsDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfjsPage>;
  destroy(): Promise<void>;
}
interface PdfjsModule {
  getDocument(src: { data: Uint8Array; isEvalSupported?: boolean }): {
    promise: Promise<PdfjsDocument>;
  };
}

/** Reject a PDF whose pages would rasterize to an oversized bitmap, BEFORE
 * pdf-to-img renders them. Reads page dimensions with pdfjs (no rendering). */
export async function assertPagesWithinPixelBudget(buffer: Buffer): Promise<void> {
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfjsModule;
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
  }).promise;
  try {
    const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      if (viewport.width * viewport.height > MAX_RENDER_PIXELS) {
        throw new Error('PDF page is too large to render safely');
      }
    }
  } finally {
    await doc.destroy();
  }
}

/**
 * Convert a PDF (base64-encoded) into an array of Anthropic image content blocks.
 * Each page becomes a base64 PNG image for Claude vision processing.
 */
export async function processPdf(
  base64Data: string,
): Promise<Anthropic.ImageBlockParam[]> {
  const buffer = Buffer.from(base64Data, 'base64');
  if (detectMagic(buffer) !== 'pdf') {
    throw new Error('File content does not match its declared PDF type.');
  }
  await assertPagesWithinPixelBudget(buffer);

  const { pdf } = await import('pdf-to-img');
  const document = await pdf(buffer, { scale: RENDER_SCALE });

  const images: Anthropic.ImageBlockParam[] = [];
  // Render exactly the pages the pre-check inspected. A `for await` loop would
  // pull (and render) the 21st page before the cap check runs, so a bomb on
  // page 21 would rasterize before we could stop it — request pages by index.
  const pageCount = Math.min(document.length, MAX_PDF_PAGES);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const pageImage = await document.getPage(pageNumber);
    images.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: Buffer.from(pageImage).toString('base64'),
      },
    });
  }

  return images;
}
