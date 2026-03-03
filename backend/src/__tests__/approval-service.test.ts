import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { PendingAction } from '@adtraffic/shared';

vi.mock('../db/index.js', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  schema: {
    approvalQueue: {
      id: 'id',
      requesterId: 'requester_id',
      status: 'status',
      createdAt: 'created_at',
    },
  },
}));

// Must import AFTER vi.mock
import { db } from '../db/index.js';
import {
  submitForApproval,
  getPendingApprovals,
  approveRequest,
  rejectRequest,
} from '../approval/approval-service.js';

const mockAction: PendingAction = {
  actionId: 'action-123',
  toolName: 'cm360_create_campaign',
  description: 'Create campaign "Apex Motors Q1 2026"',
  preview: {
    entityType: 'campaign',
    entityName: 'Apex Motors Q1 2026',
    operation: 'create',
    fields: [
      { field: 'name', value: 'Apex Motors Q1 2026' },
      { field: 'advertiserId', value: 'adv-1' },
    ],
  },
  riskLevel: 'standard',
  proposedAt: Date.now(),
  expiresAt: Date.now() + 300_000,
};

describe('approval-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitForApproval', () => {
    it('inserts into DB and returns the approval queue ID', async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: 'approval-1' }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as Mock).mockReturnValue({ values: mockValues });

      const id = await submitForApproval('user-1', mockAction, 'conv-1');

      expect(id).toBe('approval-1');
      expect(db.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        requesterId: 'user-1',
        conversationId: 'conv-1',
        actionPayload: JSON.stringify(mockAction),
      });
    });

    it('stores serialized PendingAction as JSON string', async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: 'approval-2' }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as Mock).mockReturnValue({ values: mockValues });

      await submitForApproval('user-1', mockAction);

      const calledWith = mockValues.mock.calls[0]![0] as { actionPayload: string };
      const parsed = JSON.parse(calledWith.actionPayload) as PendingAction;
      expect(parsed.actionId).toBe('action-123');
      expect(parsed.toolName).toBe('cm360_create_campaign');
      expect(parsed.preview.entityName).toBe('Apex Motors Q1 2026');
    });

    it('handles missing conversationId by passing null', async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: 'approval-3' }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as Mock).mockReturnValue({ values: mockValues });

      await submitForApproval('user-1', mockAction);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: null }),
      );
    });

    it('throws if insert returns empty result', async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as Mock).mockReturnValue({ values: mockValues });

      await expect(submitForApproval('user-1', mockAction))
        .rejects.toThrow('Failed to insert approval request');
    });
  });

  describe('getPendingApprovals', () => {
    it('returns mapped rows with parsed JSON payload', async () => {
      const now = new Date();
      const dbRows = [
        {
          id: 'approval-1',
          requesterId: 'user-1',
          approverId: null,
          conversationId: 'conv-1',
          actionPayload: JSON.stringify(mockAction),
          status: 'pending',
          note: null,
          createdAt: now,
          resolvedAt: null,
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(dbRows);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as Mock).mockReturnValue({ from: mockFrom });

      const results = await getPendingApprovals();

      expect(results).toHaveLength(1);
      const first = results[0]!;
      expect(first.id).toBe('approval-1');
      expect(first.requesterId).toBe('user-1');
      expect(first.conversationId).toBe('conv-1');
      expect(first.actionPayload.actionId).toBe('action-123');
      expect(first.actionPayload.toolName).toBe('cm360_create_campaign');
      expect(first.status).toBe('pending');
      expect(first.createdAt).toBe(now);
      expect(first.resolvedAt).toBeNull();
    });

    it('throws descriptive error when actionPayload JSON is corrupted', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([
        {
          id: 'approval-bad',
          requesterId: 'user-1',
          approverId: null,
          conversationId: null,
          actionPayload: '{invalid json',
          status: 'pending',
          note: null,
          createdAt: new Date(),
          resolvedAt: null,
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as Mock).mockReturnValue({ from: mockFrom });

      await expect(getPendingApprovals()).rejects.toThrow('Corrupted actionPayload in approval queue row approval-bad');
    });

    it('returns empty array when no pending items', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as Mock).mockReturnValue({ from: mockFrom });

      const results = await getPendingApprovals();

      expect(results).toEqual([]);
    });
  });

  describe('approveRequest', () => {
    it('sets status to approved, sets approverId and resolvedAt', async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: 'approval-1' }]);
      const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      (db.update as Mock).mockReturnValue({ set: mockSet });

      await approveRequest('approval-1', 'admin-1', 'Looks good');

      expect(db.update).toHaveBeenCalled();
      const setCall = mockSet.mock.calls[0]![0] as {
        status: string;
        approverId: string;
        note: string | null;
        resolvedAt: Date;
      };
      expect(setCall.status).toBe('approved');
      expect(setCall.approverId).toBe('admin-1');
      expect(setCall.note).toBe('Looks good');
      expect(setCall.resolvedAt).toBeInstanceOf(Date);
    });

    it('throws if request not found or already resolved', async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      (db.update as Mock).mockReturnValue({ set: mockSet });

      await expect(approveRequest('nonexistent', 'admin-1'))
        .rejects.toThrow('Approval request not found or already resolved');
    });

    it('sets note to null when not provided', async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: 'approval-1' }]);
      const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      (db.update as Mock).mockReturnValue({ set: mockSet });

      await approveRequest('approval-1', 'admin-1');

      const setCall = mockSet.mock.calls[0]![0] as { note: string | null };
      expect(setCall.note).toBeNull();
    });
  });

  describe('rejectRequest', () => {
    it('sets status to rejected with note', async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: 'approval-1' }]);
      const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      (db.update as Mock).mockReturnValue({ set: mockSet });

      await rejectRequest('approval-1', 'senior-1', 'Campaign dates are wrong');

      expect(db.update).toHaveBeenCalled();
      const setCall = mockSet.mock.calls[0]![0] as {
        status: string;
        approverId: string;
        note: string | null;
        resolvedAt: Date;
      };
      expect(setCall.status).toBe('rejected');
      expect(setCall.approverId).toBe('senior-1');
      expect(setCall.note).toBe('Campaign dates are wrong');
      expect(setCall.resolvedAt).toBeInstanceOf(Date);
    });

    it('throws if request not found or already resolved', async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      (db.update as Mock).mockReturnValue({ set: mockSet });

      await expect(rejectRequest('nonexistent', 'senior-1'))
        .rejects.toThrow('Approval request not found or already resolved');
    });

    it('sets note to null when not provided', async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: 'approval-1' }]);
      const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      (db.update as Mock).mockReturnValue({ set: mockSet });

      await rejectRequest('approval-1', 'senior-1');

      const setCall = mockSet.mock.calls[0]![0] as { note: string | null };
      expect(setCall.note).toBeNull();
    });
  });
});
