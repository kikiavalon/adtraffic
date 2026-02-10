import { describe, it, expect } from 'vitest';
import {
  CreateCampaignSchema,
  CreatePlacementSchema,
  CreateLandingPageSchema,
  ListFilterSchema,
  ChatRequestSchema,
} from '../index.js';

describe('CreateCampaignSchema', () => {
  const validCampaign = {
    advertiserId: '12345',
    name: 'Toyota Q3 2026',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    defaultLandingPageId: '67890',
  };

  it('accepts valid campaign input', () => {
    const result = CreateCampaignSchema.safeParse(validCampaign);
    expect(result.success).toBe(true);
  });

  it('rejects missing advertiser ID', () => {
    const result = CreateCampaignSchema.safeParse({ ...validCampaign, advertiserId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid date format', () => {
    const result = CreateCampaignSchema.safeParse({ ...validCampaign, startDate: '07/01/2026' });
    expect(result.success).toBe(false);
  });

  it('rejects end date before start date', () => {
    const result = CreateCampaignSchema.safeParse({ ...validCampaign, endDate: '2026-06-01' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('End date');
    }
  });

  it('rejects campaign name over 256 characters', () => {
    const result = CreateCampaignSchema.safeParse({ ...validCampaign, name: 'x'.repeat(257) });
    expect(result.success).toBe(false);
  });
});

describe('CreatePlacementSchema', () => {
  const validPlacement = {
    campaignId: '11111',
    siteId: '22222',
    name: 'ESPN_300x250_ROS',
    size: { width: 300, height: 250 },
    startDate: '2026-07-01',
    endDate: '2026-09-30',
  };

  it('accepts valid placement input', () => {
    const result = CreatePlacementSchema.safeParse(validPlacement);
    expect(result.success).toBe(true);
  });

  it('accepts optional compatibility field', () => {
    const result = CreatePlacementSchema.safeParse({
      ...validPlacement,
      compatibility: 'IN_STREAM_VIDEO',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid compatibility value', () => {
    const result = CreatePlacementSchema.safeParse({
      ...validPlacement,
      compatibility: 'INVALID',
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero-width size', () => {
    const result = CreatePlacementSchema.safeParse({
      ...validPlacement,
      size: { width: 0, height: 250 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects size exceeding 32767', () => {
    const result = CreatePlacementSchema.safeParse({
      ...validPlacement,
      size: { width: 40000, height: 250 },
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateLandingPageSchema', () => {
  it('accepts valid landing page', () => {
    const result = CreateLandingPageSchema.safeParse({
      advertiserId: '12345',
      name: 'Toyota Summer Offers',
      url: 'https://toyota.com/offers',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid URL', () => {
    const result = CreateLandingPageSchema.safeParse({
      advertiserId: '12345',
      name: 'Test',
      url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

describe('ListFilterSchema', () => {
  it('applies default maxResults of 100', () => {
    const result = ListFilterSchema.parse({});
    expect(result.maxResults).toBe(100);
  });

  it('rejects maxResults over 1000', () => {
    const result = ListFilterSchema.safeParse({ maxResults: 1001 });
    expect(result.success).toBe(false);
  });
});

describe('ChatRequestSchema', () => {
  it('accepts valid chat request', () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: 'conv-123',
      message: 'Show me all Toyota campaigns',
    });
    expect(result.success).toBe(true);
  });

  it('accepts chat request with attachment', () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: 'conv-123',
      message: 'Parse this IO',
      attachment: {
        name: 'ESPN_IO.pdf',
        type: 'application/pdf',
        data: 'base64encodeddata',
        sizeBytes: 1024,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty message', () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: 'conv-123',
      message: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects message over 10000 characters', () => {
    const result = ChatRequestSchema.safeParse({
      conversationId: 'conv-123',
      message: 'x'.repeat(10001),
    });
    expect(result.success).toBe(false);
  });
});
