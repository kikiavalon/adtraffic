import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { requirePermission } from '../auth/roles.js';
import {
  getPendingApprovals,
  getMyRequests,
  getApprovalById,
  approveRequest,
  rejectRequest,
} from '../approval/approval-service.js';
import { logRequestAuditEvent } from '../middleware/audit-logger.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * GET /approvals/pending
 *
 * Returns all pending approvals for senior/admin review.
 * Requires canApproveOthers permission.
 */
router.get('/approvals/pending', requireAuth, requirePermission('canApproveOthers'), async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, parseInt(req.query['limit'] as string, 10) || 50));
    const offset = Math.max(0, parseInt(req.query['offset'] as string, 10) || 0);

    const allPending = await getPendingApprovals(req.user!.userId);

    // Paginate in-memory (getPendingApprovals returns all pending items)
    const total = allPending.length;
    const page = allPending.slice(offset, offset + limit);

    const approvals = page.map((item) => ({
      id: item.id,
      requesterId: item.requesterId,
      conversationId: item.conversationId,
      actionPayload: item.actionPayload,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      submittedAgo: formatTimeAgo(item.createdAt),
    }));

    res.json({
      approvals,
      total,
      pageSize: limit,
      pageOffset: offset,
    });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error listing pending approvals',
    );
    res.status(500).json({ error: 'Failed to list pending approvals' });
  }
});

/**
 * GET /approvals/my-requests
 *
 * Returns the authenticated user's own submitted approval requests.
 * Any role can view their own requests.
 */
router.get('/approvals/my-requests', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const statusFilter = req.query['status'] as string | undefined;
    const limit = Math.max(1, Math.min(100, parseInt(req.query['limit'] as string, 10) || 50));
    const offset = Math.max(0, parseInt(req.query['offset'] as string, 10) || 0);

    // Validate status filter if provided
    if (statusFilter && !['pending', 'approved', 'rejected', 'expired'].includes(statusFilter)) {
      res.status(400).json({ error: 'Invalid status filter. Must be one of: pending, approved, rejected, expired' });
      return;
    }

    const allRequests = await getMyRequests(userId, statusFilter);

    // Paginate in-memory
    const total = allRequests.length;
    const page = allRequests.slice(offset, offset + limit);

    const requests = page.map((item) => ({
      id: item.id,
      conversationId: item.conversationId,
      actionPayload: item.actionPayload,
      status: item.status,
      note: item.note,
      createdAt: item.createdAt.toISOString(),
      resolvedAt: item.resolvedAt ? item.resolvedAt.toISOString() : null,
    }));

    res.json({
      requests,
      total,
      pageSize: limit,
      pageOffset: offset,
    });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error listing my approval requests',
    );
    res.status(500).json({ error: 'Failed to list approval requests' });
  }
});

/**
 * POST /approvals/:id/approve
 *
 * Approves a pending approval request.
 * Requires canApproveOthers permission.
 * For destructive operations, requires typedConfirmation matching the operation name.
 */
router.post('/approvals/:id/approve', requireAuth, requirePermission('canApproveOthers'), async (req, res) => {
  try {
    const approvalId = req.params['id'] as string;
    const approverId = req.user!.userId;
    const { note, typedConfirmation } = req.body as { note?: string; typedConfirmation?: string };

    // Validate note length
    if (note !== undefined && note !== null && typeof note === 'string' && note.length > 500) {
      res.status(400).json({ error: 'Note must be 500 characters or fewer' });
      return;
    }

    // Fetch the approval to check its state and risk level
    const approval = await getApprovalById(approvalId);
    if (!approval || approval.status !== 'pending') {
      res.status(404).json({ error: 'Approval not found or already resolved' });
      return;
    }

    // Destructive operations require typed confirmation
    if (approval.actionPayload.riskLevel === 'destructive') {
      const expectedPhrase = approval.actionPayload.preview.operation.toUpperCase();
      if (!typedConfirmation || typedConfirmation !== expectedPhrase) {
        res.status(400).json({ error: `Type "${expectedPhrase}" to confirm this destructive action` });
        return;
      }
    }

    // Mark as approved in the database (atomic WHERE status='pending' check prevents race conditions)
    try {
      await approveRequest(approvalId, approverId, note);
    } catch (err) {
      if (err instanceof Error && err.message === 'Approval request not found or already resolved') {
        res.status(404).json({ error: 'Approval not found or already resolved' });
        return;
      }
      throw err;
    }

    logger.info(
      { approvalId, toolName: approval.actionPayload.toolName, approverId, riskLevel: approval.actionPayload.riskLevel, requestId: req.requestId },
      'Approval request approved',
    );

    // Audit log the approval
    logRequestAuditEvent(req, 'confirmation_approved', approval.conversationId ?? undefined, {
      approvalId,
      toolName: approval.actionPayload.toolName,
      riskLevel: approval.actionPayload.riskLevel,
      requesterId: approval.requesterId,
    });

    res.json({
      approvalId,
      status: 'approved',
      executedAt: new Date().toISOString(),
      message: 'Request approved.',
    });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error approving request',
    );
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

/**
 * POST /approvals/:id/reject
 *
 * Rejects a pending approval request.
 * Requires canApproveOthers permission.
 */
router.post('/approvals/:id/reject', requireAuth, requirePermission('canApproveOthers'), async (req, res) => {
  try {
    const approvalId = req.params['id'] as string;
    const approverId = req.user!.userId;
    const { note } = req.body as { note?: string };

    // Validate note length
    if (note !== undefined && note !== null && typeof note === 'string' && note.length > 500) {
      res.status(400).json({ error: 'Note must be 500 characters or fewer' });
      return;
    }

    // Fetch the approval to verify it exists and is pending
    const approval = await getApprovalById(approvalId);
    if (!approval || approval.status !== 'pending') {
      res.status(404).json({ error: 'Approval not found or already resolved' });
      return;
    }

    // Mark as rejected in the database (atomic WHERE status='pending' check prevents race conditions)
    try {
      await rejectRequest(approvalId, approverId, note);
    } catch (err) {
      if (err instanceof Error && err.message === 'Approval request not found or already resolved') {
        res.status(404).json({ error: 'Approval not found or already resolved' });
        return;
      }
      throw err;
    }

    logger.info(
      { approvalId, toolName: approval.actionPayload.toolName, approverId, requestId: req.requestId },
      'Approval request rejected',
    );

    // Audit log the rejection
    logRequestAuditEvent(req, 'confirmation_rejected', approval.conversationId ?? undefined, {
      approvalId,
      toolName: approval.actionPayload.toolName,
      riskLevel: approval.actionPayload.riskLevel,
      requesterId: approval.requesterId,
    });

    res.json({
      approvalId,
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      message: 'Request rejected.',
    });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error rejecting request',
    );
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

/** Format a Date into a human-readable "X ago" string */
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default router;
