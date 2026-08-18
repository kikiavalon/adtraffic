/**
 * Audit log API routes.
 *
 * GET  /audit/logs          — paginated audit log for authenticated user
 * POST /audit/interactions   — batched frontend interaction events
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { getAuditLog, logAuditEvent, VALID_EVENT_TYPES } from '../audit/audit-service.js';
import type { AuditEventType } from '../audit/audit-service.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { logger } from '../lib/logger.js';

const router = Router();

/** Maximum metadata size per event (4KB) */
const MAX_METADATA_SIZE = 4096;

/** Rate limiter for POST /audit/interactions — 30 requests/min */
const auditInteractionsLimiter = createRateLimiter({
  name: 'audit-interactions',
  windowMs: 60_000,
  maxRequests: 30,
});

/** Zod schema for GET /audit/logs query params */
const AuditLogsQuerySchema = z.object({
  conversationId: z.string().max(255).optional(),
  limit: z.coerce.number().int().optional().default(50),
  offset: z.coerce.number().int().optional().default(0),
});

/** Zod schema for a single interaction event */
const InteractionEventSchema = z.object({
  eventType: z.enum(VALID_EVENT_TYPES as unknown as [string, ...string[]]),
  metadata: z.record(z.unknown()).refine(
    (val) => JSON.stringify(val).length <= MAX_METADATA_SIZE,
    { message: `Metadata must be ${MAX_METADATA_SIZE} bytes or less when serialized` },
  ),
  timestamp: z.number(),
  conversationId: z.string().max(255).optional(),
  sessionId: z.string().max(255).optional(),
});

/** Zod schema for POST /audit/interactions body */
const InteractionBatchSchema = z.object({
  events: z.array(InteractionEventSchema).min(1).max(100),
});

/**
 * GET /audit/logs
 *
 * Returns paginated audit log entries for the authenticated user.
 * Optionally filters by conversationId.
 */
router.get('/audit/logs', requireAuth, async (req, res) => {
  try {
    const parsed = AuditLogsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: `Invalid query parameters: ${parsed.error.issues.map(i => i.message).join(', ')}` });
      return;
    }

    const { conversationId } = parsed.data;
    const limit = Math.max(1, Math.min(250, parsed.data.limit));
    const offset = Math.max(0, parsed.data.offset);
    const userId = req.user!.userId;

    const logs = await getAuditLog(userId, { conversationId, limit, offset });

    res.json({ logs, limit, offset });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error fetching audit logs',
    );
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * POST /audit/interactions
 *
 * Receives batched frontend interaction events and stores them in the audit log.
 * Fire-and-forget: responds immediately without waiting for all DB writes.
 *
 * Rate limited: 30 requests/min per IP.
 */
router.post('/audit/interactions', requireAuth, auditInteractionsLimiter, (req, res) => {
  try {
    const parsed = InteractionBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: `Invalid request body: ${parsed.error.issues.map(i => i.message).join(', ')}` });
      return;
    }

    const { events } = parsed.data;
    const userId = req.user!.userId;
    const ipAddress = req.ip ?? req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Fire-and-forget: dispatch all log writes without awaiting them
    for (const event of events) {
      void logAuditEvent({
        userId,
        eventType: event.eventType as AuditEventType,
        metadata: { ...event.metadata, clientTimestamp: event.timestamp },
        conversationId: event.conversationId,
        sessionId: event.sessionId,
        ipAddress,
        userAgent,
      });
    }

    res.json({ received: events.length });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error processing interaction events',
    );
    res.status(500).json({ error: 'Failed to process interaction events' });
  }
});

export default router;
