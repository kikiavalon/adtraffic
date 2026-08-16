import { describe, it, expect } from 'vitest';
import { resolveClickThroughUrl } from '../qa/resolve-click-through.js';

const lp = (id: string, url: string) => ({ id, url });

describe('resolveClickThroughUrl', () => {
  it('uses customClickThroughUrl over everything', () => {
    const r = resolveClickThroughUrl({
      assignment: { customClickThroughUrl: 'https://x.com/promo' },
      landingPages: [lp('1', 'https://lp.com')],
      campaignDefaultLandingPageId: '1',
    });
    expect(r.url).toBe('https://x.com/promo');
    expect(r.source).toBe('custom');
  });

  it('uses assignment landing page over campaign default', () => {
    const r = resolveClickThroughUrl({
      assignment: { landingPageId: '2' },
      landingPages: [lp('1', 'https://default.com'), lp('2', 'https://assigned.com')],
      campaignDefaultLandingPageId: '1',
    });
    expect(r.url).toBe('https://assigned.com');
    expect(r.source).toBe('landing_page');
  });

  it('falls back to campaign default landing page', () => {
    const r = resolveClickThroughUrl({
      assignment: {},
      landingPages: [lp('1', 'https://default.com')],
      campaignDefaultLandingPageId: '1',
    });
    expect(r.url).toBe('https://default.com');
    expect(r.source).toBe('campaign_default');
  });

  it('returns unresolved when landing page id is unknown', () => {
    const r = resolveClickThroughUrl({
      assignment: { landingPageId: '99' },
      landingPages: [],
      campaignDefaultLandingPageId: '1',
    });
    expect(r.url).toBeUndefined();
    expect(r.source).toBe('unresolved');
  });

  it('appends effective suffix with ? on a bare URL', () => {
    const r = resolveClickThroughUrl({
      assignment: {},
      landingPages: [lp('1', 'https://d.com/page')],
      campaignDefaultLandingPageId: '1',
      advertiserSuffix: 'utm_source=cm360',
    });
    expect(r.url).toBe('https://d.com/page?utm_source=cm360');
    expect(r.effectiveSuffix).toBe('utm_source=cm360');
    expect(r.suffixLevel).toBe('advertiser');
  });

  it('appends with & when URL already has a query string', () => {
    const r = resolveClickThroughUrl({
      assignment: {},
      landingPages: [lp('1', 'https://d.com/?a=1')],
      campaignDefaultLandingPageId: '1',
      advertiserSuffix: 'b=2',
    });
    expect(r.url).toBe('https://d.com/?a=1&b=2');
  });

  it('campaign suffix with overrideInheritedSuffix replaces advertiser suffix', () => {
    const r = resolveClickThroughUrl({
      assignment: {},
      landingPages: [lp('1', 'https://d.com')],
      campaignDefaultLandingPageId: '1',
      advertiserSuffix: 'a=adv',
      campaignSuffixProperties: { clickThroughUrlSuffix: 'a=camp', overrideInheritedSuffix: true },
    });
    expect(r.effectiveSuffix).toBe('a=camp');
    expect(r.suffixLevel).toBe('campaign');
  });

  it('campaign suffix without override inherits advertiser suffix', () => {
    const r = resolveClickThroughUrl({
      assignment: {},
      landingPages: [lp('1', 'https://d.com')],
      campaignDefaultLandingPageId: '1',
      advertiserSuffix: 'a=adv',
      campaignSuffixProperties: { clickThroughUrlSuffix: 'a=camp', overrideInheritedSuffix: false },
    });
    expect(r.effectiveSuffix).toBe('a=adv');
    expect(r.suffixLevel).toBe('advertiser');
  });

  it('ad suffix with override beats campaign and advertiser', () => {
    const r = resolveClickThroughUrl({
      assignment: {},
      landingPages: [lp('1', 'https://d.com')],
      campaignDefaultLandingPageId: '1',
      advertiserSuffix: 'a=adv',
      campaignSuffixProperties: { clickThroughUrlSuffix: 'a=camp', overrideInheritedSuffix: true },
      adSuffixProperties: { clickThroughUrlSuffix: 'a=ad', overrideInheritedSuffix: true },
    });
    expect(r.effectiveSuffix).toBe('a=ad');
    expect(r.suffixLevel).toBe('ad');
  });

  it('ad blank override CLEARS the inherited suffix (does not fall through)', () => {
    const r = resolveClickThroughUrl({
      assignment: {},
      landingPages: [lp('1', 'https://d.com')],
      campaignDefaultLandingPageId: '1',
      advertiserSuffix: 'a=adv',
      adSuffixProperties: { overrideInheritedSuffix: true },
    });
    expect(r.effectiveSuffix).toBeUndefined();
    expect(r.suffixLevel).toBeUndefined();
    expect(r.url).toBe('https://d.com');
  });

  it('campaign blank override CLEARS the advertiser suffix', () => {
    const r = resolveClickThroughUrl({
      assignment: {},
      landingPages: [lp('1', 'https://d.com')],
      campaignDefaultLandingPageId: '1',
      advertiserSuffix: 'a=adv',
      campaignSuffixProperties: { clickThroughUrlSuffix: '', overrideInheritedSuffix: true },
    });
    expect(r.effectiveSuffix).toBeUndefined();
    expect(r.url).toBe('https://d.com');
  });
});
