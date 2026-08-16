import type Anthropic from '@anthropic-ai/sdk';
import type { FileAttachment } from '@adtraffic/shared';
import { processPdf } from './pdf-processor.js';
import { processExcel } from './excel-processor.js';

export interface IOContentResult {
  /** Content blocks to include in Claude API message */
  contentBlocks: Anthropic.ContentBlockParam[];
  /** Whether the source was a PDF (affects model choice) */
  isPdf: boolean;
}

/**
 * Prepare IO document content for Claude extraction.
 *
 * PDF → page images (Claude vision)
 * Excel/CSV → structured text table
 *
 * Returns content blocks ready to be included in a Claude API message.
 */
export async function prepareIOContent(
  attachment: FileAttachment,
): Promise<IOContentResult> {
  switch (attachment.type) {
    case 'application/pdf': {
      const images = await processPdf(attachment.data);
      return { contentBlocks: images, isPdf: true };
    }

    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
    case 'text/csv': {
      const text = await processExcel(attachment.data, attachment.name);
      return {
        contentBlocks: [{ type: 'text', text }],
        isPdf: false,
      };
    }

    default:
      throw new Error(`Unsupported file type: ${String(attachment.type)}`);
  }
}
