import JSZip from 'jszip';

/**
 * Zip-bomb guard for uploaded spreadsheets. An .xlsx is a ZIP that ExcelJS
 * inflates into memory via `JSZip.loadAsync` and then iterates `zip.files`.
 * This guard enumerates with the SAME `JSZip.loadAsync` and the SAME `zip.files`,
 * so it inspects exactly the entry set ExcelJS will inflate — no library-vs-
 * library enumeration divergence. It streams each entry's real decompressed
 * output through a hard byte cap, aborting the moment cumulative output would
 * exceed the limit, so peak memory stays bounded to roughly the cap. `loadAsync`
 * itself only parses structure and stores compressed data lazily, so it does not
 * inflate anything up front.
 */

const MAX_DECOMPRESSED_BYTES = 200 * 1024 * 1024; // 200 MB across all entries

function tooLarge(): Error {
  return new Error('Spreadsheet is too large to process (decompressed size exceeds the limit)');
}

/**
 * @param maxBytes cumulative decompressed byte cap across all entries. Defaults
 *   to the production limit; tests inject a small cap so they can prove rejection
 *   without inflating hundreds of megabytes.
 */
export async function assertZipDecompressesWithinLimit(
  buffer: Buffer,
  maxBytes: number = MAX_DECOMPRESSED_BYTES,
): Promise<void> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    // Not a parseable ZIP — let the spreadsheet parser raise its own error.
    return;
  }

  let total = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    await new Promise<void>((resolve, reject) => {
      const stream = entry.nodeStream('nodebuffer');
      stream.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          stream.pause();
          (stream as unknown as { destroy?: () => void }).destroy?.();
          reject(tooLarge());
        }
      });
      stream.on('end', () => resolve());
      stream.on('error', (err: Error) => reject(err));
    });
  }
}
