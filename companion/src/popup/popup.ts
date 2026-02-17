import type { CM360PageContext, ExtensionMessage } from '../types.js';

const contextDisplay = document.getElementById('context-display')!;
const openKikiBtn = document.getElementById('open-kiki') as HTMLButtonElement;
const settingsToggle = document.getElementById('settings-toggle')!;
const settingsPanel = document.getElementById('settings-panel')!;
const baseUrlInput = document.getElementById('base-url-input') as HTMLInputElement;
const saveSettingsBtn = document.getElementById('save-settings')!;

let currentContext: CM360PageContext | null = null;

/**
 * Render a "no context" message in the popup.
 */
function renderNoContext(): void {
  contextDisplay.textContent = '';
  const noCtx = document.createElement('div');
  noCtx.className = 'no-context';
  noCtx.textContent = 'No CM360 page detected. Navigate to a CM360 page or the mock test page.';
  contextDisplay.appendChild(noCtx);
  openKikiBtn.disabled = true;
}

/**
 * Render the detected CM360 context in the popup.
 */
function renderContext(context: CM360PageContext | null): void {
  if (!context || (!context.advertiserId && !context.campaignId && !context.accountId)) {
    renderNoContext();
    return;
  }

  const items: Array<{ label: string; value: string }> = [];

  if (context.accountId) items.push({ label: 'Account', value: context.accountId });
  if (context.profileId) items.push({ label: 'Profile', value: context.profileId });
  if (context.advertiserId) items.push({ label: 'Advertiser', value: context.advertiserId });
  if (context.campaignId) items.push({ label: 'Campaign', value: context.campaignId });
  if (context.pageType) items.push({ label: 'Page', value: context.pageType });

  contextDisplay.textContent = '';
  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'context-item';
    const label = document.createElement('span');
    label.className = 'context-label';
    label.textContent = item.label;
    const value = document.createElement('span');
    value.className = 'context-value';
    value.textContent = item.value;
    div.appendChild(label);
    div.appendChild(value);
    contextDisplay.appendChild(div);
  }

  openKikiBtn.disabled = false;
}

/**
 * Fetch current context from the background service worker.
 */
function fetchContext(): void {
  chrome.runtime.sendMessage(
    { type: 'GET_CONTEXT' } satisfies ExtensionMessage,
    (response: ExtensionMessage | undefined) => {
      if (chrome.runtime.lastError) {
        // Background worker not available
        renderNoContext();
        return;
      }
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
    const baseUrl = String(result.baseUrl);
    // Validate URL is HTTP/HTTPS
    try {
      const parsed = new URL(baseUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        console.error('Invalid baseUrl protocol:', parsed.protocol);
        return;
      }
      const params = new URLSearchParams();
      if (currentContext?.advertiserId) params.set('advertiserId', currentContext.advertiserId);
      if (currentContext?.campaignId) params.set('campaignId', currentContext.campaignId);

      const query = params.toString();
      const url = query
        ? `${parsed.origin}${parsed.pathname}?${query}`
        : `${parsed.origin}${parsed.pathname}`;
      chrome.tabs.create({ url });
    } catch {
      console.error('Invalid baseUrl:', baseUrl);
    }
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
