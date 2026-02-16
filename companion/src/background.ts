import type { CM360PageContext, ExtensionMessage } from './types.js';

let latestContext: CM360PageContext | null = null;

/**
 * Listen for messages from the content script and popup.
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'CM360_CONTEXT':
        latestContext = message.data;

        // Update badge to show we detected a CM360 page
        const label = message.data.pageType?.slice(0, 4).toUpperCase() ?? 'CM';
        chrome.action.setBadgeText({ text: label });
        chrome.action.setBadgeBackgroundColor({ color: '#16a34a' }); // green
        break;

      case 'GET_CONTEXT':
        sendResponse({ type: 'CONTEXT_RESPONSE', data: latestContext });
        return true; // keep channel open for async sendResponse
    }
  },
);

/**
 * Clear badge when navigating away from CM360.
 */
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url) {
    const isCM360 =
      changeInfo.url.includes('campaignmanager.google.com') ||
      changeInfo.url.includes('mock-cm360');

    if (!isCM360) {
      latestContext = null;
      chrome.action.setBadgeText({ text: '' });
    }
  }
});
