import { describe, it, expect, beforeEach, vi } from 'vitest';

function setupPopupHTML() {
  document.body.innerHTML = `
    <div id="context-display"></div>
    <button id="open-kiki" disabled></button>
    <button id="settings-toggle">Settings</button>
    <div id="settings-panel" hidden>
      <input id="base-url-input" type="url" />
      <button id="save-settings">Save</button>
    </div>
  `;
}

describe('popup', () => {
  beforeEach(() => {
    vi.resetModules();
    setupPopupHTML();
  });

  /**
   * Helper: configure chrome.runtime.sendMessage to invoke callback with a
   * CONTEXT_RESPONSE containing the given context, then dynamically import popup.
   */
  async function loadPopupWithContext(
    context: Record<string, string> | null,
  ) {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (_message: unknown, callback?: (response?: unknown) => void) => {
        if (callback) {
          callback({ type: 'CONTEXT_RESPONSE', data: context });
        }
      },
    );
    await import('../popup/popup.js');
  }

  /**
   * Helper: configure sendMessage to return undefined (no response),
   * and optionally set storage fallback context.
   */
  async function loadPopupWithoutResponse(
    storageContext?: Record<string, string> | null,
  ) {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (_message: unknown, callback?: (response?: unknown) => void) => {
        if (callback) {
          callback(undefined);
        }
      },
    );
    if (storageContext !== undefined) {
      chrome.storage.local.set({ cm360Context: storageContext });
    }
    await import('../popup/popup.js');
  }

  describe('renderContext', () => {
    it('shows "No CM360 page detected" when context is null', async () => {
      await loadPopupWithContext(null);

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('No CM360 page detected');
    });

    it('shows "No CM360 page detected" when context has no IDs', async () => {
      await loadPopupWithContext({ pageType: 'placements' });

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('No CM360 page detected');
    });

    it('disables Open Kiki button when no context', async () => {
      await loadPopupWithContext(null);

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('renders Account context field', async () => {
      await loadPopupWithContext({ accountId: '67890' });

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('Account');
      expect(display.innerHTML).toContain('67890');
    });

    it('renders Profile context field', async () => {
      await loadPopupWithContext({ accountId: '67890', profileId: '12345' });

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('Profile');
      expect(display.innerHTML).toContain('12345');
    });

    it('renders Advertiser context field', async () => {
      await loadPopupWithContext({ advertiserId: '90000' });

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('Advertiser');
      expect(display.innerHTML).toContain('90000');
    });

    it('renders Campaign context field', async () => {
      await loadPopupWithContext({ campaignId: '90014' });

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('Campaign');
      expect(display.innerHTML).toContain('90014');
    });

    it('renders Page context field', async () => {
      await loadPopupWithContext({
        advertiserId: '90000',
        pageType: 'placements',
      });

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('Page');
      expect(display.innerHTML).toContain('placements');
    });

    it('enables Open Kiki button when context has at least one ID', async () => {
      await loadPopupWithContext({ advertiserId: '90000' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('does not render profileId alone as valid context', async () => {
      await loadPopupWithContext({ profileId: '12345' });

      const display = document.getElementById('context-display')!;
      // profileId alone doesn't satisfy the "has at least one ID" check
      // since the check is: !advertiserId && !campaignId && !accountId
      expect(display.innerHTML).toContain('No CM360 page detected');
    });

    it('enables button when only accountId is present', async () => {
      await loadPopupWithContext({ accountId: '67890' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('enables button when only campaignId is present', async () => {
      await loadPopupWithContext({ campaignId: '90014' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('renders context items with correct CSS classes', async () => {
      await loadPopupWithContext({ advertiserId: '90000' });

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('context-item');
      expect(display.innerHTML).toContain('context-label');
      expect(display.innerHTML).toContain('context-value');
    });

    it('renders fields in order: Account, Profile, Advertiser, Campaign, Page', async () => {
      await loadPopupWithContext({
        accountId: '67890',
        profileId: '12345',
        advertiserId: '90000',
        campaignId: '90014',
        pageType: 'placements',
      });

      const display = document.getElementById('context-display')!;
      const labels = display.querySelectorAll('.context-label');
      expect(labels[0]?.textContent).toBe('Account');
      expect(labels[1]?.textContent).toBe('Profile');
      expect(labels[2]?.textContent).toBe('Advertiser');
      expect(labels[3]?.textContent).toBe('Campaign');
      expect(labels[4]?.textContent).toBe('Page');
    });

    it('renders all context fields when fully populated', async () => {
      await loadPopupWithContext({
        accountId: '67890',
        profileId: '12345',
        advertiserId: '90000',
        campaignId: '90014',
        pageType: 'placements',
      });

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('Account');
      expect(display.innerHTML).toContain('Profile');
      expect(display.innerHTML).toContain('Advertiser');
      expect(display.innerHTML).toContain('Campaign');
      expect(display.innerHTML).toContain('Page');
    });
  });

  describe('fetchContext', () => {
    it('sends GET_CONTEXT message on load', async () => {
      await loadPopupWithContext(null);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'GET_CONTEXT' }),
        expect.any(Function),
      );
    });

    it('renders context from CONTEXT_RESPONSE', async () => {
      await loadPopupWithContext({ advertiserId: '90000', campaignId: '90014' });

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('90000');
      expect(display.innerHTML).toContain('90014');
    });

    it('falls back to chrome.storage.local when response is undefined', async () => {
      await loadPopupWithoutResponse({
        accountId: '67890',
        advertiserId: '90000',
      });

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('67890');
      expect(display.innerHTML).toContain('90000');
    });

    it('shows no-context message when both response and storage are empty', async () => {
      await loadPopupWithoutResponse(null);

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('No CM360 page detected');
    });
  });

  describe('Open Kiki button', () => {
    it('creates tab with URL including context params', async () => {
      await loadPopupWithContext({ advertiserId: '90000', campaignId: '90014' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'http://localhost:5173/?advertiserId=90000&campaignId=90014',
      });
    });

    it('uses default localhost URL when no baseUrl stored', async () => {
      await loadPopupWithContext({ advertiserId: '90000' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();

      const call = chrome.tabs.create.mock.calls[0][0] as { url: string };
      expect(call.url.startsWith('http://localhost:5173/')).toBe(true);
    });

    it('uses custom baseUrl from storage', async () => {
      chrome.storage.local.set({ baseUrl: 'https://app.adtraffic.ai' });

      await loadPopupWithContext({ advertiserId: '90000' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();

      const call = chrome.tabs.create.mock.calls[0][0] as { url: string };
      expect(call.url.startsWith('https://app.adtraffic.ai/')).toBe(true);
    });

    it('omits params when context has no advertiser/campaign IDs', async () => {
      await loadPopupWithContext({ accountId: '67890' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();

      const call = chrome.tabs.create.mock.calls[0][0] as { url: string };
      // URL should be base URL without query params
      expect(call.url).toBe('http://localhost:5173/');
    });

    it('includes only campaignId when advertiserId is missing', async () => {
      await loadPopupWithContext({ campaignId: '90014' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();

      const call = chrome.tabs.create.mock.calls[0][0] as { url: string };
      expect(call.url).toContain('campaignId=90014');
      expect(call.url).not.toContain('advertiserId');
    });

    it('includes only advertiserId when campaignId is missing', async () => {
      await loadPopupWithContext({ advertiserId: '90000' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();

      const call = chrome.tabs.create.mock.calls[0][0] as { url: string };
      expect(call.url).toContain('advertiserId=90000');
      expect(call.url).not.toContain('campaignId');
    });
  });

  describe('settings panel', () => {
    it('toggles settings panel visibility', async () => {
      await loadPopupWithContext(null);

      const toggle = document.getElementById('settings-toggle')!;
      const panel = document.getElementById('settings-panel')!;

      // Initially hidden
      expect(panel.hidden).toBe(true);

      // Click to show
      toggle.click();
      expect(panel.hidden).toBe(false);
      expect(toggle.textContent).toBe('Hide Settings');

      // Click to hide
      toggle.click();
      expect(panel.hidden).toBe(true);
      expect(toggle.textContent).toBe('Settings');
    });

    it('saves trimmed URL and strips trailing slashes', async () => {
      await loadPopupWithContext(null);

      const input = document.getElementById('base-url-input') as HTMLInputElement;
      const saveBtn = document.getElementById('save-settings')!;

      input.value = '  https://app.adtraffic.ai///  ';
      saveBtn.click();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { baseUrl: 'https://app.adtraffic.ai' },
        expect.any(Function),
      );
    });

    it('shows "Saved!" feedback after save', async () => {
      await loadPopupWithContext(null);

      const saveBtn = document.getElementById('save-settings')!;
      const input = document.getElementById('base-url-input') as HTMLInputElement;
      input.value = 'https://example.com';

      saveBtn.click();

      expect(saveBtn.textContent).toBe('Saved!');
    });

    it('loads saved base URL into input on startup', async () => {
      chrome.storage.local.set({ baseUrl: 'https://app.adtraffic.ai' });

      await loadPopupWithContext(null);

      const input = document.getElementById('base-url-input') as HTMLInputElement;
      expect(input.value).toBe('https://app.adtraffic.ai');
    });

    it('loads default base URL when none saved', async () => {
      await loadPopupWithContext(null);

      const input = document.getElementById('base-url-input') as HTMLInputElement;
      expect(input.value).toBe('http://localhost:5173');
    });

    it('saves empty string when input is cleared', async () => {
      await loadPopupWithContext(null);

      const input = document.getElementById('base-url-input') as HTMLInputElement;
      const saveBtn = document.getElementById('save-settings')!;

      input.value = '';
      saveBtn.click();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { baseUrl: '' },
        expect.any(Function),
      );
    });

    it('settings panel starts hidden', async () => {
      await loadPopupWithContext(null);

      const panel = document.getElementById('settings-panel')!;
      expect(panel.hidden).toBe(true);
    });

    it('settings toggle starts with text "Settings"', async () => {
      await loadPopupWithContext(null);

      const toggle = document.getElementById('settings-toggle')!;
      expect(toggle.textContent).toBe('Settings');
    });

    it('strips single trailing slash', async () => {
      await loadPopupWithContext(null);

      const input = document.getElementById('base-url-input') as HTMLInputElement;
      const saveBtn = document.getElementById('save-settings')!;

      input.value = 'https://example.com/';
      saveBtn.click();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { baseUrl: 'https://example.com' },
        expect.any(Function),
      );
    });

    it('preserves path without trailing slash', async () => {
      await loadPopupWithContext(null);

      const input = document.getElementById('base-url-input') as HTMLInputElement;
      const saveBtn = document.getElementById('save-settings')!;

      input.value = 'https://example.com/app';
      saveBtn.click();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { baseUrl: 'https://example.com/app' },
        expect.any(Function),
      );
    });

    it('triple toggle returns to shown state', async () => {
      await loadPopupWithContext(null);

      const toggle = document.getElementById('settings-toggle')!;
      const panel = document.getElementById('settings-panel')!;

      toggle.click(); // show
      toggle.click(); // hide
      toggle.click(); // show again

      expect(panel.hidden).toBe(false);
      expect(toggle.textContent).toBe('Hide Settings');
    });
  });

  describe('renderContext HTML structure', () => {
    it('creates context-item divs for each field', async () => {
      await loadPopupWithContext({
        accountId: '67890',
        advertiserId: '90000',
      });

      const items = document.querySelectorAll('.context-item');
      expect(items.length).toBe(2);
    });

    it('creates exactly 5 context items for full context', async () => {
      await loadPopupWithContext({
        accountId: '67890',
        profileId: '12345',
        advertiserId: '90000',
        campaignId: '90014',
        pageType: 'placements',
      });

      const items = document.querySelectorAll('.context-item');
      expect(items.length).toBe(5);
    });

    it('creates 1 context item for advertiser-only context', async () => {
      await loadPopupWithContext({ advertiserId: '90000' });

      const items = document.querySelectorAll('.context-item');
      expect(items.length).toBe(1);
    });

    it('each context item has a label and value span', async () => {
      await loadPopupWithContext({ advertiserId: '90000' });

      const item = document.querySelector('.context-item')!;
      expect(item.querySelector('.context-label')).not.toBeNull();
      expect(item.querySelector('.context-value')).not.toBeNull();
    });

    it('value spans contain the actual IDs', async () => {
      await loadPopupWithContext({ advertiserId: '90000', campaignId: '90014' });

      const values = document.querySelectorAll('.context-value');
      const valueTexts = Array.from(values).map((v) => v.textContent);
      expect(valueTexts).toContain('90000');
      expect(valueTexts).toContain('90014');
    });

    it('no-context div has class "no-context"', async () => {
      await loadPopupWithContext(null);

      const noContext = document.querySelector('.no-context');
      expect(noContext).not.toBeNull();
    });

    it('no-context message includes navigation hint', async () => {
      await loadPopupWithContext(null);

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('Navigate to a CM360 page');
    });

    it('no-context message mentions mock test page', async () => {
      await loadPopupWithContext(null);

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('mock test page');
    });

    it('does not render profileId without at least one primary ID', async () => {
      await loadPopupWithContext({ profileId: '12345', pageType: 'ads' });

      const display = document.getElementById('context-display')!;
      // profileId+pageType but no accountId/advertiserId/campaignId → no-context
      expect(display.innerHTML).toContain('No CM360 page detected');
    });

    it('renders 3 items for account+advertiser+campaign', async () => {
      await loadPopupWithContext({
        accountId: '67890',
        advertiserId: '90000',
        campaignId: '90014',
      });

      const items = document.querySelectorAll('.context-item');
      expect(items.length).toBe(3);
    });
  });

  describe('Open Kiki button URL construction', () => {
    it('URL has ? separator before params', async () => {
      await loadPopupWithContext({ advertiserId: '90000' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();

      const call = chrome.tabs.create.mock.calls[0][0] as { url: string };
      expect(call.url).toContain('/?');
    });

    it('URL has & separator between multiple params', async () => {
      await loadPopupWithContext({ advertiserId: '90000', campaignId: '90014' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();

      const call = chrome.tabs.create.mock.calls[0][0] as { url: string };
      expect(call.url).toContain('&');
    });

    it('URL does not have trailing ? when no params', async () => {
      await loadPopupWithContext({ accountId: '67890' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();

      const call = chrome.tabs.create.mock.calls[0][0] as { url: string };
      expect(call.url).not.toContain('?');
    });

    it('creates tab exactly once per click', async () => {
      await loadPopupWithContext({ advertiserId: '90000' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();

      expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    });

    it('creates tab with correct URL for baseUrl with port', async () => {
      chrome.storage.local.set({ baseUrl: 'http://localhost:3000' });
      await loadPopupWithContext({ advertiserId: '90000' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();

      const call = chrome.tabs.create.mock.calls[0][0] as { url: string };
      expect(call.url).toBe('http://localhost:3000/?advertiserId=90000');
    });

    it('multiple clicks create multiple tabs', async () => {
      await loadPopupWithContext({ advertiserId: '90000' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();
      btn.click();
      btn.click();

      expect(chrome.tabs.create).toHaveBeenCalledTimes(3);
    });

    it('URL params are properly encoded', async () => {
      await loadPopupWithContext({ advertiserId: '90000', campaignId: '90014' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();

      const call = chrome.tabs.create.mock.calls[0][0] as { url: string };
      // Verify the URL can be parsed
      const url = new URL(call.url);
      expect(url.searchParams.get('advertiserId')).toBe('90000');
      expect(url.searchParams.get('campaignId')).toBe('90014');
    });

    it('button stays enabled after click', async () => {
      await loadPopupWithContext({ advertiserId: '90000' });

      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      btn.click();

      expect(btn.disabled).toBe(false);
    });
  });

  describe('fetchContext message format', () => {
    it('sends message with type GET_CONTEXT', async () => {
      await loadPopupWithContext(null);

      const call = vi.mocked(chrome.runtime.sendMessage).mock.calls[0];
      const message = call[0] as { type: string };
      expect(message.type).toBe('GET_CONTEXT');
    });

    it('sends message with callback function', async () => {
      await loadPopupWithContext(null);

      const call = vi.mocked(chrome.runtime.sendMessage).mock.calls[0];
      expect(typeof call[1]).toBe('function');
    });

    it('fallback reads cm360Context key from storage', async () => {
      await loadPopupWithoutResponse({ accountId: '67890', advertiserId: '90000' });

      expect(chrome.storage.local.get).toHaveBeenCalledWith(
        'cm360Context',
        expect.any(Function),
      );
    });

    it('handles CONTEXT_RESPONSE with null data', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_message: unknown, callback?: (response?: unknown) => void) => {
          if (callback) {
            callback({ type: 'CONTEXT_RESPONSE', data: null });
          }
        },
      );
      await import('../popup/popup.js');

      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('No CM360 page detected');
    });

    it('handles unexpected response type gracefully', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_message: unknown, callback?: (response?: unknown) => void) => {
          if (callback) {
            callback({ type: 'UNKNOWN_TYPE', data: {} });
          }
        },
      );
      await import('../popup/popup.js');

      // Falls back to storage — with empty storage, shows no-context
      const display = document.getElementById('context-display')!;
      expect(display.innerHTML).toContain('No CM360 page detected');
    });
  });

  describe('button state management', () => {
    it('button starts disabled (from HTML)', async () => {
      // Before popup loads, button should be disabled from HTML
      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('button becomes enabled when context has advertiserId', async () => {
      await loadPopupWithContext({ advertiserId: '90000' });
      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('button becomes enabled when context has campaignId', async () => {
      await loadPopupWithContext({ campaignId: '90014' });
      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('button becomes enabled when context has accountId', async () => {
      await loadPopupWithContext({ accountId: '67890' });
      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('button stays disabled with only profileId', async () => {
      await loadPopupWithContext({ profileId: '12345' });
      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('button stays disabled with only pageType', async () => {
      await loadPopupWithContext({ pageType: 'placements' });
      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('button stays disabled with profileId + pageType (no primary IDs)', async () => {
      await loadPopupWithContext({ profileId: '12345', pageType: 'placements' });
      const btn = document.getElementById('open-kiki') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  describe('context display with various combinations', () => {
    it('advertiser + campaign shows 2 items', async () => {
      await loadPopupWithContext({ advertiserId: '90000', campaignId: '90014' });
      const items = document.querySelectorAll('.context-item');
      expect(items.length).toBe(2);
    });

    it('account + profile shows 2 items', async () => {
      await loadPopupWithContext({ accountId: '67890', profileId: '12345' });
      const items = document.querySelectorAll('.context-item');
      expect(items.length).toBe(2);
    });

    it('account + advertiser + pageType shows 3 items', async () => {
      await loadPopupWithContext({
        accountId: '67890',
        advertiserId: '90000',
        pageType: 'placements',
      });
      const items = document.querySelectorAll('.context-item');
      expect(items.length).toBe(3);
    });

    it('all IDs without pageType shows 4 items', async () => {
      await loadPopupWithContext({
        accountId: '67890',
        profileId: '12345',
        advertiserId: '90000',
        campaignId: '90014',
      });
      const items = document.querySelectorAll('.context-item');
      expect(items.length).toBe(4);
    });

    it('only accountId shows 1 item', async () => {
      await loadPopupWithContext({ accountId: '67890' });
      const items = document.querySelectorAll('.context-item');
      expect(items.length).toBe(1);
    });
  });
});
