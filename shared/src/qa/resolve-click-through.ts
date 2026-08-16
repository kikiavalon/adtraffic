import type { CM360ClickThroughUrl, CM360ClickThroughUrlSuffixProperties } from '../types/cm360.js';

export interface ResolveClickThroughInput {
  assignment: CM360ClickThroughUrl;
  /** Landing pages visible to the resolver (must include any referenced ids). */
  landingPages: Array<{ id: string; url: string }>;
  campaignDefaultLandingPageId?: string;
  advertiserSuffix?: string;
  campaignSuffixProperties?: CM360ClickThroughUrlSuffixProperties;
  adSuffixProperties?: CM360ClickThroughUrlSuffixProperties;
}

export interface ResolvedClickThrough {
  /** Final URL including effective suffix; undefined when unresolvable. */
  url?: string;
  source: 'custom' | 'landing_page' | 'campaign_default' | 'unresolved';
  effectiveSuffix?: string;
  suffixLevel?: 'advertiser' | 'campaign' | 'ad';
}

/**
 * CM360 suffix inheritance: lower levels override (never append) when overrideInheritedSuffix
 * is set — and an override with a blank/absent suffix CLEARS the inherited suffix entirely.
 */
function effectiveSuffix(input: ResolveClickThroughInput): { suffix?: string; level?: ResolvedClickThrough['suffixLevel'] } {
  const { advertiserSuffix, campaignSuffixProperties: c, adSuffixProperties: a } = input;
  if (a?.overrideInheritedSuffix) return a.clickThroughUrlSuffix ? { suffix: a.clickThroughUrlSuffix, level: 'ad' } : {};
  if (c?.overrideInheritedSuffix) return c.clickThroughUrlSuffix ? { suffix: c.clickThroughUrlSuffix, level: 'campaign' } : {};
  if (advertiserSuffix) return { suffix: advertiserSuffix, level: 'advertiser' };
  return {};
}

function appendSuffix(url: string, suffix?: string): string {
  if (!suffix) return url;
  return url + (url.includes('?') ? '&' : '?') + suffix;
}

export function resolveClickThroughUrl(input: ResolveClickThroughInput): ResolvedClickThrough {
  const byId = new Map(input.landingPages.map(lp => [lp.id, lp.url]));
  const { suffix, level } = effectiveSuffix(input);
  const finish = (base: string, source: ResolvedClickThrough['source']): ResolvedClickThrough =>
    ({ url: appendSuffix(base, suffix), source, effectiveSuffix: suffix, suffixLevel: level });

  const a = input.assignment;
  if (a.customClickThroughUrl) return finish(a.customClickThroughUrl, 'custom');
  if (a.landingPageId) {
    const url = byId.get(a.landingPageId);
    return url ? finish(url, 'landing_page') : { source: 'unresolved', effectiveSuffix: suffix, suffixLevel: level };
  }
  if (input.campaignDefaultLandingPageId) {
    const url = byId.get(input.campaignDefaultLandingPageId);
    if (url) return finish(url, 'campaign_default');
  }
  return { source: 'unresolved', effectiveSuffix: suffix, suffixLevel: level };
}
