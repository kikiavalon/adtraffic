import { describe, it, expect } from 'vitest';
import { extractContextFromHash } from '../context-extractor.js';

describe('extractContextFromHash', () => {
  it('extracts full context from a CM360-style hash', () => {
    const hash = '#/accounts/67890/profiles/12345/advertisers/90000/campaigns/90014/placements';
    const ctx = extractContextFromHash(hash);

    expect(ctx.accountId).toBe('67890');
    expect(ctx.profileId).toBe('12345');
    expect(ctx.advertiserId).toBe('90000');
    expect(ctx.campaignId).toBe('90014');
    expect(ctx.pageType).toBe('placements');
  });

  it('extracts advertiser-level context (no campaign)', () => {
    const hash = '#/accounts/67890/profiles/12345/advertisers/90001/campaigns';
    const ctx = extractContextFromHash(hash);

    expect(ctx.accountId).toBe('67890');
    expect(ctx.profileId).toBe('12345');
    expect(ctx.advertiserId).toBe('90001');
    expect(ctx.campaignId).toBeUndefined();
    expect(ctx.pageType).toBe('campaigns');
  });

  it('extracts account-level context only', () => {
    const hash = '#/accounts/67890/profiles/12345';
    const ctx = extractContextFromHash(hash);

    expect(ctx.accountId).toBe('67890');
    expect(ctx.profileId).toBe('12345');
    expect(ctx.advertiserId).toBeUndefined();
    expect(ctx.campaignId).toBeUndefined();
  });

  it('handles empty hash', () => {
    const ctx = extractContextFromHash('');
    expect(ctx.accountId).toBeUndefined();
    expect(ctx.profileId).toBeUndefined();
    expect(ctx.advertiserId).toBeUndefined();
    expect(ctx.campaignId).toBeUndefined();
    expect(ctx.pageType).toBeUndefined();
  });

  it('handles hash with only account', () => {
    const hash = '#/accounts/99999';
    const ctx = extractContextFromHash(hash);

    expect(ctx.accountId).toBe('99999');
    expect(ctx.profileId).toBeUndefined();
  });

  it('detects ads page type', () => {
    const hash = '#/accounts/67890/profiles/12345/advertisers/90000/campaigns/90014/ads';
    const ctx = extractContextFromHash(hash);

    expect(ctx.pageType).toBe('ads');
    expect(ctx.campaignId).toBe('90014');
  });

  it('detects creatives page type', () => {
    const hash = '#/accounts/67890/profiles/12345/advertisers/90000/creatives';
    const ctx = extractContextFromHash(hash);

    expect(ctx.pageType).toBe('creatives');
    expect(ctx.advertiserId).toBe('90000');
  });

  it('does not set pageType when last segment is a numeric ID', () => {
    const hash = '#/accounts/67890/profiles/12345/advertisers/90000';
    const ctx = extractContextFromHash(hash);

    expect(ctx.advertiserId).toBe('90000');
    expect(ctx.pageType).toBeUndefined();
  });

  it('handles real CM360 URL patterns with extra segments', () => {
    const hash = '#/accounts/67890/profiles/12345/advertisers/90002/campaigns/90018/placements/80007/details';
    const ctx = extractContextFromHash(hash);

    expect(ctx.accountId).toBe('67890');
    expect(ctx.advertiserId).toBe('90002');
    expect(ctx.campaignId).toBe('90018');
    expect(ctx.pageType).toBe('details');
  });
});
