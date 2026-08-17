import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { hasPermission, isValidRole } from '../auth/roles.js';
import { getEvidence, getRunWithChecks, listRuns, runToReport } from '../qa/qa-store.js';
import { logger } from '../lib/logger.js';

const router = Router();

function callerCanViewOthers(role: string | undefined): boolean {
  return !!role && isValidRole(role) && hasPermission(role, 'canApproveOthers');
}

/**
 * GET /qa/runs — list Trafficking QA runs (own by default).
 * Approvers (canApproveOthers) may pass ?requesterId= to review another
 * planner's runs — same role-gated model as the approval queue.
 */
router.get('/qa/runs', requireAuth, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, parseInt(req.query['limit'] as string, 10) || 20));
    const offset = Math.max(0, parseInt(req.query['offset'] as string, 10) || 0);
    const conversationId = typeof req.query['conversationId'] === 'string' ? req.query['conversationId'] : undefined;
    const requesterId = typeof req.query['requesterId'] === 'string' ? req.query['requesterId'] : undefined;

    let userId = req.user!.userId;
    if (requesterId && requesterId !== userId) {
      if (!callerCanViewOthers(req.user!.role)) {
        res.status(403).json({ error: 'Forbidden: requires canApproveOthers permission to view other users\' QA runs' });
        return;
      }
      userId = requesterId;
    }

    const { runs, total } = await listRuns(userId, { conversationId, limit, offset });
    res.json({
      runs: runs.map((run) => {
        const report = runToReport(run, []);
        const { checks: _checks, ...summary } = report;
        return summary;
      }),
      total,
      pageSize: limit,
      pageOffset: offset,
    });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error listing QA runs',
    );
    res.status(500).json({ error: 'Failed to list QA runs' });
  }
});

/** GET /qa/runs/:id — full report with checks. Own runs, or any run for approvers. */
router.get('/qa/runs/:id', requireAuth, async (req, res) => {
  try {
    const runId = req.params['id'] as string;
    const found = await getRunWithChecks(runId);
    if (!found) {
      res.status(404).json({ error: 'QA run not found' });
      return;
    }
    if (found.run.userId !== req.user!.userId && !callerCanViewOthers(req.user!.role)) {
      // 404 (not 403) — do not leak the existence of other users' runs
      res.status(404).json({ error: 'QA run not found' });
      return;
    }
    res.json({ run: runToReport(found.run, found.checks) });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error fetching QA run',
    );
    res.status(500).json({ error: 'Failed to fetch QA run' });
  }
});

/** GET /qa/runs/:id/evidence/:evidenceId — click-test screenshot bytes.
 * Same RBAC as the run detail; the run in the path must own the evidence.
 * (The report's checks carry evidenceId — checkKeys are not URL-safe.) */
router.get('/qa/runs/:id/evidence/:evidenceId', requireAuth, async (req, res) => {
  try {
    const runId = req.params['id'] as string;
    const evidenceId = req.params['evidenceId'] as string;
    const found = await getRunWithChecks(runId);
    if (!found || (found.run.userId !== req.user!.userId && !callerCanViewOthers(req.user!.role))) {
      res.status(404).json({ error: 'QA run not found' });
      return;
    }
    const evidence = await getEvidence(evidenceId);
    if (!evidence || evidence.runId !== runId) {
      res.status(404).json({ error: 'Evidence not found' });
      return;
    }
    res.setHeader('Content-Type', evidence.contentType);
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(evidence.data);
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error serving QA evidence',
    );
    res.status(500).json({ error: 'Failed to serve QA evidence' });
  }
});

export default router;
