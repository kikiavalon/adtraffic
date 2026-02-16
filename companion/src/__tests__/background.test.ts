import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ExtensionMessage } from '../types.js';

type MessageListener = (
  message: ExtensionMessage,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

type TabUpdateListener = (
  tabId: number,
  changeInfo: { url?: string },
  tab: unknown,
) => void;

describe('background service worker', () => {
  let messageListener: MessageListener;
  let tabUpdateListener: TabUpdateListener;

  beforeEach(async () => {
    vi.resetModules();
    await import('../background.js');

    // Extract the registered listeners from mock calls
    messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0] as MessageListener;
    tabUpdateListener = chrome.tabs.onUpdated.addListener.mock.calls[0][0] as TabUpdateListener;
  });

  describe('CM360_CONTEXT handler', () => {
    it('stores context and sets badge text from pageType', () => {
      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'CM360_CONTEXT',
          data: { accountId: '67890', advertiserId: '90000', pageType: 'placements' },
        },
        {},
        sendResponse,
      );

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'PLAC' });
    });

    it('sets badge background color to green', () => {
      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'CM360_CONTEXT',
          data: { pageType: 'placements' },
        },
        {},
        sendResponse,
      );

      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#16a34a' });
    });

    it('falls back to "CM" when pageType is undefined', () => {
      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'CM360_CONTEXT',
          data: { accountId: '67890' },
        },
        {},
        sendResponse,
      );

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'CM' });
    });

    it('uses empty badge when pageType is empty string', () => {
      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'CM360_CONTEXT',
          data: { pageType: '' },
        },
        {},
        sendResponse,
      );

      // ''.slice(0,4).toUpperCase() returns '' — ?? only triggers on null/undefined
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    });

    it('handles short pageType ("ads" -> "ADS")', () => {
      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'CM360_CONTEXT',
          data: { pageType: 'ads' },
        },
        {},
        sendResponse,
      );

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'ADS' });
    });

    it('truncates long pageType to 4 chars', () => {
      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'CM360_CONTEXT',
          data: { pageType: 'creatives' },
        },
        {},
        sendResponse,
      );

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'CREA' });
    });

    it('handles "campaigns" pageType', () => {
      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'CM360_CONTEXT',
          data: { pageType: 'campaigns' },
        },
        {},
        sendResponse,
      );

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'CAMP' });
    });

    it('does not call sendResponse for CM360_CONTEXT', () => {
      const sendResponse = vi.fn();
      messageListener(
        { type: 'CM360_CONTEXT', data: { pageType: 'ads' } },
        {},
        sendResponse,
      );
      expect(sendResponse).not.toHaveBeenCalled();
    });

    it('does not return true for CM360_CONTEXT (no async channel)', () => {
      const sendResponse = vi.fn();
      const result = messageListener(
        { type: 'CM360_CONTEXT', data: { pageType: 'ads' } },
        {},
        sendResponse,
      );
      expect(result).not.toBe(true);
    });

    it('latest CM360_CONTEXT overwrites previous context', () => {
      const sendResponse = vi.fn();
      messageListener(
        { type: 'CM360_CONTEXT', data: { advertiserId: '11111', pageType: 'ads' } },
        {},
        sendResponse,
      );
      messageListener(
        { type: 'CM360_CONTEXT', data: { advertiserId: '22222', pageType: 'placements' } },
        {},
        sendResponse,
      );

      const getResponse = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, getResponse);

      expect(getResponse).toHaveBeenCalledWith({
        type: 'CONTEXT_RESPONSE',
        data: { advertiserId: '22222', pageType: 'placements' },
      });
    });

    it('stores context for later retrieval via GET_CONTEXT', () => {
      const sendResponse1 = vi.fn();
      const context = {
        accountId: '67890',
        advertiserId: '90000',
        campaignId: '90014',
        pageType: 'placements',
      };
      messageListener(
        { type: 'CM360_CONTEXT', data: context },
        {},
        sendResponse1,
      );

      const sendResponse2 = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, sendResponse2);

      expect(sendResponse2).toHaveBeenCalledWith({
        type: 'CONTEXT_RESPONSE',
        data: context,
      });
    });
  });

  describe('GET_CONTEXT handler', () => {
    it('returns null when no context has been received yet', () => {
      const sendResponse = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        type: 'CONTEXT_RESPONSE',
        data: null,
      });
    });

    it('returns stored context after CM360_CONTEXT', () => {
      const sendResponse1 = vi.fn();
      const context = { advertiserId: '90000', campaignId: '90014' };
      messageListener(
        { type: 'CM360_CONTEXT', data: context },
        {},
        sendResponse1,
      );

      const sendResponse2 = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, sendResponse2);

      expect(sendResponse2).toHaveBeenCalledWith({
        type: 'CONTEXT_RESPONSE',
        data: context,
      });
    });

    it('returns true to keep channel open for async sendResponse', () => {
      const sendResponse = vi.fn();
      const result = messageListener({ type: 'GET_CONTEXT' }, {}, sendResponse);
      expect(result).toBe(true);
    });

    it('response has type CONTEXT_RESPONSE', () => {
      const sendResponse = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, sendResponse);

      const response = sendResponse.mock.calls[0][0] as { type: string };
      expect(response.type).toBe('CONTEXT_RESPONSE');
    });
  });

  describe('Tab update handler', () => {
    it('clears badge on non-CM360 navigation', () => {
      tabUpdateListener(1, { url: 'https://www.google.com/' }, {});

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    });

    it('preserves badge for campaignmanager.google.com URLs', () => {
      tabUpdateListener(
        1,
        { url: 'https://campaignmanager.google.com/#/accounts/67890' },
        {},
      );

      expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
    });

    it('preserves badge for mock-cm360 URLs', () => {
      tabUpdateListener(
        1,
        { url: 'http://localhost:5173/mock-cm360.html' },
        {},
      );

      expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
    });

    it('does nothing when changeInfo has no url property', () => {
      tabUpdateListener(1, {}, {});

      expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
    });

    it('clears latestContext so subsequent GET_CONTEXT returns null', () => {
      // First, store some context
      const sendResponse1 = vi.fn();
      messageListener(
        {
          type: 'CM360_CONTEXT',
          data: { advertiserId: '90000' },
        },
        {},
        sendResponse1,
      );

      // Navigate away from CM360
      tabUpdateListener(1, { url: 'https://www.example.com' }, {});

      // GET_CONTEXT should now return null
      const sendResponse2 = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, sendResponse2);

      expect(sendResponse2).toHaveBeenCalledWith({
        type: 'CONTEXT_RESPONSE',
        data: null,
      });
    });

    it('does not clear badge for URL containing mock-cm360 in path', () => {
      tabUpdateListener(
        1,
        { url: 'http://localhost:3000/mock-cm360/test' },
        {},
      );

      expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
    });

    it('clears badge on about:blank navigation', () => {
      tabUpdateListener(1, { url: 'about:blank' }, {});
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    });

    it('clears badge on chrome:// navigation', () => {
      tabUpdateListener(1, { url: 'chrome://extensions/' }, {});
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    });

    it('context recovers after navigate-away then new CM360_CONTEXT', () => {
      const sendResponse = vi.fn();
      // Set initial context
      messageListener(
        { type: 'CM360_CONTEXT', data: { advertiserId: '90000' } },
        {},
        sendResponse,
      );
      // Navigate away — clears context
      tabUpdateListener(1, { url: 'https://www.google.com/' }, {});

      // New context arrives
      messageListener(
        { type: 'CM360_CONTEXT', data: { advertiserId: '99999', pageType: 'ads' } },
        {},
        sendResponse,
      );

      const getResponse = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, getResponse);

      expect(getResponse).toHaveBeenCalledWith({
        type: 'CONTEXT_RESPONSE',
        data: { advertiserId: '99999', pageType: 'ads' },
      });
    });

    it('clears badge on file:// URL navigation', () => {
      tabUpdateListener(1, { url: 'file:///Users/test/index.html' }, {});
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    });

    it('preserves badge for campaignmanager.google.com with hash', () => {
      tabUpdateListener(
        1,
        { url: 'https://campaignmanager.google.com/#/accounts/67890/profiles/12345' },
        {},
      );
      expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
    });

    it('preserves badge for campaignmanager.google.com with query params', () => {
      tabUpdateListener(
        1,
        { url: 'https://campaignmanager.google.com/accounts?filter=active' },
        {},
      );
      expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
    });

    it('clears badge for google.com (not campaignmanager subdomain)', () => {
      tabUpdateListener(1, { url: 'https://www.google.com/search?q=cm360' }, {});
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    });

    it('clears badge for ads.google.com', () => {
      tabUpdateListener(1, { url: 'https://ads.google.com/campaigns' }, {});
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    });

    it('handles different tab IDs', () => {
      tabUpdateListener(42, { url: 'https://www.example.com' }, {});
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    });

    it('does not clear context on CM360 URL update', () => {
      const sendResponse = vi.fn();
      messageListener(
        { type: 'CM360_CONTEXT', data: { advertiserId: '90000', pageType: 'ads' } },
        {},
        sendResponse,
      );

      // Navigate to another CM360 page
      tabUpdateListener(1, { url: 'https://campaignmanager.google.com/#/accounts/99999' }, {});

      // Context should still be available
      const getResponse = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, getResponse);
      expect(getResponse).toHaveBeenCalledWith({
        type: 'CONTEXT_RESPONSE',
        data: { advertiserId: '90000', pageType: 'ads' },
      });
    });
  });

  describe('listener registration', () => {
    it('registers exactly one message listener', () => {
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    });

    it('registers exactly one tab update listener', () => {
      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
    });

    it('message listener is a function', () => {
      expect(typeof messageListener).toBe('function');
    });

    it('tab update listener is a function', () => {
      expect(typeof tabUpdateListener).toBe('function');
    });
  });

  describe('context data integrity', () => {
    it('preserves all fields of stored context', () => {
      const sendResponse = vi.fn();
      const fullContext = {
        accountId: '67890',
        profileId: '12345',
        advertiserId: '90000',
        campaignId: '90014',
        pageType: 'placements',
      };
      messageListener(
        { type: 'CM360_CONTEXT', data: fullContext },
        {},
        sendResponse,
      );

      const getResponse = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, getResponse);

      const response = getResponse.mock.calls[0][0] as { data: typeof fullContext };
      expect(response.data.accountId).toBe('67890');
      expect(response.data.profileId).toBe('12345');
      expect(response.data.advertiserId).toBe('90000');
      expect(response.data.campaignId).toBe('90014');
      expect(response.data.pageType).toBe('placements');
    });

    it('stores context with only accountId', () => {
      const sendResponse = vi.fn();
      messageListener(
        { type: 'CM360_CONTEXT', data: { accountId: '67890' } },
        {},
        sendResponse,
      );

      const getResponse = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, getResponse);

      const response = getResponse.mock.calls[0][0] as { data: { accountId: string } };
      expect(response.data.accountId).toBe('67890');
    });

    it('stores context with empty object', () => {
      const sendResponse = vi.fn();
      messageListener(
        { type: 'CM360_CONTEXT', data: {} },
        {},
        sendResponse,
      );

      const getResponse = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, getResponse);

      expect(getResponse).toHaveBeenCalledWith({
        type: 'CONTEXT_RESPONSE',
        data: {},
      });
    });

    it('multiple GET_CONTEXT calls return same data', () => {
      const sendResponse = vi.fn();
      messageListener(
        { type: 'CM360_CONTEXT', data: { advertiserId: '90000' } },
        {},
        sendResponse,
      );

      const getResponse1 = vi.fn();
      const getResponse2 = vi.fn();
      const getResponse3 = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, getResponse1);
      messageListener({ type: 'GET_CONTEXT' }, {}, getResponse2);
      messageListener({ type: 'GET_CONTEXT' }, {}, getResponse3);

      expect(getResponse1.mock.calls[0][0]).toEqual(getResponse2.mock.calls[0][0]);
      expect(getResponse2.mock.calls[0][0]).toEqual(getResponse3.mock.calls[0][0]);
    });

    it('badge is always set with setBadgeText and setBadgeBackgroundColor together', () => {
      const sendResponse = vi.fn();
      messageListener(
        { type: 'CM360_CONTEXT', data: { pageType: 'ads' } },
        {},
        sendResponse,
      );

      expect(chrome.action.setBadgeText).toHaveBeenCalledTimes(1);
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledTimes(1);
    });

    it('badge color is always #16a34a (green)', () => {
      const sendResponse = vi.fn();

      messageListener(
        { type: 'CM360_CONTEXT', data: { pageType: 'ads' } },
        {},
        sendResponse,
      );
      messageListener(
        { type: 'CM360_CONTEXT', data: { pageType: 'placements' } },
        {},
        sendResponse,
      );
      messageListener(
        { type: 'CM360_CONTEXT', data: {} },
        {},
        sendResponse,
      );

      const calls = chrome.action.setBadgeBackgroundColor.mock.calls;
      for (const call of calls) {
        expect(call[0]).toEqual({ color: '#16a34a' });
      }
    });
  });

  describe('full lifecycle', () => {
    it('set → get → navigate away → get null → set new → get new', () => {
      const sr = vi.fn();

      // 1. Set initial context
      messageListener(
        { type: 'CM360_CONTEXT', data: { advertiserId: '11111', pageType: 'ads' } },
        {},
        sr,
      );

      // 2. Get returns it
      const get1 = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, get1);
      expect(get1.mock.calls[0][0].data.advertiserId).toBe('11111');

      // 3. Navigate away
      tabUpdateListener(1, { url: 'https://example.com' }, {});

      // 4. Get returns null
      const get2 = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, get2);
      expect(get2.mock.calls[0][0].data).toBeNull();

      // 5. New context arrives
      messageListener(
        { type: 'CM360_CONTEXT', data: { advertiserId: '22222', pageType: 'placements' } },
        {},
        sr,
      );

      // 6. Get returns new context
      const get3 = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, get3);
      expect(get3.mock.calls[0][0].data.advertiserId).toBe('22222');
      expect(get3.mock.calls[0][0].data.pageType).toBe('placements');
    });

    it('rapid context updates keep only the latest', () => {
      const sr = vi.fn();
      for (let i = 1; i <= 10; i++) {
        messageListener(
          { type: 'CM360_CONTEXT', data: { advertiserId: String(i), pageType: 'ads' } },
          {},
          sr,
        );
      }

      const getResponse = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, getResponse);
      expect(getResponse.mock.calls[0][0].data.advertiserId).toBe('10');
    });

    it('navigate away clears even after many context sets', () => {
      const sr = vi.fn();
      for (let i = 0; i < 5; i++) {
        messageListener(
          { type: 'CM360_CONTEXT', data: { advertiserId: String(i) } },
          {},
          sr,
        );
      }

      tabUpdateListener(1, { url: 'https://example.com' }, {});

      const getResponse = vi.fn();
      messageListener({ type: 'GET_CONTEXT' }, {}, getResponse);
      expect(getResponse.mock.calls[0][0].data).toBeNull();
    });
  });
});
