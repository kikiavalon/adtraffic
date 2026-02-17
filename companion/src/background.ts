import type { CM360PageContext, ExtensionMessage } from './types.js';

/**
 * Per-tab context storage. Keyed by tab ID so multiple CM360 tabs
 * don't clobber each other's context.
 */
const contextByTab = new Map<number, CM360PageContext>();

/**
 * Track the most recently updated tab ID so GET_CONTEXT can fall back
 * when the requesting tab has no stored context.
 */
let lastUpdatedTabId: number | null = null;

/**
 * Listen for messages from the content script and popup.
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    switch (message.type) {
      case 'CM360_CONTEXT': {
        const tabId = sender.tab?.id;
        if (tabId != null) {
          contextByTab.set(tabId, message.data);
          lastUpdatedTabId = tabId;
        }

        // Update badge to show we detected a CM360 page
        const label = message.data.pageType?.slice(0, 4).toUpperCase() ?? 'CM';
        const badgeTarget = tabId != null ? { tabId } : undefined;
        chrome.action.setBadgeText({ text: label, ...badgeTarget });
        chrome.action.setBadgeBackgroundColor({ color: '#16a34a', ...badgeTarget }); // green
        break;
      }
      case 'GET_CONTEXT': {
        const senderTabId = sender.tab?.id;
        // Return context for the sender's tab, or fall back to the most recently stored context
        let context: CM360PageContext | null = null;
        if (senderTabId != null && contextByTab.has(senderTabId)) {
          context = contextByTab.get(senderTabId)!;
        } else if (lastUpdatedTabId != null && contextByTab.has(lastUpdatedTabId)) {
          context = contextByTab.get(lastUpdatedTabId)!;
        }
        sendResponse({ type: 'CONTEXT_RESPONSE', data: context });
        // sendResponse is called synchronously above, but return true to keep the
        // message channel open — required when the caller uses the callback form
        return true;
      }
    }
  },
);

/**
 * Clear badge and per-tab context when navigating away from CM360.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    const isCM360 =
      changeInfo.url.includes('campaignmanager.google.com') ||
      changeInfo.url.includes('mock-cm360');

    if (!isCM360) {
      contextByTab.delete(tabId);
      if (lastUpdatedTabId === tabId) {
        lastUpdatedTabId = null;
      }
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }
});
