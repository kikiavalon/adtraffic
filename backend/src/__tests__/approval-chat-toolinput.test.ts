/**
 * Regression: junior write submitted directly from chat must be executable
 * after senior approval.
 *
 * kiki-service routes junior users' write tools to the approval queue in both
 * chat() and chatStream(). The approvals route can only execute an approved
 * action if the stored payload carries the original toolInput — the
 * confirmations route already includes it (full StoredPendingAction), but the
 * chat paths built a payload without it, so junior-from-chat writes could be
 * approved yet never execute.
 *
 * Flow under test: junior sends a write request in chat → payload lands in
 * approval_queue with toolInput → senior approves via the API → the tool
 * executes with the original input.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

// Mock the Anthropic SDK — chat() uses messages.create, chatStream() uses messages.stream
const { mockCreate, streamFinalMessages } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  streamFinalMessages: [] as unknown[],
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: mockCreate,
      stream: vi.fn().mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          // No raw stream events — the loop reads finalMessage()
        },
        finalMessage: vi.fn().mockImplementation(() => Promise.resolve(streamFinalMessages.shift())),
      })),
    };
  },
}));

vi.mock('../claude/anthropic-key-service.js', () => ({
  getDecryptedKey: vi.fn().mockResolvedValue('sk-ant-test-key'),
  NoAnthropicKeyError: class NoAnthropicKeyError extends Error {},
}));

// Mock usage tracker — no daily limits in tests
vi.mock('../claude/usage-tracker.js', () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true }),
  checkDailyLimit: vi.fn().mockReturnValue({ allowed: true }),
  recordUsage: vi.fn().mockResolvedValue(undefined),
  getUsageSummary: vi.fn().mockReturnValue({
    requestsToday: 0,
    dailyLimit: 100,
    remaining: 100,
    estimatedCostToday: '$0.00',
  }),
}));

// Mock the tool executor — approving must execute the stored action.
// (Junior chat submissions never reach executeTool; only the approve route should.)
const mockExecuteTool = vi.fn();
vi.mock('../cm360/tool-executor.js', () => ({
  executeTool: (...args: unknown[]) => mockExecuteTool(...args),
}));

// Mock requireAuth — the approve call authenticates as a real senior user
// (approver_id has a FK to users, so the userId must exist in the DB).
const mockAuthUser = { userId: '', email: 'senior@example.com', role: 'senior' };
vi.mock('../auth/middleware.js', () => ({
  requireAuth: (req: { user?: typeof mockAuthUser }, _res: unknown, next: () => void) => {
    req.user = { ...mockAuthUser };
    next();
  },
}));

// Mock audit service to prevent fire-and-forget DB writes racing with cleanup
vi.mock('../audit/audit-service.js', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  getAuditLog: vi.fn().mockResolvedValue([]),
  hashIp: vi.fn().mockReturnValue('test-hash'),
  VALID_EVENT_TYPES: [],
}));

import app from '../index.js';
import { db, schema } from '../db/index.js';
import { chat, chatStream, clearConversation } from '../claude/kiki-service.js';
import type { StreamEvent } from '@adtraffic/shared';

let juniorUserId: string;
let seniorUserId: string;

const campaignInput = {
  advertiserId: '200',
  name: 'Apex_Q3_Display_2026',
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  defaultLandingPageId: '9001',
};

/** Anthropic response asking for a write tool, then a wrap-up text response. */
function writeToolThenText() {
  return [
    {
      content: [
        {
          type: 'tool_use',
          id: 'tool_regr_1',
          name: 'cm360_create_campaign',
          input: { ...campaignInput },
        },
      ],
      role: 'assistant',
      stop_reason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 5 },
    },
    {
      content: [{ type: 'text', text: 'Submitted for approval.' }],
      role: 'assistant',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    },
  ];
}

async function getQueuedApproval(requesterId: string) {
  const rows = await db.select().from(schema.approvalQueue)
    .where(eq(schema.approvalQueue.requesterId, requesterId));
  expect(rows).toHaveLength(1);
  const row = rows[0]!;
  return { row, payload: JSON.parse(row.actionPayload) as Record<string, unknown> };
}

