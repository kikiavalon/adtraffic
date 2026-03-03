import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import type { PendingAction } from '@adtraffic/shared';

// Mock requireAuth middleware — inject test user (default: senior)
let mockUserRole = 'senior';
vi.mock('../auth/middleware.js', () => ({
  requireAuth: (req: { user?: { userId: string; email: string; role: string } }, _res: unknown, next: () => void) => {
    req.user = { userId: 'approver-1', email: 'senior@example.com', role: mockUserRole };
    next();
  },
}));

// Mock requirePermission — block junior users from canApproveOthers
vi.mock('../auth/roles.js', () => ({
  requirePermission: vi.fn((permission: string) => {
    return (req: { user?: { role: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
      if (req.user?.role === 'junior' && (permission === 'canApproveOthers' || permission === 'canExecuteWriteTools')) {
        res.status(403).json({ error: `Forbidden: requires ${permission} permission` });
        return;
      }
      next();
    };
  }),
}));

// Mock approval-service
const mockGetPendingApprovals = vi.fn();
const mockGetMyRequests = vi.fn();
const mockGetApprovalById = vi.fn();
const mockApproveRequest = vi.fn();
const mockRejectRequest = vi.fn();
vi.mock('../approval/approval-service.js', () => ({
  getPendingApprovals: (...args: unknown[]) => mockGetPendingApprovals(...args),
  getMyRequests: (...args: unknown[]) => mockGetMyRequests(...args),
  getApprovalById: (...args: unknown[]) => mockGetApprovalById(...args),
  approveRequest: (...args: unknown[]) => mockApproveRequest(...args),
  rejectRequest: (...args: unknown[]) => mockRejectRequest(...args),
  submitForApproval: vi.fn(),
}));

// Mock audit logger
const mockLogRequestAuditEvent = vi.fn();
vi.mock('../middleware/audit-logger.js', () => ({
  logRequestAuditEvent: (...args: unknown[]) => mockLogRequestAuditEvent(...args),
  extractAuditContext: vi.fn().mockReturnValue({ userId: 'approver-1', ipAddress: '127.0.0.1', userAgent: 'test' }),
}));

// Mock audit service (imported transitively by audit-logger)
vi.mock('../audit/audit-service.js', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  hashIp: vi.fn(),
  VALID_EVENT_TYPES: [],
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

/** Create a mock ApprovalItem for testing */
function makeApprovalItem(overrides: Record<string, unknown> = {}) {
  const action: PendingAction = {
    actionId: 'action-abc',
    toolName: 'cm360_create_campaign',
    description: 'Create campaign "Q1 Display"',
    preview: {
      entityType: 'campaign',
      entityName: 'Q1 Display',
      operation: 'create' as const,
      fields: [{ field: 'name', value: 'Q1 Display' }],
    },
    riskLevel: 'standard',
    proposedAt: Date.now(),
    expiresAt: Date.now() + 300_000,
  };

  return {
    id: 'approval-001',
    requesterId: 'junior-user-1',
    conversationId: 'conv-123',
    actionPayload: action,
    status: 'pending' as const,
    note: null,
    createdAt: new Date('2026-02-27T10:00:00Z'),
    resolvedAt: null,
    ...overrides,
  };
}

describe('GET /api/v1/approvals/pending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRole = 'senior';
  });

  it('returns pending approvals with pagination metadata', async () => {
    const items = [makeApprovalItem(), makeApprovalItem({ id: 'approval-002' })];
    mockGetPendingApprovals.mockResolvedValue(items);

    const res = await request(app).get('/api/v1/approvals/pending');

    expect(res.status).toBe(200);
    expect(res.body.approvals).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.pageSize).toBe(50);
    expect(res.body.pageOffset).toBe(0);
    expect(res.body.approvals[0].id).toBe('approval-001');
    expect(res.body.approvals[0].status).toBe('pending');
    expect(res.body.approvals[0].createdAt).toBe('2026-02-27T10:00:00.000Z');
    expect(res.body.approvals[0].submittedAgo).toBeDefined();
    expect(res.body.approvals[0].actionPayload).toBeDefined();
    expect(res.body.approvals[0].actionPayload.toolName).toBe('cm360_create_campaign');
  });

  it('returns 403 for junior user', async () => {
    mockUserRole = 'junior';

    const res = await request(app).get('/api/v1/approvals/pending');

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('canApproveOthers');
    expect(mockGetPendingApprovals).not.toHaveBeenCalled();
  });

  it('returns empty array when no pending items', async () => {
    mockGetPendingApprovals.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/approvals/pending');

    expect(res.status).toBe(200);
    expect(res.body.approvals).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

describe('GET /api/v1/approvals/my-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRole = 'junior';
  });

  it('returns own requests for any role', async () => {
    const items = [
      makeApprovalItem({ status: 'approved', note: 'Looks good', resolvedAt: new Date('2026-02-27T11:00:00Z') }),
    ];
    mockGetMyRequests.mockResolvedValue(items);

    const res = await request(app).get('/api/v1/approvals/my-requests');

    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.pageSize).toBe(50);
    expect(res.body.pageOffset).toBe(0);
    expect(res.body.requests[0].id).toBe('approval-001');
    expect(res.body.requests[0].status).toBe('approved');
    expect(res.body.requests[0].note).toBe('Looks good');
    expect(res.body.requests[0].resolvedAt).toBe('2026-02-27T11:00:00.000Z');
    expect(mockGetMyRequests).toHaveBeenCalledWith('approver-1', undefined);
  });

  it('filters by status query param', async () => {
    mockGetMyRequests.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/approvals/my-requests?status=pending');

    expect(res.status).toBe(200);
    expect(mockGetMyRequests).toHaveBeenCalledWith('approver-1', 'pending');
  });

  it('returns 400 for invalid status filter', async () => {
    const res = await request(app).get('/api/v1/approvals/my-requests?status=bogus');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid status filter');
  });

  it('clamps limit to max 100', async () => {
    mockGetMyRequests.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/approvals/my-requests?limit=999');

    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(100);
  });
});

