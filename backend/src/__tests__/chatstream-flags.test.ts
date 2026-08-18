/**
 * Tests for chatStream() feature flag enforcement.
 * Verifies that chatStream() respects tool gating and chat.enabled
 * the same way that chat() does.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock usage-tracker to avoid daily limit issues in tests
vi.mock('../claude/usage-tracker.js', () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true }),
  recordUsage: vi.fn().mockResolvedValue(undefined),
}));

// Mock conversation store
vi.mock('../db/conversation-store.js', () => ({
  getHistory: vi.fn().mockResolvedValue([]),
  saveHistory: vi.fn().mockResolvedValue(undefined),
  saveMessage: vi.fn().mockResolvedValue(undefined),
  clearHistory: vi.fn().mockResolvedValue(undefined),
  getHistoryLength: vi.fn().mockResolvedValue(0),
}));

// Mock token manager
vi.mock('../cm360/token-manager.js', () => ({
  hasOAuthTokens: vi.fn().mockResolvedValue(false),
}));

// Capture what tools are passed to anthropic.messages.stream
let capturedStreamArgs: any = null;
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        stream: vi.fn().mockImplementation((args: any) => {
          capturedStreamArgs = args;
          // Return an async iterable that immediately ends
          return {
            [Symbol.asyncIterator]: async function* () {
              // No events — stream completes immediately
            },
            finalMessage: vi.fn().mockResolvedValue({
              id: 'msg_test',
              type: 'message',
              role: 'assistant',
              content: [{ type: 'text', text: 'Test response' }],
              model: 'claude-haiku-4-5-20251001',
              stop_reason: 'end_turn',
              usage: { input_tokens: 10, output_tokens: 5 },
            }),
          };
        }),
      };
    },
  };
});

import { chatStream } from '../claude/kiki-service.js';
import { CM360_TOOLS, getEnabledTools } from '../claude/tool-definitions.js';
import { getDefaultFlags } from '../feature-flags/flag-registry.js';
import type { StreamEvent } from '@adtraffic/shared';

describe('chatStream feature flag enforcement', () => {
  let emittedEvents: StreamEvent[];
  const emit = (event: StreamEvent) => { emittedEvents.push(event); };
  const signal = new AbortController().signal;

  beforeEach(() => {
    emittedEvents = [];
    capturedStreamArgs = null;
  });

  describe('tool gating', () => {
    it('uses all tools when all flags are true', async () => {
      const flags = getDefaultFlags();

      await chatStream('conv-1', 'hello', emit, signal, undefined, flags);

      expect(capturedStreamArgs).not.toBeNull();
      expect(capturedStreamArgs.tools).toHaveLength(CM360_TOOLS.length);
    });

    it('excludes write tools when cm360.write_operations is false', async () => {
      const flags = getDefaultFlags();
      flags['cm360.write_operations'] = false;
      const expectedTools = getEnabledTools(flags);

      await chatStream('conv-2', 'hello', emit, signal, undefined, flags);

      expect(capturedStreamArgs).not.toBeNull();
      expect(capturedStreamArgs.tools).toHaveLength(expectedTools.length);
      // Verify no write tools are present
      const toolNames = capturedStreamArgs.tools.map((t: any) => t.name);
      expect(toolNames).not.toContain('cm360_create_campaign');
      expect(toolNames).not.toContain('cm360_update_campaign');
    });

    it('excludes read tools when cm360.read_operations is false', async () => {
      const flags = getDefaultFlags();
      flags['cm360.read_operations'] = false;
      const expectedTools = getEnabledTools(flags);

      await chatStream('conv-3', 'hello', emit, signal, undefined, flags);

      expect(capturedStreamArgs).not.toBeNull();
      expect(capturedStreamArgs.tools).toHaveLength(expectedTools.length);
      const toolNames = capturedStreamArgs.tools.map((t: any) => t.name);
      expect(toolNames).not.toContain('cm360_list_campaigns');
    });

    it('excludes tag tools when cm360.tag_generation is false', async () => {
      const flags = getDefaultFlags();
      flags['cm360.tag_generation'] = false;
      const expectedTools = getEnabledTools(flags);

      await chatStream('conv-4', 'hello', emit, signal, undefined, flags);

      expect(capturedStreamArgs).not.toBeNull();
      expect(capturedStreamArgs.tools).toHaveLength(expectedTools.length);
      const toolNames = capturedStreamArgs.tools.map((t: any) => t.name);
      expect(toolNames).not.toContain('cm360_generate_tags');
    });

    it('uses full tool set when no flags provided (backwards compat)', async () => {
      await chatStream('conv-5', 'hello', emit, signal);

      expect(capturedStreamArgs).not.toBeNull();
      expect(capturedStreamArgs.tools).toHaveLength(CM360_TOOLS.length);
    });
  });

  describe('chat.enabled flag', () => {
    it('returns disabled message when chat.enabled is false', async () => {
      const flags = getDefaultFlags();
      flags['chat.enabled'] = false;

      await chatStream('conv-6', 'hello', emit, signal, undefined, flags);

      // Should NOT call Claude API at all
      expect(capturedStreamArgs).toBeNull();

      // Should emit a message telling the user chat is disabled
      const messageEnd = emittedEvents.find((e) => e.type === 'message_end');
      expect(messageEnd).toBeDefined();
      expect((messageEnd as any).message.content).toContain('disabled');
    });

    it('proceeds normally when chat.enabled is true', async () => {
      const flags = getDefaultFlags();
      // chat.enabled defaults to true

      await chatStream('conv-7', 'hello', emit, signal, undefined, flags);

      // Should call Claude API
      expect(capturedStreamArgs).not.toBeNull();
    });
  });
});
