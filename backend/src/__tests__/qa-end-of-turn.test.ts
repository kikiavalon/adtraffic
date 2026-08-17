import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mockCreate/mockStream are available when vi.mock factory runs
const { mockCreate, mockStream } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockStream: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate, stream: mockStream },
  })),
}));

vi.mock('../claude/usage-tracker.js', () => ({
  checkLimit: () => ({ allowed: true }),
  recordUsage: () => {},
  getUsageSummary: () => ({ date: '2026-01-01', requests: 0, limit: 999999, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: '$0.0000' }),
}));

// Mock conversation store — saveMessage requires a conversations row (FK) that the
// chat route normally creates; QA persistence goes through qa-store, not this module.
vi.mock('../db/conversation-store.js', () => ({
  getHistory: vi.fn().mockResolvedValue([]),
  saveHistory: vi.fn().mockResolvedValue(undefined),
  saveMessage: vi.fn().mockResolvedValue(undefined),
  clearHistory: vi.fn().mockResolvedValue(undefined),
  getHistoryLength: vi.fn().mockResolvedValue(0),
}));

vi.mock('../cm360/token-manager.js', () => ({
  hasOAuthTokens: vi.fn().mockResolvedValue(false),
}));

import { randomUUID } from 'crypto';
import { db, schema } from '../db/index.js';
import { chatStream } from '../claude/kiki-service.js';
import { recordQaWrite, drainQaWrites } from '../qa/qa-recorder.js';
import { mockStore } from '../cm360/mock-data-store.js';
import { getDefaultFlags } from '../feature-flags/flag-registry.js';
import type { StreamEvent } from '@adtraffic/shared';

/** Build a mock streaming response yielding a plain text message (no tool_use). */
function mockTextStream(text: string) {
  mockStream.mockReturnValueOnce({
    async *[Symbol.asyncIterator]() {
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text },
      };
    },
    finalMessage: () =>
      Promise.resolve({
        content: [{ type: 'text', text }],
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
  });
}

describe('end-of-turn Trafficking QA trigger', () => {
  // No table cleanup here: every test uses freshly-generated user/conversation ids
  // and asserts only on emitted events, and qa-service fires its audit events
  // fire-and-forget (void logAuditEvent) — deleting users between tests races
  // those in-flight audit_logs inserts into an FK violation.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits qa_report before message_end when the turn recorded writes and qa.enabled is on', async () => {
    const userId = randomUUID();
    await db.insert(schema.users).values({
      id: userId, email: `${userId}@test.com`, passwordHash: 'h', name: 'QA',
      createdAt: new Date(), updatedAt: new Date(),
    });
    const conversationId = `conv-${randomUUID()}`;
    const ad = mockStore.listAds()[0]!;
    recordQaWrite(conversationId, {
      toolName: 'cm360_update_ad', toolInput: { profileId: 'p', adId: ad.id }, result: ad, recordedAt: Date.now(),
    });

    mockTextStream('done!');
    const events: StreamEvent[] = [];
    await chatStream(
      conversationId, 'done, thanks', (e) => events.push(e), new AbortController().signal,
      userId, { ...getDefaultFlags(), 'qa.enabled': true },
    );

    const types = events.map((e) => e.type);
    expect(types).toContain('qa_report');
    expect(types.indexOf('qa_report')).toBeLessThan(types.indexOf('message_end'));
    const qaEvent = events.find((e) => e.type === 'qa_report');
    expect(qaEvent && 'report' in qaEvent && qaEvent.report.advisory).toBe(true);
  });

  it('emits no qa_report when nothing was written', async () => {
    mockTextStream('hello there');
    const events: StreamEvent[] = [];
    await chatStream(
      `conv-${randomUUID()}`, 'hello', (e) => events.push(e), new AbortController().signal,
      undefined, { ...getDefaultFlags(), 'qa.enabled': true },
    );
    expect(events.map((e) => e.type)).not.toContain('qa_report');
  });

  it('discards unconsumed recorded writes when the turn ends without a QA run', async () => {
    // No userId → maybeRunTurnQa never calls runTurnQa, so only the finally-drain
    // can clear the recorder. Without it, a later unrelated turn on this replica
    // would inherit (misattribute) these writes.
    const conversationId = `conv-${randomUUID()}`;
    recordQaWrite(conversationId, { toolName: 'cm360_update_ad', toolInput: { profileId: 'p', adId: '1' }, result: null, recordedAt: Date.now() });
    mockTextStream('hi!');
    await chatStream(conversationId, 'hi', () => {}, new AbortController().signal, undefined, getDefaultFlags());
    expect(drainQaWrites(conversationId)).toEqual([]);
  });
});
