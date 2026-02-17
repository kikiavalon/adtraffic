import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../cm360/tool-executor.js', () => ({
  executeTool: vi.fn().mockResolvedValue({ result: {}, isError: false }),
}));

// Mock Anthropic SDK before importing the service
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Mock Kiki response' }],
    role: 'assistant',
    stop_reason: 'end_turn',
  });

  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

vi.mock('../claude/usage-tracker.js', () => ({
  checkLimit: () => ({ allowed: true }),
  recordUsage: () => {},
  getUsageSummary: () => ({ date: '2026-01-01', requests: 0, limit: 999999, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: '$0.0000' }),
}));

import { chat, clearConversation, getConversationLength } from '../claude/kiki-service.js';
import Anthropic from '@anthropic-ai/sdk';

describe('kiki-service', () => {
  beforeEach(() => {
    clearConversation('test-conv');
    vi.clearAllMocks();
  });

  it('returns a ChatMessage with assistant role', async () => {
    const result = await chat('test-conv', 'Hello Kiki');
    expect(result.role).toBe('assistant');
    expect(result.content).toBe('Mock Kiki response');
    expect(result.id).toBeDefined();
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('maintains conversation history', async () => {
    await chat('test-conv', 'First message');
    expect(getConversationLength('test-conv')).toBe(2); // user + assistant

    await chat('test-conv', 'Second message');
    expect(getConversationLength('test-conv')).toBe(4); // 2 user + 2 assistant
  });

  it('keeps separate history per conversationId', async () => {
    await chat('conv-a', 'Hello from A');
    await chat('conv-b', 'Hello from B');

    expect(getConversationLength('conv-a')).toBe(2);
    expect(getConversationLength('conv-b')).toBe(2);

    clearConversation('conv-a');
    clearConversation('conv-b');
  });

  it('clears conversation history', async () => {
    await chat('test-conv', 'Hello');
    expect(getConversationLength('test-conv')).toBe(2);

    clearConversation('test-conv');
    expect(getConversationLength('test-conv')).toBe(0);
  });

  it('calls Claude with system prompt and tools', async () => {
    await chat('test-conv', 'List my campaigns');

    const mockInstance = new Anthropic();
    const mockCreate = vi.mocked(mockInstance.messages.create);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.stringMatching(/^claude-/),
        system: expect.stringContaining('Kiki'),
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'cm360_list_campaigns' }),
        ]),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'List my campaigns' }),
        ]),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('handles empty text response gracefully', async () => {
    const mockInstance = new Anthropic();
    const mockCreate = vi.mocked(mockInstance.messages.create);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreate.mockResolvedValueOnce({
      content: [],
      role: 'assistant',
      stop_reason: 'end_turn',
    } as any);

    const result = await chat('test-conv', 'Hello');
    expect(result.content).toBe('I need a moment to think about that.');
  });
});
