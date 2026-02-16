import type { CM360PageContext, ExtensionMessage } from '../types.js';

const contextDisplay = document.getElementById('context-display')!;
const openKikiBtn = document.getElementById('open-kiki') as HTMLButtonElement;
const settingsToggle = document.getElementById('settings-toggle')!;
const settingsPanel = document.getElementById('settings-panel')!;
const baseUrlInput = document.getElementById('base-url-input') as HTMLInputElement;
const saveSettingsBtn = document.getElementById('save-settings')!;

let currentContext: CM360PageContext | null = null;

/**
 * Render the detected CM360 context in the popup.
 */
function renderContext(context: CM360PageContext | null): void {
  if (!context || (!context.advertiserId && !context.campaignId && !context.accountId)) {
    contextDisplay.innerHTML = '<div class="no-context">No CM360 page detected.<br>Navigate to a CM360 page or the mock test page.</div>';
    openKikiBtn.disabled = true;
    return;
  }

  const items: Array<{ label: string; value: string }> = [];

  if (context.accountId) items.push({ label: 'Account', value: context.accountId });
  if (context.profileId) items.push({ label: 'Profile', value: context.profileId });
  if (context.advertiserId) items.push({ label: 'Advertiser', value: context.advertiserId });
  if (context.campaignId) items.push({ label: 'Campaign', value: context.campaignId });
  if (context.pageType) items.push({ label: 'Page', value: context.pageType });

  contextDisplay.innerHTML = items
    .map(
      (item) =>
        `<div class="context-item"><span class="context-label">${item.label}</span><span class="context-value">${item.value}</span></div>`,
    )
    .join('');

  openKikiBtn.disabled = false;
}

/**
 * Fetch current context from the background service worker.
 */
function fetchContext(): void {
  chrome.runtime.sendMessage(
    { type: 'GET_CONTEXT' } satisfies ExtensionMessage,
    (response: ExtensionMessage | undefined) => {
      if (response?.type === 'CONTEXT_RESPONSE') {
        currentContext = response.data;
        renderContext(currentContext);
      } else {
        // Fallback: try reading from storage
        chrome.storage.local.get('cm360Context', (result) => {
          currentContext = (result.cm360Context as CM360PageContext) ?? null;
          renderContext(currentContext);
        });
      }
    },
  );
}

/**
 * Open Kiki web app with the detected context.
 */
openKikiBtn.addEventListener('click', () => {
  chrome.storage.local.get({ baseUrl: 'http://localhost:5173' }, (result) => {
    const params = new URLSearchParams();
    if (currentContext?.advertiserId) params.set('advertiserId', currentContext.advertiserId);
    if (currentContext?.campaignId) params.set('campaignId', currentContext.campaignId);

    const query = params.toString();
    const url = query ? `${result.baseUrl}/?${query}` : result.baseUrl;
    chrome.tabs.create({ url });
  });
});

/**
 * Settings panel toggle.
 */
settingsToggle.addEventListener('click', () => {
  const isHidden = settingsPanel.hidden;
  settingsPanel.hidden = !isHidden;
  settingsToggle.textContent = isHidden ? 'Hide Settings' : 'Settings';
});

/**
 * Load saved base URL.
 */
chrome.storage.local.get({ baseUrl: 'http://localhost:5173' }, (result) => {
  baseUrlInput.value = result.baseUrl;
});

/**
 * Save settings.
 */
saveSettingsBtn.addEventListener('click', () => {
  const baseUrl = baseUrlInput.value.trim().replace(/\/+$/, '');
  chrome.storage.local.set({ baseUrl }, () => {
    saveSettingsBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveSettingsBtn.textContent = 'Save';
    }, 1500);
  });
});

// Initialize
fetchContext();
