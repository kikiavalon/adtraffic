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
  });
});
