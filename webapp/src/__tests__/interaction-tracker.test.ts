import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  trackInteraction,
  flushInteractions,
  setAuthFetch,
  getBufferSize,
  resetTracker,
} from '../utils/interaction-tracker.js';

describe('interaction-tracker', () => {
  beforeEach(() => {
    resetTracker();
  });

  describe('trackInteraction', () => {
    it('adds events to buffer (verify via getBufferSize)', () => {
      expect(getBufferSize()).toBe(0);
      trackInteraction('message_sent', { conversationId: 'conv-1', messageLength: 42 });
      expect(getBufferSize()).toBe(1);
      trackInteraction('button_clicked', { buttonLabel: 'Create campaign' });
      expect(getBufferSize()).toBe(2);
    });

    it('tracks a single event and increments buffer size', () => {
      const metadata = { conversationId: 'conv-abc', messageLength: 100 };
      trackInteraction('message_sent', metadata);
      expect(getBufferSize()).toBe(1);
    });
  });

  describe('flushInteractions', () => {
    it('sends buffered events via authFetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
      setAuthFetch(mockFetch);

      trackInteraction('message_sent', { conversationId: 'conv-1' });
      trackInteraction('confirmation_approved', { actionId: 'act-1' });
      flushInteractions();

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/v1/audit/interactions');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' });

      const body = JSON.parse(options.body as string) as { events: Array<{ eventType: string; metadata: Record<string, unknown>; timestamp: number }> };
      expect(body.events).toHaveLength(2);
      expect(body.events[0]!.eventType).toBe('message_sent');
      expect(body.events[0]!.metadata).toEqual({ conversationId: 'conv-1' });
      expect(body.events[1]!.eventType).toBe('confirmation_approved');
      expect(body.events[1]!.metadata).toEqual({ actionId: 'act-1' });
    });

    it('clears buffer after flush', () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
      setAuthFetch(mockFetch);

      trackInteraction('session_started', { conversationId: 'conv-1' });
      expect(getBufferSize()).toBe(1);

      flushInteractions();
      expect(getBufferSize()).toBe(0);
    });

    it('is a no-op when buffer is empty', () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
      setAuthFetch(mockFetch);

      flushInteractions();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not flush when authFetch is not registered (keeps events buffered)', () => {
      trackInteraction('message_sent', { conversationId: 'conv-1' });
      expect(getBufferSize()).toBe(1);

      flushInteractions();
      // Events should still be buffered since no authFetch registered
      expect(getBufferSize()).toBe(1);
    });

    it('batches multiple events into a single POST', () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
      setAuthFetch(mockFetch);

      trackInteraction('message_sent', { conversationId: 'conv-1' });
      trackInteraction('button_clicked', { buttonLabel: 'Option A' });
      trackInteraction('confirmation_approved', { actionId: 'act-1' });
      flushInteractions();

      expect(mockFetch).toHaveBeenCalledOnce();
      const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string) as { events: unknown[] };
      expect(body.events).toHaveLength(3);
    });

    it('is fire-and-forget (does not throw when authFetch rejects)', () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
      setAuthFetch(mockFetch);

      trackInteraction('message_sent', { conversationId: 'conv-1' });

      // Should not throw
      expect(() => flushInteractions()).not.toThrow();
    });

    it('includes timestamp on each event', () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
      setAuthFetch(mockFetch);

      const before = Date.now();
      trackInteraction('session_started', {});
      const after = Date.now();

      flushInteractions();

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string) as { events: Array<{ timestamp: number }> };
      expect(body.events[0]!.timestamp).toBeGreaterThanOrEqual(before);
      expect(body.events[0]!.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('resetTracker', () => {
    it('clears buffer and authFetch reference', () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
      setAuthFetch(mockFetch);
      trackInteraction('message_sent', {});
      expect(getBufferSize()).toBe(1);

      resetTracker();
      expect(getBufferSize()).toBe(0);

      // authFetch was cleared, so flush should not call it
      trackInteraction('button_clicked', { label: 'test' });
      flushInteractions();
      expect(mockFetch).not.toHaveBeenCalled();
      // Events still buffered
      expect(getBufferSize()).toBe(1);
    });
  });

  describe('setAuthFetch', () => {
    it('allows replacing the authFetch function', () => {
      const mockFetch1 = vi.fn().mockResolvedValue(new Response('ok'));
      const mockFetch2 = vi.fn().mockResolvedValue(new Response('ok'));

      setAuthFetch(mockFetch1);
      trackInteraction('message_sent', {});
      flushInteractions();
      expect(mockFetch1).toHaveBeenCalledOnce();

      setAuthFetch(mockFetch2);
      trackInteraction('button_clicked', {});
      flushInteractions();
      expect(mockFetch2).toHaveBeenCalledOnce();
    });
  });
});
