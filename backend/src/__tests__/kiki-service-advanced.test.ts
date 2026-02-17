/**
 * Advanced kiki-service tests — tool loop behavior, MAX_TOOL_ROUNDS limit,
 * multi-tool responses, and error recovery.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';

// Track tool executor calls
const toolExecutorCalls: Array<{ name: string; input: Record<string, unknown> }> = [];

vi.mock('../cm360/tool-executor.js', () => ({
  executeTool: vi.fn(async (name: string, input: Record<string, unknown>) => {
    toolExecutorCalls.push({ name, input });
    return { result: { mock: true }, isError: false };
  }),
}));

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock('../claude/usage-tracker.js', () => ({
  checkLimit: () => ({ allowed: true }),
  recordUsage: () => {},
  getUsageSummary: () => ({ date: '2026-01-01', requests: 0, limit: 999999, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: '$0.0000' }),
}));

import { chat, clearConversation, getConversationLength } from '../claude/kiki-service.js';

beforeEach(() => {
  clearConversation('adv-test');
  mockCreate.mockReset();
  toolExecutorCalls.length = 0;
});

describe('Tool loop behavior', () => {
  it('executes single tool call and returns final text', async () => {
    // First call: Claude uses a tool
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'tool_use', id: 'tool-1', name: 'cm360_list_profiles', input: {} },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });
    // Second call: Claude returns text
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Here are your profiles.' }],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    const result = await chat('adv-test', 'Show me profiles');
    expect(result.content).toBe('Here are your profiles.');
    expect(toolExecutorCalls).toHaveLength(1);
    expect(toolExecutorCalls[0]!.name).toBe('cm360_list_profiles');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('handles multiple sequential tool calls in one loop', async () => {
    // First call: Claude uses two tools
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'tool_use', id: 'tool-1', name: 'cm360_list_profiles', input: {} },
        { type: 'tool_use', id: 'tool-2', name: 'cm360_list_advertisers', input: { profileId: '12345' } },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });
    // Second call: Claude returns text
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Found 7 advertisers.' }],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    const result = await chat('adv-test', 'What advertisers exist?');
    expect(result.content).toBe('Found 7 advertisers.');
    expect(toolExecutorCalls).toHaveLength(2);
    expect(toolExecutorCalls[0]!.name).toBe('cm360_list_profiles');
    expect(toolExecutorCalls[1]!.name).toBe('cm360_list_advertisers');
  });

  it('chains multiple tool rounds', async () => {
    // Round 1: list profiles
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'tool_use', id: 'tool-1', name: 'cm360_list_profiles', input: {} },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });
    // Round 2: list advertisers
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'tool_use', id: 'tool-2', name: 'cm360_list_advertisers', input: { profileId: '12345' } },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });
    // Round 3: list campaigns
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'tool_use', id: 'tool-3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });
    // Final: text response
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Apex Motors has 3 campaigns.' }],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    const result = await chat('adv-test', 'How many campaigns does Apex Motors have?');
    expect(result.content).toBe('Apex Motors has 3 campaigns.');
    expect(toolExecutorCalls).toHaveLength(3);
    expect(mockCreate).toHaveBeenCalledTimes(4);
  });

  it('returns limit message when MAX_TOOL_ROUNDS (5) is exceeded', async () => {
    // Set up 5 tool_use responses (the maximum) without an end_turn
    for (let i = 0; i < 5; i++) {
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: `tool-${i}`, name: 'cm360_list_profiles', input: {} },
        ],
        role: 'assistant',
        stop_reason: 'tool_use',
      });
    }

    const result = await chat('adv-test', 'Do something complex');
    expect(result.content).toContain('limit');
    expect(result.content).toContain('rephrasing');
    expect(toolExecutorCalls).toHaveLength(5);
    expect(mockCreate).toHaveBeenCalledTimes(5);
  });

  it('includes text alongside tool_use blocks', async () => {
    // Claude sometimes returns text + tool_use together
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'Let me look that up...' },
        { type: 'tool_use', id: 'tool-1', name: 'cm360_list_profiles', input: {} },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Found your profiles.' }],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    const result = await chat('adv-test', 'Show profiles');
    expect(result.content).toBe('Found your profiles.');
    expect(toolExecutorCalls).toHaveLength(1);
  });
});

describe('Conversation history management', () => {
  it('accumulates history across multiple messages', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Reply' }],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    await chat('adv-test', 'Message 1');
    await chat('adv-test', 'Message 2');
    await chat('adv-test', 'Message 3');

    // 3 user + 3 assistant = 6
    expect(getConversationLength('adv-test')).toBe(6);
  });

  it('includes tool results in history for multi-round conversations', async () => {
    // Round 1: tool call
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'tool_use', id: 'tool-1', name: 'cm360_list_profiles', input: {} },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });
    // Round 2: final response
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Done.' }],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    await chat('adv-test', 'Show profiles');

    // History: user msg + assistant tool_use + user tool_result + assistant text = 4
    expect(getConversationLength('adv-test')).toBe(4);
  });

  it('clearConversation resets history to zero', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Reply' }],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    await chat('adv-test', 'Hello');
    expect(getConversationLength('adv-test')).toBe(2);

    clearConversation('adv-test');
    expect(getConversationLength('adv-test')).toBe(0);
  });
});

describe('Response extraction', () => {
  it('joins multiple text blocks with newline', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'First paragraph.' },
        { type: 'text', text: 'Second paragraph.' },
      ],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    const result = await chat('adv-test', 'Hello');
    expect(result.content).toBe('First paragraph.\nSecond paragraph.');
  });

  it('returns fallback text when response has no text blocks', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [],
      role: 'assistant',
      stop_reason: 'end_turn',
    } as unknown as Anthropic.Message);

    const result = await chat('adv-test', 'Hello');
    expect(result.content).toBe('I need a moment to think about that.');
  });

  it('returns unique IDs for each response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Reply' }],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    const r1 = await chat('adv-test', 'First');
    const r2 = await chat('adv-test', 'Second');
    expect(r1.id).not.toBe(r2.id);
  });

  it('returns current timestamp', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Reply' }],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    const before = Date.now();
    const result = await chat('adv-test', 'Hello');
    const after = Date.now();

    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });
});
