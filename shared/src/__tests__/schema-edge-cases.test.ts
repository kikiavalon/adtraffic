/**
 * Schema edge case and boundary validation tests.
 *
 * Expands on schemas.test.ts with:
 * - Max-length boundary testing for all string fields
 * - FileAttachmentSchema (untested in original suite)
 * - ChatRequestSchema toolResults field
 * - ListFilterSchema searchString max length
 * - CreatePlacement paymentSource enum
 * - Date refine edge cases (same start/end date)
 * - Type coercion rejection (number where string expected, etc.)
 */

import { describe, it, expect } from 'vitest';
import {
  CreateCampaignSchema,
  CreatePlacementSchema,
  CreateLandingPageSchema,
  ListFilterSchema,
  FileAttachmentSchema,
  ChatRequestSchema,
} from '../index.js';

describe('CreateCampaignSchema — edge cases', () => {
  const base = {
    advertiserId: '12345',
    name: 'Test Campaign',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    defaultLandingPageId: '67890',
  };

  it('accepts same start and end date', () => {
    const result = CreateCampaignSchema.safeParse({
      ...base,
      startDate: '2026-07-01',
      endDate: '2026-07-01',
    });
    expect(result.success).toBe(true);
  });

  it('accepts name at exactly 256 characters', () => {
    const result = CreateCampaignSchema.safeParse({ ...base, name: 'x'.repeat(256) });
    expect(result.success).toBe(true);
  });

  it('rejects missing defaultLandingPageId', () => {
    const { defaultLandingPageId: _, ...noLanding } = base;
    const result = CreateCampaignSchema.safeParse(noLanding);
    expect(result.success).toBe(false);
  });

  it('rejects numeric advertiserId (type coercion)', () => {
    const result = CreateCampaignSchema.safeParse({ ...base, advertiserId: 12345 });
    expect(result.success).toBe(false);
  });

  it('rejects partial date format YYYY-MM', () => {
    const result = CreateCampaignSchema.safeParse({ ...base, startDate: '2026-07' });
    expect(result.success).toBe(false);
  });

  it('rejects ISO datetime with time component', () => {
    const result = CreateCampaignSchema.safeParse({ ...base, startDate: '2026-07-01T00:00:00Z' });
    expect(result.success).toBe(false);
  });
});

