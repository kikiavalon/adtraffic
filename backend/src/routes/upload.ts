import { Router, type Request, type Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import { requireAuth } from '../auth/middleware.js';
import { logger } from '../lib/logger.js';
// pdf-parse has no proper type declarations; import and cast to typed function
import * as pdfParseModule from 'pdf-parse';
import ExcelJS from 'exceljs';
import { cellText } from '../io/excel-processor.js';
import { assertZipDecompressesWithinLimit } from '../io/zip-guard.js';
import { detectMagic } from '../io/detect-magic.js';

const parsePdf = (pdfParseModule as unknown as { default: (buffer: Buffer) => Promise<{ text: string }> }).default;

const router = Router();

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_EXTRACTED_TEXT_LENGTH = 50_000; // 50k characters

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Excel, and CSV files are accepted'));
    }
  },
});

/**
 * POST /upload
 * Accepts a PDF, Excel, or CSV file, extracts text content, and returns it.
 * Used for IO document parsing — Claude processes the extracted text to identify placements.
 */
router.post('/upload', requireAuth, (req: Request, res: Response) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }

    void handleFileExtraction(req, res);
  });
});

async function handleFileExtraction(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    let extractedText: string;

    if (req.file.mimetype === 'application/pdf') {
      if (detectMagic(req.file.buffer) !== 'pdf') {
        res.status(400).json({ error: 'File content does not match its declared PDF type.' });
        return;
      }
      const pdfData = await parsePdf(req.file.buffer);
      extractedText = pdfData.text;
    } else if (
      req.file.mimetype.includes('spreadsheet') ||
      req.file.mimetype.includes('excel')
    ) {
      if (detectMagic(req.file.buffer) !== 'zip') {
        res.status(400).json({ error: 'File content does not match its declared spreadsheet type.' });
        return;
      }
      const workbook = new ExcelJS.Workbook();
      await assertZipDecompressesWithinLimit(req.file.buffer);
      await workbook.xlsx.load(req.file.buffer as unknown as ExcelJS.Buffer);
      extractedText = workbook.worksheets
        .map((sheet) => sheetToCsv(sheet))
        .join('\n\n---SHEET BREAK---\n\n');
    } else {
      // CSV — read as UTF-8 text
      extractedText = req.file.buffer.toString('utf-8');
    }

    res.json({
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      extractedText: extractedText.substring(0, MAX_EXTRACTED_TEXT_LENGTH),
    });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown' } },
      'File extraction failed',
    );
    res.status(500).json({ error: 'Failed to extract content from file' });
  }
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sheetToCsv(sheet: ExcelJS.Worksheet): string {
  const lines: string[] = [];
  sheet.eachRow((row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    lines.push(values.map((v) => csvEscape(cellText(v))).join(','));
  });
  return lines.join('\n');
}

export default router;
