import { describe, it, expect, vi, beforeEach } from 'vitest';

// Recognizable Anthropic constructor: returns an object carrying the apiKey it was built with.
const { AnthropicMock } = vi.hoisted(() => ({
  AnthropicMock: vi.fn().mockImplementation((opts: { apiKey: string }) => ({
    __apiKey: opts.apiKey,
    messages: {},
  })),
}));
vi.mock('@anthropic-ai/sdk', () => ({ default: AnthropicMock }));

// Controllable per-user key lookup + a real NoAnthropicKeyError class.
const { mockGetDecryptedKey } = vi.hoisted(() => ({ mockGetDecryptedKey: vi.fn() }));
vi.mock('../claude/anthropic-key-service.js', () => ({
  getDecryptedKey: mockGetDecryptedKey,
  NoAnthropicKeyError: class NoAnthropicKeyError extends Error {
    constructor() { super('no key'); this.name = 'NoAnthropicKeyError'; }
  },
}));

// kiki-service imports these at module load; mock to keep the import clean.
vi.mock('../cm360/tool-executor.js', () => ({
  executeTool: vi.fn().mockResolvedValue({ result: {}, isError: false }),
}));
vi.mock('../claude/usage-tracker.js', () => ({
  checkLimit: () => ({ allowed: true }),
  recordUsage: () => {},
  getUsageSummary: () => ({ date: '2026-01-01', requests: 0, limit: 999999, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: '$0.0000' }),
}));

import { getUserAnthropicClient } from '../claude/kiki-service.js';
import { NoAnthropicKeyError } from '../claude/anthropic-key-service.js';

describe('getUserAnthropicClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds an Anthropic client with the user\'s decrypted key', async () => {
    mockGetDecryptedKey.mockResolvedValue('sk-ant-test');

    const client = await getUserAnthropicClient('u1');

    expect(mockGetDecryptedKey).toHaveBeenCalledWith('u1');
    expect(AnthropicMock).toHaveBeenCalledWith({ apiKey: 'sk-ant-test' });
    expect((client as unknown as { __apiKey: string }).__apiKey).toBe('sk-ant-test');
  });

  it('rejects with NoAnthropicKeyError when the user has no key', async () => {
    mockGetDecryptedKey.mockResolvedValue(null);

    await expect(getUserAnthropicClient('u1')).rejects.toBeInstanceOf(NoAnthropicKeyError);
  });

  it('rejects with NoAnthropicKeyError when userId is undefined (empty lookup resolves no key)', async () => {
    mockGetDecryptedKey.mockResolvedValue(null);

    await expect(getUserAnthropicClient(undefined)).rejects.toBeInstanceOf(NoAnthropicKeyError);
    // An absent userId is consulted as an empty id, which resolves no row — so the
    // server-wide key never enters the chat path.
    expect(mockGetDecryptedKey).toHaveBeenCalledWith('');
  });
});