beforeAll(async () => {
  const inserted = await db.insert(schema.users).values([
    {
      email: `junior-${crypto.randomUUID()}@test.adtraffic.ai`,
      passwordHash: 'x',
      name: 'Junior Regression',
      role: 'junior' as const,
    },
    {
      email: `senior-${crypto.randomUUID()}@test.adtraffic.ai`,
      passwordHash: 'x',
      name: 'Senior Regression',
      role: 'senior' as const,
    },
  ]).returning({ id: schema.users.id, role: schema.users.role });

  juniorUserId = inserted.find((u) => u.role === 'junior')!.id;
  seniorUserId = inserted.find((u) => u.role === 'senior')!.id;
  mockAuthUser.userId = seniorUserId;
});

afterAll(async () => {
  await db.delete(schema.approvalQueue).where(eq(schema.approvalQueue.requesterId, juniorUserId));
  for (const userId of [juniorUserId, seniorUserId]) {
    const convs = await db.select({ id: schema.conversations.id }).from(schema.conversations)
      .where(eq(schema.conversations.userId, userId));
    for (const conv of convs) {
      await db.delete(schema.conversations).where(eq(schema.conversations.id, conv.id));
    }
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  }
});

beforeEach(async () => {
  mockCreate.mockReset();
  mockExecuteTool.mockReset();
  streamFinalMessages.length = 0;
  await db.delete(schema.approvalQueue).where(eq(schema.approvalQueue.requesterId, juniorUserId));
});

describe('junior write from chat() → senior approve → tool executes', () => {
  const conversationId = 'conv-approval-regr-chat';

  it('stores the toolInput in the approval payload and executes it on approval', async () => {
    await clearConversation(conversationId);
    const [toolUseResponse, textResponse] = writeToolThenText();
    mockCreate.mockResolvedValueOnce(toolUseResponse).mockResolvedValueOnce(textResponse);

    // Junior submits the write from chat — routed to the approval queue
    await chat(conversationId, 'Create the Q3 campaign', juniorUserId, undefined, undefined, 'junior');
    expect(mockExecuteTool).not.toHaveBeenCalled();

    // The stored payload must carry the original tool input
    const { row, payload } = await getQueuedApproval(juniorUserId);
    expect(payload['toolName']).toBe('cm360_create_campaign');
    expect(payload['toolInput']).toEqual(campaignInput);

    // Senior approves — the tool must actually execute with the original input
    mockExecuteTool.mockResolvedValueOnce({ result: { id: '12345', name: campaignInput.name }, isError: false });
    const res = await request(app)
      .post(`/api/v1/approvals/${row.id}/approve`)
      .send({ note: 'Looks good' });

    expect(res.status).toBe(200);
    expect(res.body.isError).toBe(false);
    expect(res.body.errorMessage).toBeUndefined();
    expect(mockExecuteTool).toHaveBeenCalledWith(
      'cm360_create_campaign',
      campaignInput,
      juniorUserId,
      conversationId,
    );
  });
});

describe('junior write from chatStream() → senior approve → tool executes', () => {
  const conversationId = 'conv-approval-regr-stream';

  it('stores the toolInput in the approval payload and executes it on approval', async () => {
    await clearConversation(conversationId);
    // chatStream persists messages, so the conversation row must exist
    await db.insert(schema.conversations).values({
      id: conversationId,
      userId: juniorUserId,
      title: 'Approval regression (stream)',
    }).onConflictDoNothing();

    streamFinalMessages.push(...writeToolThenText());

    const events: StreamEvent[] = [];
    await chatStream(
      conversationId,
      'Create the Q3 campaign',
      (event) => events.push(event),
      new AbortController().signal,
      juniorUserId,
      undefined,
      undefined,
      'junior',
    );
    expect(mockExecuteTool).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === 'approval_submitted')).toBe(true);

    // The stored payload must carry the original tool input
    const { row, payload } = await getQueuedApproval(juniorUserId);
    expect(payload['toolName']).toBe('cm360_create_campaign');
    expect(payload['toolInput']).toEqual(campaignInput);

    // Senior approves — the tool must actually execute with the original input
    mockExecuteTool.mockResolvedValueOnce({ result: { id: '12345', name: campaignInput.name }, isError: false });
    const res = await request(app)
      .post(`/api/v1/approvals/${row.id}/approve`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.isError).toBe(false);
    expect(mockExecuteTool).toHaveBeenCalledWith(
      'cm360_create_campaign',
      campaignInput,
      juniorUserId,
      conversationId,
    );
  });
});
