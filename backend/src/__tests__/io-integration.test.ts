import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileAttachment } from '@adtraffic/shared';

// Mock the usage tracker
vi.mock('../claude/usage-tracker.js', () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true }),
  recordUsage: vi.fn().mockResolvedValue(undefined),
}));

// Mock conversation store — getHistory must return a fresh array each call
// (chat() mutates the array in place, so a shared reference causes cross-test pollution)
vi.mock('../db/conversation-store.js', () => ({
  getHistory: vi.fn().mockImplementation(() => Promise.resolve([])),
  saveHistory: vi.fn().mockResolvedValue(undefined),
  saveMessage: vi.fn().mockResolvedValue(undefined),
  clearHistory: vi.fn().mockResolvedValue(undefined),
  getHistoryLength: vi.fn().mockResolvedValue(0),
}));

// Mock token manager
vi.mock('../cm360/token-manager.js', () => ({
  hasOAuthTokens: vi.fn().mockResolvedValue(false),
}));

// Mock io-parser
vi.mock('../io/io-parser.js', () => ({
  prepareIOContent: vi.fn().mockResolvedValue({
    contentBlocks: [{ type: 'text', text: '| Site | Size |\n| ESPN | 300x250 |' }],
    isPdf: false,
  }),
}));

// Track what the Anthropic SDK receives
const createMock = vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: '{"campaign":{"name":"Test"},"placements":[],"confidence":"high"}' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 100, output_tokens: 50 },
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock, stream: vi.fn() },
  })),
}));

vi.mock('../claude/anthropic-key-service.js', () => ({
  getDecryptedKey: vi.fn().mockResolvedValue('sk-ant-test-key'),
  NoAnthropicKeyError: class NoAnthropicKeyError extends Error {},
}));

describe('IO Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes attachment content blocks to Claude API', async () => {
    // Dynamic import after mocks are set up
    const { chat } = await import('../claude/kiki-service.js');
    const { prepareIOContent } = await import('../io/io-parser.js');

    const attachment: FileAttachment = {
      name: 'io.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: 'fakeBase64',
      sizeBytes: 1000,
    };

    await chat('conv-1', "Here's the Nike IO", undefined, undefined, attachment);

    // Verify prepareIOContent was called
    expect(prepareIOContent).toHaveBeenCalledWith(attachment);

    // Verify Claude received multimodal content
    expect(createMock).toHaveBeenCalled();
    const callArgs = createMock.mock.calls[0]![0] as { messages: Array<{ role: string; content: unknown }>; system: string; tools?: unknown };
    // User message is at index 0 (getHistory returns []), history is modified by reference after call
    const userMessage = callArgs.messages[0]!;
    expect(userMessage.role).toBe('user');
    // Content should be an array (multimodal), not a string
    expect(Array.isArray(userMessage.content)).toBe(true);
  });

  it('sends plain text when no attachment', async () => {
    const { chat } = await import('../claude/kiki-service.js');

    await chat('conv-2', 'List advertisers');

    expect(createMock).toHaveBeenCalled();
    const callArgs = createMock.mock.calls[0]![0] as { messages: Array<{ role: string; content: unknown }>; system: string; tools?: unknown };
    // User message is at index 0 (getHistory returns [])
    const userMessage = callArgs.messages[0]!;
    // Plain text — string content, not array
    expect(typeof userMessage.content).toBe('string');
  });

  it('uses extraction prompt when attachment present', async () => {
    const { chat } = await import('../claude/kiki-service.js');

    const attachment: FileAttachment = {
      name: 'io.pdf',
      type: 'application/pdf',
      data: 'fakeBase64',
      sizeBytes: 2000,
    };

    await chat('conv-3', 'Parse this IO', undefined, undefined, attachment);

    expect(createMock).toHaveBeenCalled();
    const callArgs = createMock.mock.calls[0]![0] as { messages: Array<{ role: string; content: unknown }>; system: string; tools?: unknown };
    // Should use extraction prompt (contains "TraffickingPlan")
    expect(callArgs.system).toContain('TraffickingPlan');
    // Should NOT include tools for extraction
    expect(callArgs.tools).toBeUndefined();
  });

  it('uses normal system prompt without attachment', async () => {
    const { chat } = await import('../claude/kiki-service.js');

    await chat('conv-4', 'List campaigns');

    expect(createMock).toHaveBeenCalled();
    const callArgs = createMock.mock.calls[0]![0] as { messages: Array<{ role: string; content: unknown }>; system: string; tools?: unknown };
    // Normal prompt should NOT contain TraffickingPlan schema
    expect(callArgs.system).not.toContain('TraffickingPlan');
    // Should include tools
    expect(callArgs.tools).toBeDefined();
  });
});
