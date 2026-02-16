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
      expect(call.url).toBe('http://localhost:5173');
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
  });
});
