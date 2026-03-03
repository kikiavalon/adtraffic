/**
 * Session lifecycle API routes.
 *
 * POST   /sessions/start   — Clear stale cache, log session_started event
 * DELETE /sessions/end      — Clear all session cache, log session_ended event
 * GET    /sessions/status   — Return current cache status
 */

import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { clearSessionCache } from '../cm360/session-cache.js';
import { logAuditEvent } from '../audit/audit-service.js';
import { logger } from '../lib/logger.js';

const router = Router();

const SESSION_CACHE_TTL = parseInt(process.env.SESSION_CACHE_TTL_SECONDS ?? '3600', 10);

/**
 * POST /sessions/start
 *
 * Clears any stale cache entries for the user and logs a session_started audit event.
 * Called by the frontend when the user opens the app or begins a new trafficking session.
 */
router.post('/sessions/start', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;

    await clearSessionCache(userId);

    void logAuditEvent({
      userId,
      eventType: 'session_started',
      metadata: {},
    });

    res.json({ status: 'started', cacheTtlSeconds: SESSION_CACHE_TTL });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error starting session',
    );
    res.status(500).json({ error: 'Failed to start session' });
  }
});

/**
 * DELETE /sessions/end
 *
 * Clears all session cache entries for the user and logs a session_ended audit event.
 * Called by the frontend when the user logs out or navigates away.
 */
router.delete('/sessions/end', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;

    await clearSessionCache(userId);

    void logAuditEvent({
      userId,
      eventType: 'session_ended',
      metadata: {},
    });

    res.json({ status: 'ended' });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error ending session',
    );
    res.status(500).json({ error: 'Failed to end session' });
  }
});

/**
 * GET /sessions/status
 *
 * Returns the current session cache configuration.
 * Simple implementation: always returns active: true (no session start tracking yet).
 */
router.get('/sessions/status', requireAuth, (_req, res) => {
  res.json({ active: true, cacheTtlSeconds: SESSION_CACHE_TTL });
});

export default router;
