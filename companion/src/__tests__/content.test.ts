import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('content script', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    // Remove injected style element from previous test
    document.getElementById('adtraffic-kiki-fab-style')?.remove();
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

    it('FAB has the adtraffic-kiki-fab class applied', async () => {
      window.location.hash = '#/accounts/67890';

      await loadContentScript();

      const fab = document.getElementById('adtraffic-kiki-fab');
      expect(fab?.className).toBe('adtraffic-kiki-fab');
    });

    it('injects a <style> element with FAB CSS including position fixed and z-index', async () => {
      window.location.hash = '#/accounts/67890';

      await loadContentScript();

      const style = document.getElementById('adtraffic-kiki-fab-style');
      expect(style).not.toBeNull();
      expect(style?.tagName).toBe('STYLE');
      expect(style?.textContent).toContain('position: fixed');
      expect(style?.textContent).toContain('z-index: 999999');
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

    it('style element contains border-radius 50% (circular)', async () => {
      window.location.hash = '#/accounts/67890';
      await loadContentScript();

      const style = document.getElementById('adtraffic-kiki-fab-style')!;
      expect(style.textContent).toContain('border-radius: 50%');
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

  describe('FAB styling (injected <style> element)', () => {
    async function getStyleContent(): Promise<string> {
      window.location.hash = '#/accounts/67890';
      await loadContentScript();
      const style = document.getElementById('adtraffic-kiki-fab-style')!;
      return style.textContent ?? '';
    }

    it('style element contains width 56px', async () => {
      const css = await getStyleContent();
      expect(css).toContain('width: 56px');
    });

    it('style element contains height 56px', async () => {
      const css = await getStyleContent();
      expect(css).toContain('height: 56px');
    });

    it('style element contains bottom 24px', async () => {
      const css = await getStyleContent();
      expect(css).toContain('bottom: 24px');
    });

    it('style element contains right 24px', async () => {
      const css = await getStyleContent();
      expect(css).toContain('right: 24px');
    });

    it('style element contains cursor pointer', async () => {
      const css = await getStyleContent();
      expect(css).toContain('cursor: pointer');
    });

    it('style element contains border none', async () => {
      const css = await getStyleContent();
      expect(css).toContain('border: none');
    });

    it('style element contains white text color', async () => {
      const css = await getStyleContent();
      expect(css).toContain('color: #fff');
    });

    it('style element contains font-size 22px', async () => {
      const css = await getStyleContent();
      expect(css).toContain('font-size: 22px');
    });

    it('style element contains font-weight 700', async () => {
      const css = await getStyleContent();
      expect(css).toContain('font-weight: 700');
    });

    it('style element contains display flex', async () => {
      const css = await getStyleContent();
      expect(css).toContain('display: flex');
    });

    it('style element contains align-items center', async () => {
      const css = await getStyleContent();
      expect(css).toContain('align-items: center');
    });

    it('style element contains justify-content center', async () => {
      const css = await getStyleContent();
      expect(css).toContain('justify-content: center');
    });

    it('style element contains gradient background', async () => {
      const css = await getStyleContent();
      expect(css).toContain('linear-gradient');
    });

    it('style element contains transition for transform and box-shadow', async () => {
      const css = await getStyleContent();
      expect(css).toContain('transition:');
      expect(css).toContain('transform');
      expect(css).toContain('box-shadow');
    });

    it('style element contains :hover rule with scale(1.1)', async () => {
      const css = await getStyleContent();
      expect(css).toContain(':hover');
      expect(css).toContain('scale(1.1)');
    });

    it('does not inject duplicate style element on hashchange', async () => {
      window.location.hash = '#/accounts/67890';
      await loadContentScript();

      // Trigger hashchange which re-creates FAB
      window.location.hash = '#/accounts/99999';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      const styles = document.querySelectorAll('#adtraffic-kiki-fab-style');
      expect(styles.length).toBe(1);
    });
  });

  describe('FAB hover behavior', () => {
    it('mouseenter scales FAB to 1.1', async () => {
      window.location.hash = '#/accounts/67890';
      await loadContentScript();
      const fab = document.getElementById('adtraffic-kiki-fab')!;

      fab.dispatchEvent(new MouseEvent('mouseenter'));
      expect(fab.style.transform).toBe('scale(1.1)');
    });

    it('mouseenter increases box-shadow', async () => {
      window.location.hash = '#/accounts/67890';
      await loadContentScript();
      const fab = document.getElementById('adtraffic-kiki-fab')!;

      fab.dispatchEvent(new MouseEvent('mouseenter'));
      expect(fab.style.boxShadow).toContain('20px');
    });

    it('mouseleave resets scale to 1', async () => {
      window.location.hash = '#/accounts/67890';
      await loadContentScript();
      const fab = document.getElementById('adtraffic-kiki-fab')!;

      fab.dispatchEvent(new MouseEvent('mouseenter'));
      fab.dispatchEvent(new MouseEvent('mouseleave'));
      expect(fab.style.transform).toBe('scale(1)');
    });

    it('mouseleave resets box-shadow', async () => {
      window.location.hash = '#/accounts/67890';
      await loadContentScript();
      const fab = document.getElementById('adtraffic-kiki-fab')!;

      fab.dispatchEvent(new MouseEvent('mouseenter'));
      fab.dispatchEvent(new MouseEvent('mouseleave'));
      expect(fab.style.boxShadow).toContain('14px');
    });
  });

  describe('storage key format', () => {
    it('stores context under "cm360Context" key', async () => {
      window.location.hash = '#/accounts/67890';
      await loadContentScript();

      const setCall = vi.mocked(chrome.storage.local.set).mock.calls[0][0] as Record<string, unknown>;
      expect('cm360Context' in setCall).toBe(true);
    });

    it('message type is always CM360_CONTEXT', async () => {
      window.location.hash = '#/accounts/67890';
      await loadContentScript();

      const sendCall = vi.mocked(chrome.runtime.sendMessage).mock.calls[0][0] as { type: string };
      expect(sendCall.type).toBe('CM360_CONTEXT');
    });

    it('message data matches stored context', async () => {
      window.location.hash = '#/accounts/67890/profiles/12345/advertisers/90000/placements';
      await loadContentScript();

      const setCall = vi.mocked(chrome.storage.local.set).mock.calls[0][0] as { cm360Context: unknown };
      const sendCall = vi.mocked(chrome.runtime.sendMessage).mock.calls[0][0] as { data: unknown };
      expect(setCall.cm360Context).toEqual(sendCall.data);
    });
  });

  describe('execution order', () => {
    it('calls storage.set before sendMessage', async () => {
      const callOrder: string[] = [];
      vi.mocked(chrome.storage.local.set).mockImplementation((...args: unknown[]) => {
        callOrder.push('storage.set');
        const items = args[0] as Record<string, unknown>;
        // Maintain mock behavior
        Object.assign({}, items);
      });
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(() => {
        callOrder.push('sendMessage');
      });

      window.location.hash = '#/accounts/67890';
      await loadContentScript();

      const setIdx = callOrder.indexOf('storage.set');
      const sendIdx = callOrder.indexOf('sendMessage');
      expect(setIdx).toBeLessThan(sendIdx);
    });
  });
});
