import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import ExcelJS from 'exceljs';

// Mock requireAuth middleware
vi.mock('../auth/middleware.js', () => ({
  requireAuth: vi.fn((req: { user?: { userId: string; email: string }; headers: { authorization?: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    req.user = { userId: authHeader.slice(7), email: 'test@test.com' };
    next();
  }),
}));

// Mock pdf-parse since it needs real PDF binaries
vi.mock('pdf-parse', () => ({
  default: vi.fn().mockResolvedValue({ text: 'Extracted PDF text content' }),
}));

// Mock logger to avoid test noise
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

import uploadRouter from '../routes/upload.js';

function createApp() {
  const app = express();
  app.use('/api/v1', uploadRouter);
  return app;
}

describe('POST /api/v1/upload', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  it('returns 401 when no auth token provided', async () => {
    const res = await request(app)
      .post('/api/v1/upload')
      .expect(401);

    expect(res.body.error).toBe('Authentication required');
  });

  it('returns 400 when no file uploaded', async () => {
    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', 'Bearer test-user')
      .expect(400);

    expect(res.body.error).toBe('No file uploaded');
  });

  it('extracts text from CSV file', async () => {
    const csvContent = 'Name,Size,Site\nPlacement1,300x250,example.com\nPlacement2,728x90,test.com';
    const buffer = Buffer.from(csvContent, 'utf-8');

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', 'Bearer test-user')
      .attach('file', buffer, { filename: 'placements.csv', contentType: 'text/csv' })
      .expect(200);

    expect(res.body.filename).toBe('placements.csv');
    expect(res.body.mimeType).toBe('text/csv');
    expect(res.body.sizeBytes).toBe(buffer.length);
    expect(res.body.extractedText).toContain('Placement1');
    expect(res.body.extractedText).toContain('300x250');
    expect(res.body.extractedText).toContain('example.com');
  });

  it('extracts text from Excel file', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Placements');
    ws.addRows([
      ['Campaign', 'Placement', 'Size'],
      ['Summer 2026', 'Homepage Banner', '300x250'],
      ['Summer 2026', 'Sidebar', '160x600'],
    ]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', 'Bearer test-user')
      .attach('file', buffer, {
        filename: 'io.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(200);

    expect(res.body.filename).toBe('io.xlsx');
    expect(res.body.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.body.extractedText).toContain('Summer 2026');
    expect(res.body.extractedText).toContain('Homepage Banner');
    expect(res.body.extractedText).toContain('300x250');
  });

  it('extracts text from Excel file with multiple sheets', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Sheet1').addRows([['Sheet1Data']]);
    wb.addWorksheet('Sheet2').addRows([['Sheet2Data']]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', 'Bearer test-user')
      .attach('file', buffer, {
        filename: 'multi-sheet.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(200);

    expect(res.body.extractedText).toContain('Sheet1Data');
    expect(res.body.extractedText).toContain('Sheet2Data');
    expect(res.body.extractedText).toContain('---SHEET BREAK---');
  });

  it('extracts text from PDF file', async () => {
    // pdf-parse is mocked to return 'Extracted PDF text content'
    const fakePdf = Buffer.from('%PDF-1.4 fake pdf content');

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', 'Bearer test-user')
      .attach('file', fakePdf, { filename: 'io.pdf', contentType: 'application/pdf' })
      .expect(200);

    expect(res.body.filename).toBe('io.pdf');
    expect(res.body.mimeType).toBe('application/pdf');
    expect(res.body.extractedText).toBe('Extracted PDF text content');
  });

  it('rejects unsupported file types', async () => {
    const buffer = Buffer.from('plain text content');

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', 'Bearer test-user')
      .attach('file', buffer, { filename: 'notes.txt', contentType: 'text/plain' })
      .expect(400);

    expect(res.body.error).toContain('Only PDF, Excel, and CSV files are accepted');
  });

  it('caps extracted text at 50k characters', async () => {
    // Create a CSV with more than 50k characters
    const rows = ['col1,col2,col3'];
    for (let i = 0; i < 2000; i++) {
      rows.push(`${'A'.repeat(30)},${'B'.repeat(30)},${'C'.repeat(30)}`);
    }
    const csvContent = rows.join('\n');
    expect(csvContent.length).toBeGreaterThan(50000);

    const buffer = Buffer.from(csvContent, 'utf-8');

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', 'Bearer test-user')
      .attach('file', buffer, { filename: 'large.csv', contentType: 'text/csv' })
      .expect(200);

    expect(res.body.extractedText.length).toBeLessThanOrEqual(50000);
  });

  it('rejects files over 10MB', async () => {
    // Create a buffer slightly over 10MB
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, 'A');

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', 'Bearer test-user')
      .attach('file', largeBuffer, { filename: 'huge.csv', contentType: 'text/csv' })
      .expect(400);

    expect(res.body.error).toContain('File too large');
  });

  it('handles PDF extraction failure gracefully', async () => {
    const pdfParse = await import('pdf-parse') as unknown as { default: ReturnType<typeof vi.fn> };
    pdfParse.default.mockRejectedValueOnce(new Error('Corrupt PDF'));

    const fakePdf = Buffer.from('%PDF-1.4 corrupt content');

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', 'Bearer test-user')
      .attach('file', fakePdf, { filename: 'corrupt.pdf', contentType: 'application/pdf' })
      .expect(500);

    expect(res.body.error).toBe('Failed to extract content from file');
  });
});
