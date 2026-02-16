import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractContextFromHash,
  extractContextFromDOM,
  mergeContexts,
} from '../context-extractor.js';

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

  // --- New edge-case tests ---

  it('handles hash without leading #', () => {
    const hash = '/accounts/67890/profiles/12345/advertisers/90000/placements';
    const ctx = extractContextFromHash(hash);

    expect(ctx.accountId).toBe('67890');
    expect(ctx.profileId).toBe('12345');
    expect(ctx.advertiserId).toBe('90000');
    expect(ctx.pageType).toBe('placements');
  });

  it('handles hash with query string after path', () => {
    const hash = '#/accounts/67890/profiles/12345/advertisers/90000/campaigns?sort=name';
    const ctx = extractContextFromHash(hash);

    expect(ctx.accountId).toBe('67890');
    expect(ctx.advertiserId).toBe('90000');
    // "campaigns?sort=name" is the last segment — not purely numeric so it becomes pageType
    expect(ctx.pageType).toBe('campaigns?sort=name');
  });

  it('handles very large numeric IDs', () => {
    const hash = '#/accounts/9999999999/profiles/8888888888/advertisers/7777777777/campaigns/6666666666/placements';
    const ctx = extractContextFromHash(hash);

    expect(ctx.accountId).toBe('9999999999');
    expect(ctx.profileId).toBe('8888888888');
    expect(ctx.advertiserId).toBe('7777777777');
    expect(ctx.campaignId).toBe('6666666666');
    expect(ctx.pageType).toBe('placements');
  });
});

describe('extractContextFromDOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('extracts advertiser ID from data attribute', () => {
    document.body.innerHTML = '<div data-advertiser-id="90000"></div>';
    const ctx = extractContextFromDOM();
    expect(ctx.advertiserId).toBe('90000');
  });

  it('extracts campaign ID from data attribute', () => {
    document.body.innerHTML = '<div data-campaign-id="90014"></div>';
    const ctx = extractContextFromDOM();
    expect(ctx.campaignId).toBe('90014');
  });

  it('extracts account ID from data attribute', () => {
    document.body.innerHTML = '<div data-account-id="67890"></div>';
    const ctx = extractContextFromDOM();
    expect(ctx.accountId).toBe('67890');
  });

  it('extracts profile ID from data attribute', () => {
    document.body.innerHTML = '<div data-profile-id="12345"></div>';
    const ctx = extractContextFromDOM();
    expect(ctx.profileId).toBe('12345');
  });

  it('extracts all four attributes when all present', () => {
    document.body.innerHTML = `
      <div data-account-id="67890"></div>
      <div data-profile-id="12345"></div>
      <div data-advertiser-id="90000"></div>
      <div data-campaign-id="90014"></div>
    `;
    const ctx = extractContextFromDOM();

    expect(ctx.accountId).toBe('67890');
    expect(ctx.profileId).toBe('12345');
    expect(ctx.advertiserId).toBe('90000');
    expect(ctx.campaignId).toBe('90014');
  });

  it('returns empty context when no data attributes exist', () => {
    document.body.innerHTML = '<div>No data attributes here</div>';
    const ctx = extractContextFromDOM();

    expect(ctx.advertiserId).toBeUndefined();
    expect(ctx.campaignId).toBeUndefined();
    expect(ctx.accountId).toBeUndefined();
    expect(ctx.profileId).toBeUndefined();
  });

  it('handles empty string attribute values', () => {
    document.body.innerHTML = '<div data-advertiser-id=""></div>';
    const ctx = extractContextFromDOM();
    // getAttribute returns "" for empty attribute, which is truthy-ish but empty
    expect(ctx.advertiserId).toBe('');
  });

  it('handles multiple elements with same attribute (returns first)', () => {
    document.body.innerHTML = `
      <div data-advertiser-id="first"></div>
      <div data-advertiser-id="second"></div>
    `;
    const ctx = extractContextFromDOM();
    expect(ctx.advertiserId).toBe('first');
  });
});

describe('mergeContexts', () => {
  it('primary values take precedence over fallback', () => {
    const primary = { accountId: '111', advertiserId: '222' };
    const fallback = { accountId: '999', advertiserId: '888' };
    const merged = mergeContexts(primary, fallback);

    expect(merged.accountId).toBe('111');
    expect(merged.advertiserId).toBe('222');
  });

  it('fallback fills missing primary fields', () => {
    const primary = { accountId: '111' };
    const fallback = { advertiserId: '888', campaignId: '777' };
    const merged = mergeContexts(primary, fallback);

    expect(merged.accountId).toBe('111');
    expect(merged.advertiserId).toBe('888');
    expect(merged.campaignId).toBe('777');
  });

  it('both empty returns all undefined', () => {
    const merged = mergeContexts({}, {});

    expect(merged.accountId).toBeUndefined();
    expect(merged.profileId).toBeUndefined();
    expect(merged.advertiserId).toBeUndefined();
    expect(merged.campaignId).toBeUndefined();
    expect(merged.pageType).toBeUndefined();
  });

  it('primary fully set ignores fallback entirely', () => {
    const primary = {
      accountId: '1',
      profileId: '2',
      advertiserId: '3',
      campaignId: '4',
      pageType: 'placements',
    };
    const fallback = {
      accountId: '99',
      profileId: '98',
      advertiserId: '97',
      campaignId: '96',
      pageType: 'ads',
    };
    const merged = mergeContexts(primary, fallback);

    expect(merged.accountId).toBe('1');
    expect(merged.profileId).toBe('2');
    expect(merged.advertiserId).toBe('3');
    expect(merged.campaignId).toBe('4');
    expect(merged.pageType).toBe('placements');
  });

  it('partial overlap — primary wins on shared fields', () => {
    const primary = { accountId: '111', campaignId: '444' };
    const fallback = { accountId: '999', profileId: '222', campaignId: '888' };
    const merged = mergeContexts(primary, fallback);

    expect(merged.accountId).toBe('111');
    expect(merged.profileId).toBe('222');
    expect(merged.campaignId).toBe('444');
  });

  it('fallback provides pageType when primary has none', () => {
    const primary = { accountId: '111' };
    const fallback = { pageType: 'creatives' };
    const merged = mergeContexts(primary, fallback);

    expect(merged.accountId).toBe('111');
    expect(merged.pageType).toBe('creatives');
  });

  it('handles undefined primary values correctly (not just missing keys)', () => {
    const primary = { accountId: undefined, advertiserId: '222' };
    const fallback = { accountId: '999' };
    const merged = mergeContexts(primary, fallback);

    // undefined ?? fallback → fallback wins
    expect(merged.accountId).toBe('999');
    expect(merged.advertiserId).toBe('222');
  });

  it('merges hash context with DOM context in realistic scenario', () => {
    const hashContext = extractContextFromHash(
      '#/accounts/67890/profiles/12345/advertisers/90000/campaigns/90014/placements',
    );
    const domContext = { advertiserId: '90000', campaignId: '90014' };
    const merged = mergeContexts(hashContext, domContext);

    expect(merged.accountId).toBe('67890');
    expect(merged.profileId).toBe('12345');
    expect(merged.advertiserId).toBe('90000');
    expect(merged.campaignId).toBe('90014');
    expect(merged.pageType).toBe('placements');
  });
});
