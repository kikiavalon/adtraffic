/**
 * Teaching mode tests — validates that Kiki can teach CM360 concepts,
 * explain workflows, and use real account data as teaching examples.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import type { ToolCallRecord } from './harness/test-runner.js';
import { evaluateResponse, generateReport } from './harness/test-runner.js';
import type { TestPrompt, MockResponse } from './fixtures/test-prompts.js';
import { TEACHING_MODE_PROMPTS } from './fixtures/teaching-mode-prompts.js';
import { TEACHING_MODE_FLOWS } from './fixtures/teaching-mode-flows.js';
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

vi.mock('../claude/anthropic-key-service.js', () => ({
  getDecryptedKey: vi.fn().mockResolvedValue('sk-ant-test-key'),
  NoAnthropicKeyError: class NoAnthropicKeyError extends Error {},
}));

vi.mock('../claude/usage-tracker.js', () => ({
  checkLimit: () => ({ allowed: true }),
  recordUsage: () => {},
  getUsageSummary: () => ({ date: '2026-01-01', requests: 0, limit: 999999, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: '$0.0000' }),
}));

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

function queueMockResponses(responses: MockResponse[]): void {
  for (const response of responses) {
    mockCreate.mockResolvedValueOnce({
      content: response.content,
      role: 'assistant',
      stop_reason: response.stop_reason,
    });
  }
}

// ---------------------------------------------------------------------------
// Teaching mode single-turn tests (40 prompts)
// ---------------------------------------------------------------------------

describe('Teaching mode prompt tests', () => {
  beforeEach(() => {
    toolCallLog.length = 0;
    mockStore.reset();
  });

  for (const testPrompt of TEACHING_MODE_PROMPTS) {
    it(`[${testPrompt.id}] ${testPrompt.prompt.slice(0, 70)}`, async () => {
      const convId = `test-${testPrompt.id}`;
      await clearConversation(convId);
      setupMockSequence(testPrompt.mockToolSequence);

      const response = await chat(convId, testPrompt.prompt);

      const result = evaluateResponse(response.content, [...toolCallLog], testPrompt);
      allResults.push(result);

      expect(result.status).not.toBe('fail');

      for (const ar of result.assertionResults) {
        expect(ar.passed, `[${testPrompt.id}] ${ar.assertion.description}: ${ar.detail}`).toBe(true);
      }

      await clearConversation(convId);
    });
  }
});

// ---------------------------------------------------------------------------
// Teaching mode multi-turn flows (4 flows, 12 turns)
// ---------------------------------------------------------------------------

describe('Teaching mode conversation flows', () => {
  for (const flow of TEACHING_MODE_FLOWS) {
    describe(`[${flow.id}] ${flow.name}`, () => {
      const convId = `flow-${flow.id}`;

      it('setup', async () => {
        await clearConversation(convId);
        mockCreate.mockReset();
        toolCallLog.length = 0;
        mockStore.reset();

        for (const turn of flow.turns) {
          queueMockResponses(turn.mockResponses);
        }
      });

      for (let turnIdx = 0; turnIdx < flow.turns.length; turnIdx++) {
        const turn = flow.turns[turnIdx]!;

        it(`Turn ${turnIdx + 1}: ${turn.description}`, async () => {
          toolCallLog.length = 0;

          const response = await chat(convId, turn.userMessage);

          const testPrompt: TestPrompt = {
            id: `${flow.id}-T${turnIdx + 1}`,
            prompt: turn.userMessage,
            category: 'teaching-mode',
            expectedTools: [],
            expectedBehavior: turn.description,
            mockToolSequence: turn.mockResponses,
            responseAssertions: turn.responseAssertions,
          };

          const result = evaluateResponse(response.content, [...toolCallLog], testPrompt);
          allResults.push(result);

          expect(result.status, `[${flow.id} Turn ${turnIdx + 1}] ${turn.description}`).not.toBe('fail');

          for (const ar of result.assertionResults) {
            expect(ar.passed, `[${flow.id} T${turnIdx + 1}] ${ar.assertion.description}: ${ar.detail}`).toBe(true);
          }
        });
      }

      it('teardown', async () => {
        await clearConversation(convId);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Summary report
// ---------------------------------------------------------------------------

afterAll(() => {
  if (allResults.length > 0) {
    const report = generateReport(allResults);
    console.log('\n' + report);
  }
});
