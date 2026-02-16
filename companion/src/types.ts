/** Context extracted from a CM360 page (or mock page) */
export interface CM360PageContext {
  accountId?: string;
  profileId?: string;
  advertiserId?: string;
  campaignId?: string;
  pageType?: string; // e.g. "placements", "campaigns", "ads", "creatives"
}

/** Messages sent between content script ↔ background ↔ popup */
export type ExtensionMessage =
  | { type: 'CM360_CONTEXT'; data: CM360PageContext }
  | { type: 'GET_CONTEXT' }
  | { type: 'CONTEXT_RESPONSE'; data: CM360PageContext | null };