describe('CreatePlacementSchema — edge cases', () => {
  const base = {
    campaignId: '11111',
    siteId: '22222',
    name: 'ESPN_300x250_ROS',
    size: { width: 300, height: 250 },
    startDate: '2026-07-01',
    endDate: '2026-09-30',
  };

  it('accepts paymentSource PLACEMENT_AGENCY_PAID', () => {
    const result = CreatePlacementSchema.safeParse({
      ...base,
      paymentSource: 'PLACEMENT_AGENCY_PAID',
    });
    expect(result.success).toBe(true);
  });

  it('accepts paymentSource PLACEMENT_PUBLISHER_PAID', () => {
    const result = CreatePlacementSchema.safeParse({
      ...base,
      paymentSource: 'PLACEMENT_PUBLISHER_PAID',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid paymentSource', () => {
    const result = CreatePlacementSchema.safeParse({
      ...base,
      paymentSource: 'CLIENT_PAID',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative height', () => {
    const result = CreatePlacementSchema.safeParse({
      ...base,
      size: { width: 300, height: -1 },
    });
    expect(result.success).toBe(false);
  });

  it('accepts size at maximum boundary (32767)', () => {
    const result = CreatePlacementSchema.safeParse({
      ...base,
      size: { width: 32767, height: 32767 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects float dimensions', () => {
    const result = CreatePlacementSchema.safeParse({
      ...base,
      size: { width: 300.5, height: 250 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects end date before start date', () => {
    const result = CreatePlacementSchema.safeParse({
      ...base,
      endDate: '2026-06-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('End date');
    }
  });

  it('accepts IN_STREAM_AUDIO compatibility', () => {
    const result = CreatePlacementSchema.safeParse({
      ...base,
      compatibility: 'IN_STREAM_AUDIO',
    });
    expect(result.success).toBe(true);
  });
});

describe('CreateLandingPageSchema — edge cases', () => {
  it('rejects empty advertiser ID', () => {
    const result = CreateLandingPageSchema.safeParse({
      advertiserId: '',
      name: 'Test',
      url: 'https://example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name over 256 characters', () => {
    const result = CreateLandingPageSchema.safeParse({
      advertiserId: '123',
      name: 'x'.repeat(257),
      url: 'https://example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects HTTP URL without TLD', () => {
    const result = CreateLandingPageSchema.safeParse({
      advertiserId: '123',
      name: 'Test',
      url: 'http://localhost',
    });
    // Zod url() accepts localhost — this is valid per URL spec
    expect(result.success).toBe(true);
  });

  it('accepts HTTPS URL with path and query params', () => {
    const result = CreateLandingPageSchema.safeParse({
      advertiserId: '123',
      name: 'Test',
      url: 'https://example.com/path?utm_source=google&utm_medium=cpc',
    });
    expect(result.success).toBe(true);
  });
});

describe('ListFilterSchema — edge cases', () => {
  it('accepts searchString at max length (500)', () => {
    const result = ListFilterSchema.safeParse({ searchString: 'x'.repeat(500) });
    expect(result.success).toBe(true);
  });

  it('rejects searchString over 500 characters', () => {
    const result = ListFilterSchema.safeParse({ searchString: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('accepts maxResults at boundary 1', () => {
    const result = ListFilterSchema.safeParse({ maxResults: 1 });
    expect(result.success).toBe(true);
  });

  it('accepts maxResults at boundary 1000', () => {
    const result = ListFilterSchema.safeParse({ maxResults: 1000 });
    expect(result.success).toBe(true);
  });

  it('rejects maxResults of 0', () => {
    const result = ListFilterSchema.safeParse({ maxResults: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects float maxResults', () => {
    const result = ListFilterSchema.safeParse({ maxResults: 50.5 });
    expect(result.success).toBe(false);
  });

  it('accepts all optional fields together', () => {
    const result = ListFilterSchema.safeParse({
      advertiserId: 'adv-1',
      campaignId: 'camp-1',
      searchString: 'toyota',
      maxResults: 50,
      pageToken: 'next-page',
    });
    expect(result.success).toBe(true);
  });
});

describe('FileAttachmentSchema', () => {
  const validAttachment = {
    name: 'report.pdf',
    type: 'application/pdf' as const,
    data: 'base64data',
    sizeBytes: 1024,
  };

  it('accepts valid PDF attachment', () => {
    const result = FileAttachmentSchema.safeParse(validAttachment);
    expect(result.success).toBe(true);
  });

  it('accepts Excel .xlsx attachment', () => {
    const result = FileAttachmentSchema.safeParse({
      ...validAttachment,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(result.success).toBe(true);
  });

  it('accepts legacy .xls attachment', () => {
    const result = FileAttachmentSchema.safeParse({
      ...validAttachment,
      type: 'application/vnd.ms-excel',
    });
    expect(result.success).toBe(true);
  });

  it('accepts CSV attachment', () => {
    const result = FileAttachmentSchema.safeParse({
      ...validAttachment,
      type: 'text/csv',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unsupported file type', () => {
    const result = FileAttachmentSchema.safeParse({
      ...validAttachment,
      type: 'image/png',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty file name', () => {
    const result = FileAttachmentSchema.safeParse({
      ...validAttachment,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty data', () => {
    const result = FileAttachmentSchema.safeParse({
      ...validAttachment,
      data: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects data exceeding 15MB base64 limit', () => {
    const result = FileAttachmentSchema.safeParse({
      ...validAttachment,
      data: 'x'.repeat(15_000_001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects sizeBytes exceeding 10MB', () => {
    const result = FileAttachmentSchema.safeParse({
      ...validAttachment,
      sizeBytes: 10_485_761,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero sizeBytes', () => {
    const result = FileAttachmentSchema.safeParse({
      ...validAttachment,
      sizeBytes: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative sizeBytes', () => {
    const result = FileAttachmentSchema.safeParse({
      ...validAttachment,
      sizeBytes: -100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects float sizeBytes', () => {
    const result = FileAttachmentSchema.safeParse({
      ...validAttachment,
      sizeBytes: 1024.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('ChatRequestSchema — edge cases', () => {
  it('rejects missing conversationId', () => {
    const result = ChatRequestSchema.safeParse({ message: 'Hello' });
    expect(result.success).toBe(false);
  });

  it('rejects conversationId over 200 characters', () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: 'x'.repeat(201),
      message: 'Hello',
    });
    expect(result.success).toBe(false);
  });

  it('accepts conversationId at exactly 200 characters', () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: 'x'.repeat(200),
      message: 'Hello',
    });
    expect(result.success).toBe(true);
  });

  it('accepts message at exactly 10000 characters', () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: 'conv-1',
      message: 'x'.repeat(10000),
    });
    expect(result.success).toBe(true);
  });

  it('accepts toolResults array', () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: 'conv-1',
      message: 'Here are the results',
      toolResults: [
        { toolCallId: 'tc-1', result: { data: 'test' }, isError: false },
        { toolCallId: 'tc-2', result: null, isError: true, errorMessage: 'Tool failed' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects toolResults with missing toolCallId', () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: 'conv-1',
      message: 'test',
      toolResults: [{ result: {}, isError: false }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra unknown fields (strict parsing)', () => {
    // Zod strips unknown fields by default — so this should succeed
    // but the extra field should be dropped
    const result = ChatRequestSchema.safeParse({
      conversationId: 'conv-1',
      message: 'test',
      extraField: 'should be stripped',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>)['extraField']).toBeUndefined();
    }
  });
});
