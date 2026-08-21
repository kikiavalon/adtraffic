import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { isValidRole, hasPermission } from '../auth/roles.js';
import { consumePendingAction, listPendingActions } from '../cm360/pending-actions.js';
import { executeTool } from '../cm360/tool-executor.js';
import { submitForApproval } from '../approval/approval-service.js';
import { logger } from '../lib/logger.js';
import { logRequestAuditEvent } from '../middleware/audit-logger.js';
import { resolveFlags } from '../feature-flags/flag-service.js';
import { runTurnQa } from '../qa/qa-service.js';
import type { QARunReport } from '@adtraffic/shared';

const router = Router();

// Approve executes a real CM360 write; reject consumes the pending action. Both
// mutate state, so throttle decisions per user (not per shared IP) as defence
// against a compromised session hammering these endpoints.
const decisionLimiter = createRateLimiter({
  name: 'confirmation-decision',
  windowMs: 60_000,
  maxRequests: 30,
  key: (req) => req.user?.userId ?? req.ip ?? 'anonymous',
});

/**
 * GET /confirmations/pending?conversationId=...
 *
 * Lists the caller's unexpired pending confirmations so the webapp can
 * rehydrate approval cards after a page refresh.
 */
router.get('/confirmations/pending', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const conversationId = typeof req.query['conversationId'] === 'string'
      ? req.query['conversationId']
      : undefined;
    const actions = await listPendingActions(userId, conversationId);
    res.json({ actions });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown' } },
      'Failed to list pending confirmations',
    );
    res.status(500).json({ error: 'Failed to list pending confirmations' });
  }
});

/**
 * POST /confirmations/:actionId/approve
 *
 * Executes a pending write operation after user confirmation.
 * For destructive operations, requires `typedConfirmation` matching the operation name (e.g., "DELETE", "ARCHIVE").
 */
router.post('/confirmations/:actionId/approve', requireAuth, decisionLimiter, async (req, res) => {
  try {
    const actionId = req.params['actionId'] as string;
    const userId = req.user!.userId;
    const { typedConfirmation } = req.body as { typedConfirmation?: string };

    const action = await consumePendingAction(actionId, userId);
    if (!action) {
      res.status(404).json({ error: 'Action not found or expired' });
      return;
    }

    // Safety check: junior users cannot execute directly — route to approval queue
    const userRole = req.user!.role;
    if (userRole && isValidRole(userRole) && hasPermission(userRole, 'requiresApproval')) {
      logger.info(
        { actionId, toolName: action.toolName, userId, role: userRole, requestId: req.requestId },
        'Junior user confirmation routed to approval queue',
      );

      const approvalId = await submitForApproval(userId, action, action.conversationId);

      logRequestAuditEvent(req, 'confirmation_routed_to_approval', action.conversationId, {
        actionId,
        approvalId,
        toolName: action.toolName,
        riskLevel: action.riskLevel,
      });

      res.json({
        actionId,
        status: 'submitted_for_approval',
        approvalId,
        message: 'Your request has been submitted for approval by a senior team member.',
      });
      return;
    }

    // Destructive operations require typing the operation name to confirm
    if (action.riskLevel === 'destructive') {
      const expectedPhrase = action.preview.operation.toUpperCase();
      if (!typedConfirmation || typedConfirmation !== expectedPhrase) {
        res.status(400).json({ error: `Type "${expectedPhrase}" to confirm this action` });
        return;
      }
    }

    logger.info(
      { actionId, toolName: action.toolName, userId, riskLevel: action.riskLevel, requestId: req.requestId },
      'Executing confirmed action',
    );

    // Audit: user approved a confirmation
    logRequestAuditEvent(req, 'confirmation_approved', action.conversationId, {
      actionId,
      toolName: action.toolName,
      riskLevel: action.riskLevel,
    });

    const toolResult = await executeTool(action.toolName, action.toolInput, action.userId, action.conversationId);

    // Trafficking QA — the write executed here is the tail of the chat turn that
    // proposed it. Advisory only: a QA failure never affects the approval outcome.
    let qaReport: QARunReport | null = null;
    if (!toolResult.isError) {
      try {
        const flags = await resolveFlags(action.userId);
        qaReport = await runTurnQa({
          conversationId: action.conversationId, userId: action.userId, flags, trigger: 'auto',
        });
      } catch { /* advisory — never block the approval response */ }
    }

    res.json({
      actionId,
      result: toolResult.result,
      isError: toolResult.isError,
      errorMessage: toolResult.errorMessage,
      ...(qaReport ? { qaReport } : {}),
    });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error executing confirmed action',
    );
    res.status(500).json({ error: 'Failed to execute confirmed action' });
  }
});

/**
 * POST /confirmations/:actionId/reject
 *
 * Marks a pending action as rejected and removes it from the store.
 */
router.post('/confirmations/:actionId/reject', requireAuth, decisionLimiter, async (req, res) => {
  try {
    const actionId = req.params['actionId'] as string;
    const userId = req.user!.userId;

    const action = await consumePendingAction(actionId, userId);
    if (!action) {
      res.status(404).json({ error: 'Action not found or expired' });
      return;
    }

    logger.info(
      { actionId, toolName: action.toolName, userId, requestId: req.requestId },
      'Action rejected by user',
    );

    // Audit: user rejected a confirmation
    logRequestAuditEvent(req, 'confirmation_rejected', action.conversationId, {
      actionId,
      toolName: action.toolName,
      riskLevel: action.riskLevel,
    });

    res.json({ actionId, rejected: true });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error rejecting action',
    );
    res.status(500).json({ error: 'Failed to reject action' });
  }
});

export default router;
