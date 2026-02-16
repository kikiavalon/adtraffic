/**
 * Clarifying questions tests — validates that Kiki asks targeted questions
 * when user requests are ambiguous or incomplete before proceeding.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import type { ToolCallRecord } from './harness/test-runner.js';
import { evaluateResponse, generateReport } from './harness/test-runner.js';
import type { TestPrompt, MockResponse } from './fixtures/test-prompts.js';
import { CLARIFYING_QUESTION_PROMPTS } from './fixtures/clarifying-questions-prompts.js';
import { CLARIFYING_QUESTION_FLOWS } from './fixtures/clarifying-questions-flows.js';
import type { TestResult } from './harness/test-runner.js';

// ---------------------------------------------------------------------------
// Mock setup — intercept Anthropic SDK + track tool executor calls
// ---------------------------------------------------------------------------

let mockResponseQueue: MockResponse[] = [];
const toolCallLog: ToolCallRecord[] = [];

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
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
  mockResponseQueue = [...responses];
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
// Clarifying questions single-turn tests (35 prompts)
// ---------------------------------------------------------------------------

describe('Clarifying questions prompt tests', () => {
  beforeEach(() => {
    toolCallLog.length = 0;
    mockStore.reset();
  });

  for (const testPrompt of CLARIFYING_QUESTION_PROMPTS) {
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
// Clarifying questions multi-turn flows (5 flows, 15 turns)
// ---------------------------------------------------------------------------

describe('Clarifying questions conversation flows', () => {
  for (const flow of CLARIFYING_QUESTION_FLOWS) {
    describe(`[${flow.id}] ${flow.name}`, () => {
      const convId = `flow-${flow.id}`;

      it('setup', () => {
        clearConversation(convId);
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
            category: 'clarifying-questions',
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
