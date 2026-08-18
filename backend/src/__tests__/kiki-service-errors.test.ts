/**
 * Kiki service error and timeout tests.
 *
 * Covers:
 * - Claude API timeout (AbortController + 30s deadline)
 * - Claude API rejection (network errors, rate limits)
 * - Usage limit enforcement (daily cap, per-round cap)
 * - History persistence on error (try/finally)
 * - Tool executor errors during agentic loop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../cm360/tool-executor.js', () => ({
  executeTool: vi.fn(async () => ({ result: { mock: true }, isError: false })),
}));

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock('../claude/anthropic-key-service.js', () => ({
  getDecryptedKey: vi.fn().mockResolvedValue('sk-ant-test-key'),
  NoAnthropicKeyError: class NoAnthropicKeyError extends Error {},
}));

// We need controllable usage-tracker mocks for limit tests
const mockCheckLimit = vi.fn().mockReturnValue({ allowed: true });
const mockRecordUsage = vi.fn();

vi.mock('../claude/usage-tracker.js', () => ({
  checkLimit: (...args: unknown[]) => mockCheckLimit(...args),
  recordUsage: (...args: unknown[]) => mockRecordUsage(...args),
  getUsageSummary: () => ({ date: '2026-02-18', requests: 0, limit: 100, inputTokens: 0, outputTokens: 0, estimatedCost: '$0.00' }),
}));

import { chat, clearConversation, getConversationLength } from '../claude/kiki-service.js';
import { executeTool } from '../cm360/tool-executor.js';

beforeEach(async () => {
  await clearConversation('error-test');
  mockCreate.mockReset();
  mockCheckLimit.mockReturnValue({ allowed: true });
  mockRecordUsage.mockReset();
  vi.mocked(executeTool).mockReset();
  vi.mocked(executeTool).mockResolvedValue({ result: { mock: true }, isError: false });
});

describe('Claude API timeout', () => {
  it('propagates AbortError when Claude API times out', async () => {
    mockCreate.mockImplementation(() => {
      return new Promise((_resolve, reject) => {
        // Simulate AbortController.abort() after timeout
        const error = new DOMException('The operation was aborted.', 'AbortError');
        setTimeout(() => reject(error), 10);
      });
    });

    await expect(chat('error-test', 'Hello')).rejects.toThrow();
  });

  it('persists history even when Claude API throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Connection reset'));

    try {
      await chat('error-test', 'Hello');
    } catch {
      // Expected to throw
    }

    // The user message should still be in history (try/finally guarantees saveHistory)
    expect(await getConversationLength('error-test')).toBeGreaterThanOrEqual(1);
  });
});

describe('Claude API errors', () => {
  it('throws on network error after retry exhaustion', async () => {
    // ECONNREFUSED is retryable — must reject enough times to exhaust retries (initial + 2 retries = 3)
    mockCreate.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(chat('error-test', 'Hello')).rejects.toThrow('ECONNREFUSED');
  });

  it('throws on rate limit error from Anthropic after retry exhaustion', async () => {
    const rateLimitError = new Error('429 Too Many Requests');
    (rateLimitError as any).status = 429;
    // 429 is retryable — must reject persistently to exhaust retries
    mockCreate.mockRejectedValue(rateLimitError);

    await expect(chat('error-test', 'Hello')).rejects.toThrow('429');
  });

  it('throws on authentication error from Anthropic without retrying', async () => {
    const authError = new Error('401 Unauthorized: Invalid API key');
    (authError as any).status = 401;
    // 401 is NOT retryable — single rejection is sufficient
    mockCreate.mockRejectedValueOnce(authError);

    await expect(chat('error-test', 'test')).rejects.toThrow('401');
  });
});

describe('Usage limit enforcement', () => {
  it('returns limit message without calling Claude when daily limit reached', async () => {
    mockCheckLimit.mockReturnValue({
      allowed: false,
      message: 'Daily API limit reached (100/100 requests). Resets at midnight UTC.',
    });

    const result = await chat('error-test', 'Hello');

    expect(result.role).toBe('assistant');
    expect(result.content).toContain('Daily API limit');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns limit message mid-loop when limit is hit during tool rounds', async () => {
    // checkLimit is called twice per loop round:
    //   1. Initial check before the while loop (line 28) — allowed
    //   2. Round 1 check inside the while loop (line 47) — allowed
    //   → Claude API call succeeds with tool_use
    //   3. Round 2 check inside the while loop (line 47) — denied
    let callCount = 0;
    mockCheckLimit.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: 'Daily API limit reached mid-loop.',
      };
    });

    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'tool_use', id: 'tool-1', name: 'cm360_list_profiles', input: {} },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await chat('error-test', 'Hello');

    expect(result.content).toContain('Daily API limit');
    // 1 Claude API call was made in round 1 before limit hit in round 2
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('records usage tokens after successful API call', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hello!' }],
      role: 'assistant',
      stop_reason: 'end_turn',
      usage: { input_tokens: 150, output_tokens: 50 },
    });

    await chat('error-test', 'Hi');

    expect(mockRecordUsage).toHaveBeenCalledWith(
      expect.any(String), // model name
      150,
      50,
    );
  });
});

describe('Tool executor errors during agentic loop', () => {
  it('includes error results in history when tool executor fails', async () => {
    vi.mocked(executeTool).mockResolvedValueOnce({
      result: { error: 'Tool failed: unknown tool' },
      isError: true,
    });

    // Claude calls a tool
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'tool_use', id: 'tool-1', name: 'unknown_tool', input: {} },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });
    // Claude processes the error and responds
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'That tool is not available.' }],
      role: 'assistant',
      stop_reason: 'end_turn',
    });

    const result = await chat('error-test', 'Use unknown tool');

    expect(result.content).toBe('That tool is not available.');
    // History should include: user + assistant(tool_use) + user(tool_result) + assistant(text) = 4
    expect(await getConversationLength('error-test')).toBe(4);
  });

  it('propagates when tool executor throws unexpectedly', async () => {
    vi.mocked(executeTool).mockRejectedValueOnce(new Error('Executor crash'));

    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'tool_use', id: 'tool-1', name: 'cm360_list_profiles', input: {} },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
    });

    await expect(chat('error-test', 'Test')).rejects.toThrow('Executor crash');

    // History should still be persisted (try/finally)
    expect(await getConversationLength('error-test')).toBeGreaterThanOrEqual(1);
  });
});