describe('POST /api/v1/approvals/:id/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRole = 'senior';
  });

  it('approves a pending request successfully', async () => {
    const approval = makeApprovalItem();
    mockGetApprovalById.mockResolvedValue(approval);
    mockApproveRequest.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/approvals/approval-001/approve')
      .send({ note: 'Approved for Q1 launch' });

    expect(res.status).toBe(200);
    expect(res.body.approvalId).toBe('approval-001');
    expect(res.body.status).toBe('approved');
    expect(res.body.message).toBe('Request approved.');
    expect(res.body.executedAt).toBeDefined();

    expect(mockApproveRequest).toHaveBeenCalledWith('approval-001', 'approver-1', 'Approved for Q1 launch');
  });

  it('requires typed confirmation for destructive operations', async () => {
    const approval = makeApprovalItem({
      actionPayload: {
        actionId: 'action-abc',
        toolName: 'cm360_update_campaign',
        description: 'Delete campaign',
        preview: {
          entityType: 'campaign',
          entityName: 'Old Campaign',
          operation: 'delete',
          fields: [],
        },
        riskLevel: 'destructive',
        proposedAt: Date.now(),
        expiresAt: Date.now() + 300_000,
      },
    });
    mockGetApprovalById.mockResolvedValue(approval);

    const res = await request(app)
      .post('/api/v1/approvals/approval-001/approve')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Type "DELETE" to confirm this destructive action');
    expect(mockApproveRequest).not.toHaveBeenCalled();
  });

  it('returns 400 for wrong typed confirmation', async () => {
    const approval = makeApprovalItem({
      actionPayload: {
        actionId: 'action-abc',
        toolName: 'cm360_update_campaign',
        description: 'Archive campaign',
        preview: {
          entityType: 'campaign',
          entityName: 'Old Campaign',
          operation: 'archive',
          fields: [],
        },
        riskLevel: 'destructive',
        proposedAt: Date.now(),
        expiresAt: Date.now() + 300_000,
      },
    });
    mockGetApprovalById.mockResolvedValue(approval);

    const res = await request(app)
      .post('/api/v1/approvals/approval-001/approve')
      .send({ typedConfirmation: 'DELETE' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Type "ARCHIVE" to confirm this destructive action');
    expect(mockApproveRequest).not.toHaveBeenCalled();
  });

  it('returns 404 for non-existent approval', async () => {
    mockGetApprovalById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/approvals/nonexistent/approve')
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Approval not found or already resolved');
  });

  it('returns 404 for already-resolved approval', async () => {
    const approval = makeApprovalItem({ status: 'approved' });
    mockGetApprovalById.mockResolvedValue(approval);

    const res = await request(app)
      .post('/api/v1/approvals/approval-001/approve')
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Approval not found or already resolved');
    expect(mockApproveRequest).not.toHaveBeenCalled();
  });

  it('validates note max length of 500 characters', async () => {
    const longNote = 'x'.repeat(501);

    const res = await request(app)
      .post('/api/v1/approvals/approval-001/approve')
      .send({ note: longNote });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('500 characters');
    expect(mockGetApprovalById).not.toHaveBeenCalled();
  });

  it('returns 403 for junior user', async () => {
    mockUserRole = 'junior';

    const res = await request(app)
      .post('/api/v1/approvals/approval-001/approve')
      .send({});

    expect(res.status).toBe(403);
    expect(mockApproveRequest).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/approvals/:id/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRole = 'senior';
  });

  it('rejects a pending request with a note', async () => {
    const approval = makeApprovalItem();
    mockGetApprovalById.mockResolvedValue(approval);
    mockRejectRequest.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/approvals/approval-001/reject')
      .send({ note: 'Wrong campaign dates' });

    expect(res.status).toBe(200);
    expect(res.body.approvalId).toBe('approval-001');
    expect(res.body.status).toBe('rejected');
    expect(res.body.message).toBe('Request rejected.');
    expect(res.body.rejectedAt).toBeDefined();

    expect(mockRejectRequest).toHaveBeenCalledWith('approval-001', 'approver-1', 'Wrong campaign dates');
  });

  it('returns 404 for non-existent approval', async () => {
    mockGetApprovalById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/approvals/nonexistent/reject')
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Approval not found or already resolved');
  });

  it('works without a note', async () => {
    const approval = makeApprovalItem();
    mockGetApprovalById.mockResolvedValue(approval);
    mockRejectRequest.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/approvals/approval-001/reject')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(mockRejectRequest).toHaveBeenCalledWith('approval-001', 'approver-1', undefined);
  });
});

