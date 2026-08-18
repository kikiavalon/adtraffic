import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock requireAuth middleware — inject test user
vi.mock('../auth/middleware.js', () => ({
  requireAuth: (req: { user?: { userId: string; email: string } }, _res: unknown, next: () => void) => {
    req.user = { userId: 'test-user-id', email: 'test@example.com' };
    next();
  },
}));

// Mock pending-actions store
const mockConsumePendingAction = vi.fn();
const mockGetPendingAction = vi.fn();
vi.mock('../cm360/pending-actions.js', () => ({
  consumePendingAction: (...args: unknown[]) => mockConsumePendingAction(...args),
  getPendingAction: (...args: unknown[]) => mockGetPendingAction(...args),
}));

// Mock tool executor
const mockExecuteTool = vi.fn();
vi.mock('../cm360/tool-executor.js', () => ({
  executeTool: (...args: unknown[]) => mockExecuteTool(...args),
}));

// Mock Trafficking QA service
const mockRunTurnQa = vi.fn();
vi.mock('../qa/qa-service.js', () => ({
  runTurnQa: (...args: unknown[]) => mockRunTurnQa(...args),
}));

// Mock flag service (other named exports required by routes/feature-flags.ts)
const mockResolveFlags = vi.fn();
vi.mock('../feature-flags/flag-service.js', () => ({
  resolveFlags: (...args: unknown[]) => mockResolveFlags(...args),
  setFlagOverride: vi.fn(),
  clearFlagOverride: vi.fn(),
  isValidFlagName: vi.fn().mockReturnValue(true),
  isBooleanFlag: vi.fn().mockReturnValue(true),
}));

// Mock DB (required by index.ts)
vi.mock('../db/index.js', () => ({
  db: {},
  schema: {},
  sql: { end: vi.fn() },
}));

// Mock Redis (required by index.ts)
vi.mock('../db/redis.js', () => ({
  initRedis: vi.fn(),
  closeRedis: vi.fn(),
  getRedis: vi.fn(),
  isRedisHealthy: vi.fn().mockReturnValue(false),
}));

// Mock Sentry (required by index.ts)
vi.mock('../sentry.js', () => ({
  initSentry: vi.fn(),
  Sentry: {
    setupExpressErrorHandler: vi.fn(),
  },
}));

// Mock usage tracker (required by chat route)
vi.mock('../claude/usage-tracker.js', () => ({
  checkDailyLimit: vi.fn().mockReturnValue({ allowed: true }),
  recordUsage: vi.fn(),
  getUsageSummary: vi.fn().mockReturnValue({
    requestsToday: 0,
    dailyLimit: 100,
    remaining: 100,
    estimatedCostToday: '$0.00',
  }),
}));

import app from '../index.js';

function makeStoredPendingAction(overrides: Record<string, unknown> = {}) {
  return {
    actionId: 'action-123',
    toolName: 'cm360_create_campaign',
    description: 'Create a new campaign "Q1 Display"',
    preview: {
      entityType: 'campaign',
      entityName: 'Q1 Display',
      operation: 'create' as const,
      fields: [{ field: 'name', value: 'Q1 Display' }],
    },
    riskLevel: 'standard' as const,
    proposedAt: Date.now(),
    expiresAt: Date.now() + 300_000,
    userId: 'test-user-id',
    conversationId: 'conv-abc',
    toolInput: { advertiserId: '1001', name: 'Q1 Display' },
    ...overrides,
  };
}

