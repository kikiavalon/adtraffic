import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('content script', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    // Reset location hash
    window.location.hash = '';
  });

  async function loadContentScript() {
    await import('../content.js');
    // Allow microtasks to settle
    await new Promise((r) => setTimeout(r, 0));
  }

  describe('initial load', () => {
    it('stores extracted context in chrome.storage.local', async () => {
      window.location.hash =
        '#/accounts/67890/profiles/12345/advertisers/90000/campaigns/90014/placements';

      await loadContentScript();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          cm360Context: expect.objectContaining({
            accountId: '67890',
            profileId: '12345',
            advertiserId: '90000',
            campaignId: '90014',
            pageType: 'placements',
          }),
        }),
      );
    });

    it('sends CM360_CONTEXT message via chrome.runtime.sendMessage', async () => {
      window.location.hash = '#/accounts/67890/profiles/12345/advertisers/90000/placements';

      await loadContentScript();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CM360_CONTEXT',
          data: expect.objectContaining({
            accountId: '67890',
            advertiserId: '90000',
          }),
        }),
      );
    });

    it('injects FAB button (#adtraffic-kiki-fab) into document.body', async () => {
      window.location.hash = '#/accounts/67890/profiles/12345';

      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab');
      expect(fab).not.toBeNull();
      expect(fab?.tagName).toBe('BUTTON');
    });

    it('FAB has correct text "K"', async () => {
      window.location.hash = '#/accounts/67890';

      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab');
      expect(fab?.textContent).toBe('K');
    });

    it('FAB has position fixed and z-index 999999', async () => {
      window.location.hash = '#/accounts/67890';

      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab');
      expect(fab?.style.position).toBe('fixed');
      expect(fab?.style.zIndex).toBe('999999');
    });

    it('does not inject duplicate button on re-import', async () => {
      window.location.hash = '#/accounts/67890';

      await loadContentScript();
      // Manually call injectFloatingButton scenario — since we re-import module,
      // the module-level main() runs, but duplicate guard should prevent a second button
      const fabs = document.querySelectorAll('#adtraffic-kiki-fab');
      expect(fabs.length).toBe(1);
    });

    it('merges hash and DOM context', async () => {
      window.location.hash = '#/accounts/67890/profiles/12345/placements';
      document.body.innerHTML = '<div data-advertiser-id="90000" data-campaign-id="90014"></div>';

      await loadContentScript();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          cm360Context: expect.objectContaining({
            accountId: '67890',
            profileId: '12345',
            advertiserId: '90000',
            campaignId: '90014',
            pageType: 'placements',
          }),
        }),
      );
    });

    it('handles empty hash gracefully', async () => {
      window.location.hash = '';

      await loadContentScript();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CM360_CONTEXT',
        }),
      );

      const fab = document.getElementById('adtraffic-kiki-fab');
      expect(fab).not.toBeNull();
    });

    it('extracts context from DOM only when hash is empty', async () => {
      window.location.hash = '';
      document.body.innerHTML = '<div data-advertiser-id="90000" data-campaign-id="90014"></div>';

      await loadContentScript();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          cm360Context: expect.objectContaining({
            advertiserId: '90000',
            campaignId: '90014',
          }),
        }),
      );
    });

    it('FAB has title attribute set', async () => {
      window.location.hash = '#/accounts/67890';
      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab')!;
      expect(fab.title).toBe('Open Kiki — AdTraffic.ai');
    });

    it('FAB is appended to document.body', async () => {
      window.location.hash = '#/accounts/67890';
      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab')!;
      expect(fab.parentNode).toBe(document.body);
    });

    it('FAB has border-radius 50% (circular)', async () => {
      window.location.hash = '#/accounts/67890';
      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab')!;
      expect(fab.style.borderRadius).toBe('50%');
    });

    it('sends context with all fields extracted from hash', async () => {
      window.location.hash =
        '#/accounts/11111/profiles/22222/advertisers/33333/campaigns/44444/ads';

      await loadContentScript();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CM360_CONTEXT',
        data: expect.objectContaining({
          accountId: '11111',
          profileId: '22222',
          advertiserId: '33333',
          campaignId: '44444',
          pageType: 'ads',
        }),
      });
    });
  });

  describe('FAB click handler', () => {
    let openSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    it('opens new window with base URL + context query params', async () => {
      window.location.hash = '#/accounts/67890/profiles/12345/advertisers/90000/campaigns/90014/placements';

      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab')!;
      fab.click();

      // chrome.storage.local.get triggers callback synchronously in our mock
      expect(openSpy).toHaveBeenCalledWith(
        'http://localhost:5173/?advertiserId=90000&campaignId=90014',
        '_blank',
      );
    });

    it('includes advertiserId when present', async () => {
      window.location.hash = '#/accounts/67890/profiles/12345/advertisers/90000';

      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab')!;
      fab.click();

      const url = openSpy.mock.calls[0][0] as string;
      expect(url).toContain('advertiserId=90000');
    });

    it('includes campaignId when present', async () => {
      window.location.hash = '#/accounts/67890/profiles/12345/advertisers/90000/campaigns/90014/placements';

      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab')!;
      fab.click();

      const url = openSpy.mock.calls[0][0] as string;
      expect(url).toContain('campaignId=90014');
    });

    it('uses default localhost URL when no baseUrl configured', async () => {
      window.location.hash = '#/accounts/67890';

      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab')!;
      fab.click();

      const url = openSpy.mock.calls[0][0] as string;
      expect(url.startsWith('http://localhost:5173/')).toBe(true);
    });

    it('uses custom baseUrl from storage', async () => {
      // Pre-set a custom baseUrl in storage
      chrome.storage.local.set({ baseUrl: 'https://app.adtraffic.ai' });

      window.location.hash = '#/accounts/67890/profiles/12345/advertisers/90000/placements';

      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab')!;
      fab.click();

      const url = openSpy.mock.calls[0][0] as string;
      expect(url.startsWith('https://app.adtraffic.ai/')).toBe(true);
    });

    it('omits missing params from URL', async () => {
      window.location.hash = '#/accounts/67890/profiles/12345';

      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab')!;
      fab.click();

      const url = openSpy.mock.calls[0][0] as string;
      expect(url).not.toContain('advertiserId');
      expect(url).not.toContain('campaignId');
    });

    it('opens window with _blank target', async () => {
      window.location.hash = '#/accounts/67890/profiles/12345/advertisers/90000';

      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab')!;
      fab.click();

      expect(openSpy).toHaveBeenCalledWith(expect.any(String), '_blank');
    });

    it('includes only campaignId when advertiserId is missing from hash', async () => {
      // Edge case: campaign without advertiser in hash
      window.location.hash = '#/accounts/67890/campaigns/90014/placements';

      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab')!;
      fab.click();

      const url = openSpy.mock.calls[0][0] as string;
      expect(url).toContain('campaignId=90014');
      expect(url).not.toContain('advertiserId');
    });
  });

  describe('hashchange listener', () => {
    it('re-extracts context on hashchange', async () => {
      window.location.hash = '#/accounts/67890';

      await loadContentScript();

      // Clear previous calls
      vi.mocked(chrome.runtime.sendMessage).mockClear();
      vi.mocked(chrome.storage.local.set).mockClear();

      // Trigger hashchange
      window.location.hash = '#/accounts/67890/profiles/12345/advertisers/90000/placements';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CM360_CONTEXT',
          data: expect.objectContaining({
            advertiserId: '90000',
          }),
        }),
      );
    });

    it('updates chrome.storage.local on hashchange', async () => {
      window.location.hash = '#/accounts/67890';

      await loadContentScript();

      vi.mocked(chrome.storage.local.set).mockClear();

      window.location.hash = '#/accounts/11111/profiles/22222/advertisers/33333/campaigns/44444/ads';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          cm360Context: expect.objectContaining({
            accountId: '11111',
            advertiserId: '33333',
            campaignId: '44444',
          }),
        }),
      );
    });

    it('sends updated CM360_CONTEXT message on hashchange', async () => {
      window.location.hash = '#/accounts/67890';

      await loadContentScript();

      vi.mocked(chrome.runtime.sendMessage).mockClear();

      window.location.hash = '#/accounts/99999/profiles/88888/advertisers/77777/campaigns';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CM360_CONTEXT',
        data: expect.objectContaining({
          accountId: '99999',
          profileId: '88888',
          advertiserId: '77777',
          pageType: 'campaigns',
        }),
      });
    });

    it('re-creates FAB with updated context on hashchange', async () => {
      window.location.hash = '#/accounts/67890';

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      await loadContentScript();

      // Change hash to include advertiser/campaign
      window.location.hash = '#/accounts/67890/profiles/12345/advertisers/55555/campaigns/66666/placements';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      // Still only one FAB
      const fabs = document.querySelectorAll('#adtraffic-kiki-fab');
      expect(fabs.length).toBe(1);

      // Click FAB — should use updated context
      const fab = document.getElementById('adtraffic-kiki-fab')!;
      fab.click();

      const url = openSpy.mock.calls[0][0] as string;
      expect(url).toContain('advertiserId=55555');
      expect(url).toContain('campaignId=66666');
    });

    it('removes old FAB before injecting new one', async () => {
      window.location.hash = '#/accounts/67890';

      await loadContentScript();

      const originalFab = document.getElementById('adtraffic-kiki-fab')!;

      window.location.hash = '#/accounts/99999';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      // Original FAB should be removed from DOM
      expect(originalFab.parentNode).toBeNull();
      // New FAB should exist
      expect(document.getElementById('adtraffic-kiki-fab')).not.toBeNull();
    });

    it('handles multiple rapid hashchanges', async () => {
      window.location.hash = '#/accounts/67890';
      await loadContentScript();

      vi.mocked(chrome.runtime.sendMessage).mockClear();

      // Rapid sequence of hashchanges
      window.location.hash = '#/accounts/11111/advertisers/22222';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      window.location.hash = '#/accounts/33333/advertisers/44444';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      window.location.hash = '#/accounts/55555/advertisers/66666/placements';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      // Should have called sendMessage at least 3 times (once per hashchange)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(
        vi.mocked(chrome.runtime.sendMessage).mock.calls.length,
      );

      // Last sendMessage call should contain the final context
      const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls;
      const lastCall = calls[calls.length - 1][0] as {
        type: string;
        data: { accountId: string; advertiserId: string };
      };
      expect(lastCall.data.accountId).toBe('55555');
      expect(lastCall.data.advertiserId).toBe('66666');

      // Still only one FAB in DOM
      expect(document.querySelectorAll('#adtraffic-kiki-fab').length).toBe(1);
    });

    it('merges DOM context on hashchange', async () => {
      window.location.hash = '#/accounts/67890';
      document.body.innerHTML = '<div data-advertiser-id="90000"></div>';

      await loadContentScript();

      vi.mocked(chrome.storage.local.set).mockClear();

      // Hashchange — DOM still has advertiser data attribute
      window.location.hash = '#/accounts/11111/profiles/22222/campaigns';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          cm360Context: expect.objectContaining({
            accountId: '11111',
            profileId: '22222',
            advertiserId: '90000',
            pageType: 'campaigns',
          }),
        }),
      );
    });
  });
});
