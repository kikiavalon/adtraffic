/**
 * Video trafficking tests — validates that Kiki can recommend tag types
 * (VAST, VPAID, JS, iframe), handle vendor spec documents, confirm tag types
 * with users, and set up video placements correctly.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import type { ToolCallRecord } from './harness/test-runner.js';
import { evaluateResponse, generateReport } from './harness/test-runner.js';
import type { TestPrompt, MockResponse } from './fixtures/test-prompts.js';
import { VIDEO_TRAFFICKING_PROMPTS } from './fixtures/video-trafficking-prompts.js';
import { VIDEO_TRAFFICKING_FLOWS } from './fixtures/video-trafficking-flows.js';
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
// Video trafficking single-turn tests (30 prompts)
// ---------------------------------------------------------------------------

describe('Video trafficking prompt tests', () => {
  beforeEach(() => {
    toolCallLog.length = 0;
    mockStore.reset();
  });

  for (const testPrompt of VIDEO_TRAFFICKING_PROMPTS) {
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
// Video trafficking multi-turn flows (5 flows, ~18 turns)
// ---------------------------------------------------------------------------

describe('Video trafficking conversation flows', () => {
  for (const flow of VIDEO_TRAFFICKING_FLOWS) {
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
            category: 'video-trafficking',
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
