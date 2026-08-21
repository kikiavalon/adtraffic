import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { requirePermission } from '../auth/roles.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import {
  getPendingApprovals,
  getMyRequests,
  getApprovalById,
  approveRequest,
  rejectRequest,
  recordExecutionResult,
} from '../approval/approval-service.js';
import { executeTool, type ToolResult } from '../cm360/tool-executor.js';
import { logRequestAuditEvent } from '../middleware/audit-logger.js';
import { logger } from '../lib/logger.js';
import { resolveFlags } from '../feature-flags/flag-service.js';
import { runTurnQa } from '../qa/qa-service.js';
import type { PendingAction, QARunReport } from '@adtraffic/shared';

const router = Router();

// Approve executes a real CM360 write and reject resolves a pending item; both
// mutate approval state, so throttle decisions per user (shared bucket) — not
// per shared IP — as defence against a compromised session hammering them.
const decisionLimiter = createRateLimiter({
  name: 'approval-decision',
  windowMs: 60_000,
  maxRequests: 30,
  key: (req) => req.user?.userId ?? req.ip ?? 'anonymous',
});

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
      executionResult: item.executionResult,
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
router.post('/approvals/:id/approve', requireAuth, requirePermission('canApproveOthers'), decisionLimiter, async (req, res) => {
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

    // Segregation of duties: a requester may not approve their own request. The
    // approve queue is guarded by the canApproveOthers permission, which no
    // requester role holds today, but enforce identity here so the four-eyes
    // control does not depend on the role table staying disjoint.
    if (approval.requesterId === approverId) {
      res.status(403).json({ error: 'You cannot approve your own request' });
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

    // Execute the stored action. The payload was serialized from the requester's
    // pending action (a StoredPendingAction), so it carries the original toolInput.
    // The original pending_actions row was consumed when the request was routed
    // here, so this is the only place the approved write can actually run.
    const payload = approval.actionPayload as PendingAction & { toolInput?: Record<string, unknown> };
    const executedAt = new Date().toISOString();
    let toolResult: ToolResult;
    if (!payload.toolInput) {
      toolResult = {
        result: null,
        isError: true,
        errorMessage: 'Stored action payload is missing the tool input; the operation was not executed. Ask the requester to resubmit.',
      };
    } else {
      try {
        toolResult = await executeTool(payload.toolName, payload.toolInput, approval.requesterId, approval.conversationId ?? undefined);
      } catch (err) {
        toolResult = {
          result: null,
          isError: true,
          errorMessage: err instanceof Error ? err.message : 'Tool execution failed',
        };
      }
    }

    try {
      await recordExecutionResult(approvalId, {
        result: toolResult.result,
        isError: toolResult.isError,
        errorMessage: toolResult.errorMessage,
        executedAt,
      });
    } catch (err) {
      // The tool already ran — a bookkeeping failure must not turn the response into a 500
      logger.error(
        { approvalId, err: { message: err instanceof Error ? err.message : 'Unknown error' }, requestId: req.requestId },
        'Failed to record execution result on approval row',
      );
    }

    // Trafficking QA — advisory; the run is attributed to the REQUESTER (the
    // planner whose work is being checked), using the requester's flags.
    // Guard on conversationId: it is nullable here, RunTurnQaOptions requires it,
    // and that is semantically correct — the recorder is keyed by conversationId
    // and the executeTool hook only records when a conversationId was passed, so
    // with none there is nothing to drain or validate.
    let qaReport: QARunReport | null = null;
    if (!toolResult.isError && approval.conversationId) {
      try {
        const flags = await resolveFlags(approval.requesterId);
        qaReport = await runTurnQa({
          conversationId: approval.conversationId,
          userId: approval.requesterId,
          flags,
          trigger: 'approval',
        });
      } catch { /* advisory — never block the approval response */ }
    }

    logRequestAuditEvent(req, 'tool_executed', approval.conversationId ?? undefined, {
      approvalId,
      toolName: approval.actionPayload.toolName,
      riskLevel: approval.actionPayload.riskLevel,
      requesterId: approval.requesterId,
      success: !toolResult.isError,
      ...(toolResult.errorMessage ? { errorMessage: toolResult.errorMessage } : {}),
    });

    res.json({
      approvalId,
      status: 'approved',
      executedAt,
      result: toolResult.result,
      isError: toolResult.isError,
      errorMessage: toolResult.errorMessage,
      message: toolResult.isError ? 'Request approved, but execution failed.' : 'Request approved and executed.',
      ...(qaReport ? { qaReport } : {}),
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
router.post('/approvals/:id/reject', requireAuth, requirePermission('canApproveOthers'), decisionLimiter, async (req, res) => {
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

    // Segregation of duties: a requester may not resolve their own request.
    if (approval.requesterId === approverId) {
      res.status(403).json({ error: 'You cannot reject your own request' });
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