describe('Audit logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRole = 'senior';
  });

  it('logs audit event on approve', async () => {
    const approval = makeApprovalItem();
    mockGetApprovalById.mockResolvedValue(approval);
    mockApproveRequest.mockResolvedValue(undefined);

    await request(app)
      .post('/api/v1/approvals/approval-001/approve')
      .send({});

    expect(mockLogRequestAuditEvent).toHaveBeenCalledTimes(1);
    expect(mockLogRequestAuditEvent).toHaveBeenCalledWith(
      expect.anything(), // req object
      'confirmation_approved',
      'conv-123',
      expect.objectContaining({
        approvalId: 'approval-001',
        toolName: 'cm360_create_campaign',
        riskLevel: 'standard',
        requesterId: 'junior-user-1',
      }),
    );
  });

  it('logs audit event on reject', async () => {
    const approval = makeApprovalItem();
    mockGetApprovalById.mockResolvedValue(approval);
    mockRejectRequest.mockResolvedValue(undefined);

    await request(app)
      .post('/api/v1/approvals/approval-001/reject')
      .send({ note: 'Not approved' });

    expect(mockLogRequestAuditEvent).toHaveBeenCalledTimes(1);
    expect(mockLogRequestAuditEvent).toHaveBeenCalledWith(
      expect.anything(), // req object
      'confirmation_rejected',
      'conv-123',
      expect.objectContaining({
        approvalId: 'approval-001',
        toolName: 'cm360_create_campaign',
        riskLevel: 'standard',
        requesterId: 'junior-user-1',
      }),
    );
  });
});
