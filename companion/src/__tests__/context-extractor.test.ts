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

  it('handles hash with only # character', () => {
    const ctx = extractContextFromHash('#');
    expect(ctx.accountId).toBeUndefined();
    // '#' splits into ['#'] — '#' is non-numeric so becomes pageType
    expect(ctx.pageType).toBe('#');
  });

  it('handles hash with only /', () => {
    const ctx = extractContextFromHash('#/');
    expect(ctx.accountId).toBeUndefined();
    // '#/' splits into ['#'] after filter(Boolean) — '#' is non-numeric
    expect(ctx.pageType).toBe('#');
  });

  it('extracts first match when duplicate segments exist', () => {
    const hash = '#/accounts/11111/profiles/22222/accounts/99999';
    const ctx = extractContextFromHash(hash);
    // regex match returns first occurrence
    expect(ctx.accountId).toBe('11111');
  });

  it('ignores non-numeric account IDs', () => {
    const hash = '#/accounts/abc/profiles/12345';
    const ctx = extractContextFromHash(hash);
    expect(ctx.accountId).toBeUndefined();
    expect(ctx.profileId).toBe('12345');
  });

  it('handles single-digit IDs', () => {
    const hash = '#/accounts/1/profiles/2/advertisers/3/campaigns/4/ads';
    const ctx = extractContextFromHash(hash);
    expect(ctx.accountId).toBe('1');
    expect(ctx.profileId).toBe('2');
    expect(ctx.advertiserId).toBe('3');
    expect(ctx.campaignId).toBe('4');
    expect(ctx.pageType).toBe('ads');
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

  it('returns a plain object (not null/undefined)', () => {
    const ctx = extractContextFromHash('');
    expect(ctx).toBeDefined();
    expect(typeof ctx).toBe('object');
    expect(ctx).not.toBeNull();
  });

  it('handles trailing slash after pageType', () => {
    const hash = '#/accounts/67890/profiles/12345/advertisers/90000/placements/';
    const ctx = extractContextFromHash(hash);
    expect(ctx.pageType).toBe('placements');
  });

  it('handles multiple trailing slashes', () => {
    const hash = '#/accounts/67890/placements///';
    const ctx = extractContextFromHash(hash);
    expect(ctx.accountId).toBe('67890');
    expect(ctx.pageType).toBe('placements');
  });

  it('extracts campaign without advertiser in path', () => {
    const hash = '#/accounts/67890/campaigns/90014/placements';
    const ctx = extractContextFromHash(hash);
    expect(ctx.accountId).toBe('67890');
    expect(ctx.campaignId).toBe('90014');
    expect(ctx.advertiserId).toBeUndefined();
    expect(ctx.pageType).toBe('placements');
  });

  it('handles mixed-case segment names (no match)', () => {
    const hash = '#/Accounts/67890/Profiles/12345';
    const ctx = extractContextFromHash(hash);
    // Regex is case-sensitive: /accounts/ not /Accounts/
    expect(ctx.accountId).toBeUndefined();
    expect(ctx.profileId).toBeUndefined();
  });

  it('does not match accounts embedded in other words', () => {
    const hash = '#/subaccounts/67890/profiles/12345';
    const ctx = extractContextFromHash(hash);
    // Regex /\/accounts\/(\d+)/ requires "/" before "accounts"
    // In "/subaccounts/67890", "accounts" is preceded by "sub" not "/"
    expect(ctx.accountId).toBeUndefined();
    expect(ctx.profileId).toBe('12345');
  });

  it('handles "settings" as pageType', () => {
    const hash = '#/accounts/67890/profiles/12345/settings';
    const ctx = extractContextFromHash(hash);
    expect(ctx.pageType).toBe('settings');
  });

  it('handles "floodlight" as pageType', () => {
    const hash = '#/accounts/67890/profiles/12345/advertisers/90000/floodlight';
    const ctx = extractContextFromHash(hash);
    expect(ctx.pageType).toBe('floodlight');
    expect(ctx.advertiserId).toBe('90000');
  });

  it('handles zero as a valid numeric ID', () => {
    const hash = '#/accounts/0/profiles/0';
    const ctx = extractContextFromHash(hash);
    expect(ctx.accountId).toBe('0');
    expect(ctx.profileId).toBe('0');
  });

  it('does not extract IDs with leading zeros differently', () => {
    const hash = '#/accounts/007/profiles/042';
    const ctx = extractContextFromHash(hash);
    expect(ctx.accountId).toBe('007');
    expect(ctx.profileId).toBe('042');
  });

  it('handles hash with only advertiser and campaign', () => {
    const hash = '#/advertisers/90000/campaigns/90014';
    const ctx = extractContextFromHash(hash);
    expect(ctx.advertiserId).toBe('90000');
    expect(ctx.campaignId).toBe('90014');
    expect(ctx.accountId).toBeUndefined();
    expect(ctx.profileId).toBeUndefined();
    expect(ctx.pageType).toBeUndefined();
  });

  it('handles segments with hyphens as pageType', () => {
    const hash = '#/accounts/67890/ad-server-settings';
    const ctx = extractContextFromHash(hash);
    expect(ctx.pageType).toBe('ad-server-settings');
  });

  it('handles segments with underscores as pageType', () => {
    const hash = '#/accounts/67890/ad_placements';
    const ctx = extractContextFromHash(hash);
    expect(ctx.pageType).toBe('ad_placements');
  });

  it('handles deeply nested path with many levels', () => {
    const hash = '#/accounts/1/profiles/2/advertisers/3/campaigns/4/placements/5/creatives/6/edit';
    const ctx = extractContextFromHash(hash);
    expect(ctx.accountId).toBe('1');
    expect(ctx.profileId).toBe('2');
    expect(ctx.advertiserId).toBe('3');
    expect(ctx.campaignId).toBe('4');
    expect(ctx.pageType).toBe('edit');
  });

  it('returns independent objects for separate calls', () => {
    const ctx1 = extractContextFromHash('#/accounts/111');
    const ctx2 = extractContextFromHash('#/accounts/222');
    expect(ctx1.accountId).toBe('111');
    expect(ctx2.accountId).toBe('222');
    // Modifying one should not affect the other
    ctx1.accountId = 'modified';
    expect(ctx2.accountId).toBe('222');
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

  it('extracts attributes from nested elements', () => {
    document.body.innerHTML = `
      <div class="outer">
        <div class="inner">
          <span data-advertiser-id="90000"></span>
        </div>
      </div>
    `;
    const ctx = extractContextFromDOM();
    expect(ctx.advertiserId).toBe('90000');
  });

  it('extracts attributes from a single element with multiple data attrs', () => {
    document.body.innerHTML =
      '<div data-advertiser-id="90000" data-campaign-id="90014" data-account-id="67890" data-profile-id="12345"></div>';
    const ctx = extractContextFromDOM();
    expect(ctx.advertiserId).toBe('90000');
    expect(ctx.campaignId).toBe('90014');
    expect(ctx.accountId).toBe('67890');
    expect(ctx.profileId).toBe('12345');
  });

  it('does not extract pageType from DOM', () => {
    document.body.innerHTML = '<div data-advertiser-id="90000" data-page-type="placements"></div>';
    const ctx = extractContextFromDOM();
    expect(ctx.advertiserId).toBe('90000');
    // extractContextFromDOM does not look for data-page-type
    expect(ctx.pageType).toBeUndefined();
  });

  it('returns empty context when document.body is empty', () => {
    document.body.innerHTML = '';
    const ctx = extractContextFromDOM();
    expect(ctx.advertiserId).toBeUndefined();
    expect(ctx.campaignId).toBeUndefined();
    expect(ctx.accountId).toBeUndefined();
    expect(ctx.profileId).toBeUndefined();
  });

  it('extracts from input elements', () => {
    document.body.innerHTML = '<input data-advertiser-id="90000" />';
    const ctx = extractContextFromDOM();
    expect(ctx.advertiserId).toBe('90000');
  });

  it('extracts from table elements', () => {
    document.body.innerHTML = '<table data-campaign-id="90014"><tr><td>data</td></tr></table>';
    const ctx = extractContextFromDOM();
    expect(ctx.campaignId).toBe('90014');
  });

  it('extracts from span elements', () => {
    document.body.innerHTML = '<span data-account-id="67890">Account</span>';
    const ctx = extractContextFromDOM();
    expect(ctx.accountId).toBe('67890');
  });

  it('extracts from body element itself', () => {
    document.body.setAttribute('data-advertiser-id', '90000');
    const ctx = extractContextFromDOM();
    expect(ctx.advertiserId).toBe('90000');
    document.body.removeAttribute('data-advertiser-id');
  });

  it('handles whitespace-only attribute values', () => {
    document.body.innerHTML = '<div data-advertiser-id="  "></div>';
    const ctx = extractContextFromDOM();
    expect(ctx.advertiserId).toBe('  ');
  });

  it('handles numeric attribute values', () => {
    document.body.innerHTML = '<div data-campaign-id="12345"></div>';
    const ctx = extractContextFromDOM();
    expect(ctx.campaignId).toBe('12345');
    // Always returns string, not number
    expect(typeof ctx.campaignId).toBe('string');
  });

  it('ignores unrelated data attributes', () => {
    document.body.innerHTML = '<div data-foo="bar" data-campaign-name="test"></div>';
    const ctx = extractContextFromDOM();
    expect(ctx.advertiserId).toBeUndefined();
    expect(ctx.campaignId).toBeUndefined();
    expect(ctx.accountId).toBeUndefined();
    expect(ctx.profileId).toBeUndefined();
  });

  it('returns independent objects for separate calls', () => {
    document.body.innerHTML = '<div data-advertiser-id="90000"></div>';
    const ctx1 = extractContextFromDOM();
    document.body.innerHTML = '<div data-advertiser-id="99999"></div>';
    const ctx2 = extractContextFromDOM();
    expect(ctx1.advertiserId).toBe('90000');
    expect(ctx2.advertiserId).toBe('99999');
  });

  it('handles mixed relevant and irrelevant attributes', () => {
    document.body.innerHTML =
      '<div data-advertiser-id="90000" data-irrelevant="foo" class="widget" id="test"></div>';
    const ctx = extractContextFromDOM();
    expect(ctx.advertiserId).toBe('90000');
    expect(ctx.campaignId).toBeUndefined();
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

  it('DOM fills account/profile gaps when hash only has advertiser', () => {
    const hashContext = extractContextFromHash('#/advertisers/90000/placements');
    const domContext = { accountId: '67890', profileId: '12345' };
    const merged = mergeContexts(hashContext, domContext);

    expect(merged.accountId).toBe('67890');
    expect(merged.profileId).toBe('12345');
    expect(merged.advertiserId).toBe('90000');
    expect(merged.pageType).toBe('placements');
  });

  it('returns object with all five keys even when both inputs are empty', () => {
    const merged = mergeContexts({}, {});
    expect(Object.keys(merged)).toEqual(
      expect.arrayContaining(['accountId', 'profileId', 'advertiserId', 'campaignId', 'pageType']),
    );
    expect(Object.keys(merged).length).toBe(5);
  });

  it('is not commutative when both have different values', () => {
    const a = { accountId: 'A' };
    const b = { accountId: 'B' };
    expect(mergeContexts(a, b).accountId).toBe('A');
    expect(mergeContexts(b, a).accountId).toBe('B');
  });

  it('merging with self returns equivalent object', () => {
    const ctx = { accountId: '111', advertiserId: '222', pageType: 'ads' };
    const merged = mergeContexts(ctx, ctx);
    expect(merged.accountId).toBe('111');
    expect(merged.advertiserId).toBe('222');
    expect(merged.pageType).toBe('ads');
  });

  it('chained merges work correctly', () => {
    const a = { accountId: '111' };
    const b = { profileId: '222' };
    const c = { advertiserId: '333' };
    const merged = mergeContexts(mergeContexts(a, b), c);
    expect(merged.accountId).toBe('111');
    expect(merged.profileId).toBe('222');
    expect(merged.advertiserId).toBe('333');
  });

  it('does not modify original objects', () => {
    const primary = { accountId: '111' };
    const fallback = { accountId: '999', advertiserId: '888' };
    mergeContexts(primary, fallback);
    expect(primary).toEqual({ accountId: '111' });
    expect(fallback).toEqual({ accountId: '999', advertiserId: '888' });
  });

  it('handles fallback with all undefined values', () => {
    const primary = { accountId: '111' };
    const fallback = {
      accountId: undefined,
      profileId: undefined,
      advertiserId: undefined,
      campaignId: undefined,
      pageType: undefined,
    };
    const merged = mergeContexts(primary, fallback);
    expect(merged.accountId).toBe('111');
    expect(merged.profileId).toBeUndefined();
  });

  it('primary empty string does not fall through to fallback', () => {
    // Empty string is not nullish — ?? does NOT trigger
    const primary = { accountId: '' };
    const fallback = { accountId: '999' };
    const merged = mergeContexts(primary, fallback);
    expect(merged.accountId).toBe('');
  });

  it('merges complementary hash and DOM contexts realistically', () => {
    // Hash provides account/profile/pageType, DOM provides advertiser/campaign
    const hash = extractContextFromHash('#/accounts/67890/profiles/12345/placements');
    const dom = { advertiserId: '90000', campaignId: '90014' };
    const merged = mergeContexts(hash, dom);

    expect(merged.accountId).toBe('67890');
    expect(merged.profileId).toBe('12345');
    expect(merged.advertiserId).toBe('90000');
    expect(merged.campaignId).toBe('90014');
    expect(merged.pageType).toBe('placements');
  });
});
