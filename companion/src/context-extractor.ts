import type { CM360PageContext } from './types.js';

/**
 * Parse CM360 context from the URL hash.
 *
 * Real CM360 URL pattern:
 *   https://campaignmanager.google.com/#/accounts/{accountId}/profiles/{profileId}/advertisers/{advertiserId}/campaigns/{campaignId}/...
 *
 * Mock page URL pattern (same hash structure):
 *   http://localhost:5173/mock-cm360.html#/accounts/67890/profiles/12345/advertisers/90000/campaigns/90014/placements
 */
export function extractContextFromHash(hash: string): CM360PageContext {
  const context: CM360PageContext = {};

  const accountMatch = hash.match(/\/accounts\/(\d+)/);
  if (accountMatch) context.accountId = accountMatch[1];

  const profileMatch = hash.match(/\/profiles\/(\d+)/);
  if (profileMatch) context.profileId = profileMatch[1];

  const advertiserMatch = hash.match(/\/advertisers\/(\d+)/);
  if (advertiserMatch) context.advertiserId = advertiserMatch[1];

  const campaignMatch = hash.match(/\/campaigns\/(\d+)/);
  if (campaignMatch) context.campaignId = campaignMatch[1];

  // Detect page type from the last path segment
  const segments = hash.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  if (lastSegment && !/^\d+$/.test(lastSegment)) {
    context.pageType = lastSegment;
  }

  return context;
}

/**
 * Extract context from DOM data attributes as a fallback.
 * The mock CM360 page and potentially real CM360 pages may expose data attributes.
 */
export function extractContextFromDOM(): CM360PageContext {
  const context: CM360PageContext = {};

  const advertiserEl = document.querySelector('[data-advertiser-id]');
  if (advertiserEl) {
    context.advertiserId = advertiserEl.getAttribute('data-advertiser-id') ?? undefined;
  }

  const campaignEl = document.querySelector('[data-campaign-id]');
  if (campaignEl) {
    context.campaignId = campaignEl.getAttribute('data-campaign-id') ?? undefined;
  }

  const accountEl = document.querySelector('[data-account-id]');
  if (accountEl) {
    context.accountId = accountEl.getAttribute('data-account-id') ?? undefined;
  }

  const profileEl = document.querySelector('[data-profile-id]');
  if (profileEl) {
    context.profileId = profileEl.getAttribute('data-profile-id') ?? undefined;
  }

  return context;
}

/**
 * Merge two contexts — hash-based values take priority, DOM fills gaps.
 */
export function mergeContexts(primary: CM360PageContext, fallback: CM360PageContext): CM360PageContext {
  return {
    accountId: primary.accountId ?? fallback.accountId,
    profileId: primary.profileId ?? fallback.profileId,
    advertiserId: primary.advertiserId ?? fallback.advertiserId,
    campaignId: primary.campaignId ?? fallback.campaignId,
    pageType: primary.pageType ?? fallback.pageType,
  };
}