describe('POST /api/v1/confirmations/:actionId/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes the pending tool and returns result', async () => {
    const action = makeStoredPendingAction();
    mockConsumePendingAction.mockReturnValue(action);
    mockExecuteTool.mockResolvedValue({
      result: { id: '5001', name: 'Q1 Display' },
      isError: false,
    });

    const res = await request(app)
      .post('/api/v1/confirmations/action-123/approve')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.actionId).toBe('action-123');
    expect(res.body.result).toEqual({ id: '5001', name: 'Q1 Display' });
    expect(res.body.isError).toBe(false);
    expect(res.body.errorMessage).toBeUndefined();

    // Verify executeTool was called with the correct arguments
    expect(mockExecuteTool).toHaveBeenCalledWith(
      'cm360_create_campaign',
      { advertiserId: '1001', name: 'Q1 Display' },
      'test-user-id',
      'conv-abc',
    );
  });

  it('returns 404 for non-existent action', async () => {
    mockConsumePendingAction.mockReturnValue(null);

    const res = await request(app)
      .post('/api/v1/confirmations/nonexistent-id/approve')
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Action not found or expired');
  });

  it('returns 400 when destructive op missing typed confirmation', async () => {
    const action = makeStoredPendingAction({
      riskLevel: 'destructive',
      preview: { entityType: 'placement', entityName: 'Old Placement', operation: 'archive' as const, fields: [] },
    });
    mockConsumePendingAction.mockReturnValue(action);

    const res = await request(app)
      .post('/api/v1/confirmations/action-123/approve')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Type "ARCHIVE" to confirm this action');
    // executeTool should NOT have been called
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  it('returns 400 when destructive op has wrong typed confirmation', async () => {
    const action = makeStoredPendingAction({
      riskLevel: 'destructive',
      preview: { entityType: 'placement', entityName: 'Old Placement', operation: 'archive' as const, fields: [] },
    });
    mockConsumePendingAction.mockReturnValue(action);

    const res = await request(app)
      .post('/api/v1/confirmations/action-123/approve')
      .send({ typedConfirmation: 'WRONG' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Type "ARCHIVE" to confirm this action');
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  it('executes destructive op when typed confirmation is correct', async () => {
    const action = makeStoredPendingAction({
      riskLevel: 'destructive',
      preview: { entityType: 'placement', entityName: 'Old Placement', operation: 'archive' as const, fields: [] },
    });
    mockConsumePendingAction.mockReturnValue(action);
    mockExecuteTool.mockResolvedValue({
      result: { archived: true },
      isError: false,
    });

    const res = await request(app)
      .post('/api/v1/confirmations/action-123/approve')
      .send({ typedConfirmation: 'ARCHIVE' });

    expect(res.status).toBe(200);
    expect(res.body.actionId).toBe('action-123');
    expect(res.body.result).toEqual({ archived: true });
    expect(mockExecuteTool).toHaveBeenCalledOnce();
  });

  it('rejects DELETE typed confirmation when operation is archive', async () => {
    const action = makeStoredPendingAction({
      riskLevel: 'destructive',
      preview: { entityType: 'placement', entityName: 'Old Placement', operation: 'archive' as const, fields: [] },
    });
    mockConsumePendingAction.mockReturnValue(action);

    const res = await request(app)
      .post('/api/v1/confirmations/action-123/approve')
      .send({ typedConfirmation: 'DELETE' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Type "ARCHIVE" to confirm this action');
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  it('accepts ARCHIVE as typed confirmation for archive operations', async () => {
    const action = makeStoredPendingAction({
      riskLevel: 'destructive',
      preview: { entityType: 'placement', entityName: 'Old Placement', operation: 'archive' as const, fields: [] },
    });
    mockConsumePendingAction.mockReturnValue(action);
    mockExecuteTool.mockResolvedValue({
      result: { archived: true },
      isError: false,
    });

    const res = await request(app)
      .post('/api/v1/confirmations/action-123/approve')
      .send({ typedConfirmation: 'ARCHIVE' });

    expect(res.status).toBe(200);
    expect(res.body.actionId).toBe('action-123');
    expect(res.body.result).toEqual({ archived: true });
    expect(mockExecuteTool).toHaveBeenCalledOnce();
  });

  it('returns tool error information when executeTool fails', async () => {
    const action = makeStoredPendingAction();
    mockConsumePendingAction.mockReturnValue(action);
    mockExecuteTool.mockResolvedValue({
      result: null,
      isError: true,
      errorMessage: 'CM360 API returned 403: Insufficient permissions',
    });

    const res = await request(app)
      .post('/api/v1/confirmations/action-123/approve')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.isError).toBe(true);
    expect(res.body.errorMessage).toBe('CM360 API returned 403: Insufficient permissions');
  });
});

describe('POST /api/v1/confirmations/:actionId/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks action as rejected and returns 200', async () => {
    const action = makeStoredPendingAction();
    mockConsumePendingAction.mockReturnValue(action);

    const res = await request(app)
      .post('/api/v1/confirmations/action-123/reject')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.actionId).toBe('action-123');
    expect(res.body.rejected).toBe(true);

    // Verify consume was called to remove from store
    expect(mockConsumePendingAction).toHaveBeenCalledWith('action-123', 'test-user-id');
  });

  it('returns 404 for non-existent action', async () => {
    mockConsumePendingAction.mockReturnValue(null);

    const res = await request(app)
      .post('/api/v1/confirmations/nonexistent-id/reject')
      .send();

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Action not found or expired');
  });
});

describe('POST /api/v1/confirmations/:actionId/approve — Trafficking QA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const QA_REPORT = {
    runId: 'run-1', status: 'passed', trigger: 'auto', advisory: true,
    touched: [], checks: [], startedAt: Date.now(),
  };

  it('runs QA after a successful write and returns the advisory report', async () => {
    mockConsumePendingAction.mockResolvedValue(makeStoredPendingAction({ conversationId: 'conv-qa' }));
    mockExecuteTool.mockResolvedValue({ result: { id: 'c1' }, isError: false });
    mockResolveFlags.mockResolvedValue({ 'qa.enabled': true });
    mockRunTurnQa.mockResolvedValue(QA_REPORT);

    const res = await request(app).post('/api/v1/confirmations/action-123/approve').send({});
    expect(res.status).toBe(200);
    expect(res.body.qaReport).toMatchObject({ runId: 'run-1', advisory: true });
    expect(mockRunTurnQa).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-qa', userId: 'test-user-id', trigger: 'auto',
    }));
  });

  it('omits qaReport when the QA run returns null (flag off / nothing to check)', async () => {
    mockConsumePendingAction.mockResolvedValue(makeStoredPendingAction());
    mockExecuteTool.mockResolvedValue({ result: { id: 'c1' }, isError: false });
    mockResolveFlags.mockResolvedValue({ 'qa.enabled': false });
    mockRunTurnQa.mockResolvedValue(null);

    const res = await request(app).post('/api/v1/confirmations/action-123/approve').send({});
    expect(res.status).toBe(200);
    expect(res.body.qaReport).toBeUndefined();
  });

  it('does not run QA when the write failed, and a QA error never breaks the response', async () => {
    mockConsumePendingAction.mockResolvedValue(makeStoredPendingAction());
    mockExecuteTool.mockResolvedValue({ result: null, isError: true, errorMessage: 'boom' });
    const res = await request(app).post('/api/v1/confirmations/action-123/approve').send({});
    expect(res.status).toBe(200);
    expect(mockRunTurnQa).not.toHaveBeenCalled();

    mockExecuteTool.mockResolvedValue({ result: { id: 'c1' }, isError: false });
    mockConsumePendingAction.mockResolvedValue(makeStoredPendingAction());
    mockResolveFlags.mockRejectedValue(new Error('flags down'));
    const res2 = await request(app).post('/api/v1/confirmations/action-123/approve').send({});
    expect(res2.status).toBe(200); // advisory: approve response unaffected
    expect(res2.body.qaReport).toBeUndefined();
  });
});
