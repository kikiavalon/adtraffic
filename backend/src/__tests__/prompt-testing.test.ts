/**
 * Prompt-based regression tests.
 *
 * Runs all standard + adversarial test prompts through the mocked Kiki agentic
 * loop. Each test prompt defines the scripted Claude responses and assertions
 * against the final output.
 *
 * This test suite:
 * 1. Mocks the Anthropic SDK (returns scripted tool_use / text sequences)
 * 2. Uses the REAL tool executor + mock data store (no CM360 API calls)
 * 3. Verifies response text against assertions per prompt
 * 4. Records tool calls for analysis
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import type { ToolCallRecord } from './harness/test-runner.js';
import { evaluateResponse, generateReport } from './harness/test-runner.js';
import type { MockResponse } from './fixtures/test-prompts.js';
import { STANDARD_TEST_PROMPTS } from './fixtures/test-prompts.js';
import { ADVERSARIAL_TEST_PROMPTS } from './fixtures/adversarial-prompts.js';
import type { TestResult } from './harness/test-runner.js';

// ---------------------------------------------------------------------------
// Mock setup — intercept Anthropic SDK + track tool executor calls
// ---------------------------------------------------------------------------

const toolCallLog: ToolCallRecord[] = [];

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

// Bypass usage tracker limits in tests
vi.mock('../claude/usage-tracker.js', () => ({
  checkLimit: () => ({ allowed: true }),
  recordUsage: () => {},
  getUsageSummary: () => ({ date: '2026-01-01', requests: 0, limit: 999999, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: '$0.0000' }),
}));

// Spy on the real tool executor to record calls
const originalExecuteTool = vi.hoisted(() => ({ fn: null as unknown }));

vi.mock('../cm360/tool-executor.js', async (importOriginal) => {
  const mod = await importOriginal() as { executeTool: (name: string, input: Record<string, unknown>) => Promise<{ result: unknown; isError: boolean }> };
  originalExecuteTool.fn = mod.executeTool;
  return {
    executeTool: vi.fn(async (name: string, input: Record<string, unknown>) => {
      const realExecute = originalExecuteTool.fn as (name: string, input: Record<string, unknown>) => Promise<{ result: unknown; isError: boolean }>;
      const result = await realExecute(name, input);
      toolCallLog.push({
        toolName: name,
        toolInput: input,
        result: result.result,
        isError: result.isError,
      });
      return result;
    }),
  };
});

import { chat, clearConversation } from '../claude/kiki-service.js';
import { mockStore } from '../cm360/mock-data-store.js';

// Collect all results for the final report
const allResults: TestResult[] = [];

function setupMockSequence(responses: MockResponse[]): void {
  mockCreate.mockReset();

  for (const response of responses) {
    mockCreate.mockResolvedValueOnce({
      content: response.content,
      role: 'assistant',
      stop_reason: response.stop_reason,
    });
  }
}

// ---------------------------------------------------------------------------
// Standard prompt tests (34 prompts)
// ---------------------------------------------------------------------------

describe('Standard prompt tests', () => {
  beforeEach(() => {
    toolCallLog.length = 0;
    mockStore.reset();
  });

  for (const testPrompt of STANDARD_TEST_PROMPTS) {
    it(`[${testPrompt.id}] ${testPrompt.prompt.slice(0, 70)}`, async () => {
      const convId = `test-${testPrompt.id}`;
      clearConversation(convId);
      setupMockSequence(testPrompt.mockToolSequence);

      const response = await chat(convId, testPrompt.prompt);

      const result = evaluateResponse(response.content, [...toolCallLog], testPrompt);
      allResults.push(result);

      // Vitest assertions
      expect(result.status).not.toBe('fail');

      for (const ar of result.assertionResults) {
        expect(ar.passed, `[${testPrompt.id}] ${ar.assertion.description}: ${ar.detail}`).toBe(true);
      }

      clearConversation(convId);
    });
  }
});

// ---------------------------------------------------------------------------
// Adversarial prompt tests (14 prompts)
// ---------------------------------------------------------------------------

describe('Adversarial prompt tests', () => {
  beforeEach(() => {
    toolCallLog.length = 0;
    mockStore.reset();
  });

  for (const testPrompt of ADVERSARIAL_TEST_PROMPTS) {
    it(`[${testPrompt.id}] ${testPrompt.prompt.slice(0, 70)}`, async () => {
      const convId = `test-${testPrompt.id}`;
      clearConversation(convId);
      setupMockSequence(testPrompt.mockToolSequence);

      const response = await chat(convId, testPrompt.prompt);

      const result = evaluateResponse(response.content, [...toolCallLog], testPrompt);
      allResults.push(result);

      expect(result.status).not.toBe('fail');

      for (const ar of result.assertionResults) {
        expect(ar.passed, `[${testPrompt.id}] ${ar.assertion.description}: ${ar.detail}`).toBe(true);
      }

      clearConversation(convId);
    });
  }
});

// ---------------------------------------------------------------------------
// Print summary report after all tests
// ---------------------------------------------------------------------------

afterAll(() => {
  if (allResults.length > 0) {
    const report = generateReport(allResults);
    console.log('\n' + report);
  }
});
