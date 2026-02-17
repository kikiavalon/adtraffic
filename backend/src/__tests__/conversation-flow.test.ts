/**
 * Multi-turn conversation flow tests.
 *
 * Tests that the tool maintains context across turns by running
 * multi-step conversation scenarios with scripted Claude responses.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import type { ToolCallRecord } from './harness/test-runner.js';
import { generateReport, evaluateResponse } from './harness/test-runner.js';
import type { MockResponse, TestPrompt } from './fixtures/test-prompts.js';
import { CONVERSATION_FLOWS } from './fixtures/conversation-flows.js';
import type { TestResult } from './harness/test-runner.js';

// ---------------------------------------------------------------------------
// Mock setup (same pattern as prompt-testing)
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
// Conversation flow tests
// ---------------------------------------------------------------------------

describe('Multi-turn conversation flows', () => {
  for (const flow of CONVERSATION_FLOWS) {
    describe(`[${flow.id}] ${flow.name}`, () => {
      const convId = `flow-${flow.id}`;

      beforeEach(() => {
        // Reset between flows but NOT between turns within a flow
        // (turns share conversation context)
      });

      // Reset at the start of each flow
      it('setup', () => {
        clearConversation(convId);
        mockCreate.mockReset();
        toolCallLog.length = 0;
        mockStore.reset();

        // Queue ALL mock responses for ALL turns in this flow
        for (const turn of flow.turns) {
          queueMockResponses(turn.mockResponses);
        }
      });

      // Run each turn sequentially
      for (let turnIdx = 0; turnIdx < flow.turns.length; turnIdx++) {
        const turn = flow.turns[turnIdx]!;

        it(`Turn ${turnIdx + 1}: ${turn.description}`, async () => {
          toolCallLog.length = 0;

          const response = await chat(convId, turn.userMessage);

          // Evaluate this turn's assertions
          const testPrompt: TestPrompt = {
            id: `${flow.id}-T${turnIdx + 1}`,
            prompt: turn.userMessage,
            category: 'conversation-flow' as never,
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

      // Cleanup after flow
      it('teardown', () => {
        clearConversation(convId);
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
