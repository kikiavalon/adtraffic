import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mockCreate is available when vi.mock factory runs (vi.mock is hoisted)
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { chat, clearConversation } from '../claude/kiki-service.js';

describe('tool execution loop', () => {
  beforeEach(() => {
    clearConversation('test-loop');
    vi.clearAllMocks();
  });

  it('handles a single tool call round', async () => {
    // First call: Claude requests cm360_list_advertisers
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'cm360_list_advertisers',
          input: { profileId: '12345' },
        },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });

    // Second call: Claude produces text after receiving tool results
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'I found 3 advertisers: Toyota USA, Honda Motors, and BMW North America.',
        },
      ],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    const result = await chat('test-loop', 'List my advertisers');

    expect(result.content).toContain('3 advertisers');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('handles multiple tool calls in one response', async () => {
    // Claude requests two tools at once
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'cm360_list_advertisers',
          input: { profileId: '12345', searchString: 'toyota' },
        },
        {
          type: 'tool_use',
          id: 'tool_2',
          name: 'cm360_list_campaigns',
          input: { profileId: '12345', advertiserId: '100' },
        },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });

    // Claude responds with summary
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'Toyota USA has 2 active campaigns.',
        },
      ],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    const result = await chat('test-loop', 'Show me Toyota campaigns');

    expect(result.content).toContain('2 active campaigns');
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Verify the second call included tool_result blocks
    // Note: messages is a shared array reference, so we check the tool_result message
    // at index 2 (user, assistant(tool_use), user(tool_results), ...)
    const secondCall = mockCreate.mock.calls[1]![0] as { messages: Array<{ role: string; content: unknown }> };
    const toolResultMessage = secondCall.messages[2]!;
    expect(toolResultMessage.role).toBe('user');
    expect(toolResultMessage.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool_result', tool_use_id: 'tool_1' }),
        expect.objectContaining({ type: 'tool_result', tool_use_id: 'tool_2' }),
      ]),
    );
  });

  it('respects max tool rounds limit', async () => {
    // Mock Claude to always request tools (infinite loop scenario)
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_loop',
          name: 'cm360_list_profiles',
          input: {},
        },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });

    const result = await chat('test-loop', 'Keep going forever');

    expect(result.content).toContain('limit');
    // MAX_TOOL_ROUNDS is 5
    expect(mockCreate).toHaveBeenCalledTimes(5);
  });

  it('handles tool error gracefully', async () => {
    // Claude requests an unknown tool
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool_bad',
          name: 'cm360_nonexistent',
          input: {},
        },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });

    // Claude handles the error and responds
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'I encountered an error with that tool. Let me try a different approach.',
        },
      ],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    const result = await chat('test-loop', 'Do something impossible');

    expect(result.content).toContain('error');

    // Verify the error was passed as tool_result with is_error: true
    // Note: messages is a shared array reference, so we check the tool_result message
    // at index 2 (user, assistant(tool_use), user(tool_results), ...)
    const secondCall = mockCreate.mock.calls[1]![0] as { messages: Array<{ role: string; content: unknown }> };
    const toolResultMessage = secondCall.messages[2]!;
    expect(toolResultMessage.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool_result', tool_use_id: 'tool_bad', is_error: true }),
      ]),
    );
  });

  it('extracts text from mixed text+tool_use response on stop_reason tool_use', async () => {
    // Claude returns text AND a tool_use
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'Let me look up your advertisers.',
        },
        {
          type: 'tool_use',
          id: 'tool_mixed',
          name: 'cm360_list_advertisers',
          input: { profileId: '12345' },
        },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });

    // Final response
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'Here are your advertisers: Toyota, Honda, BMW.',
        },
      ],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    const result = await chat('test-loop', 'Who are my advertisers?');

    // Should get the final text, not the intermediate
    expect(result.content).toContain('Here are your advertisers');
  });
});
