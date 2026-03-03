/**
 * Audit logging middleware utility.
 *
 * Provides a lightweight helper to extract common audit fields (userId, IP,
 * userAgent) from Express requests and forward them to logAuditEvent().
 *
 * This is NOT a heavy middleware that wraps every route. The actual audit
 * calls happen inline at each integration point (chat, tool executor,
 * confirmations, rate limiter, usage tracker). This module just provides
 * the convenience function to avoid repeating the extraction logic.
 */

import type { Request } from 'express';
import { logAuditEvent } from '../audit/audit-service.js';
import type { AuditEventType } from '../audit/audit-service.js';

/**
 * Extract common audit fields from an Express request.
 *
 * Returns an object with userId (if authenticated), IP address, and userAgent.
 * If the user is not authenticated, userId is 'anonymous'.
 */
export function extractAuditContext(req: Request): {
  userId: string;
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  return {
    userId: req.user?.userId ?? 'anonymous',
    ipAddress: req.ip ?? req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

/**
 * Log an audit event with context extracted from an Express request.
 *
 * Fire-and-forget: returns void and never throws. Callers should prefix
 * with `void` to avoid unhandled promise warnings.
 *
 * @example
 * void logRequestAuditEvent(req, 'message_sent', conversationId, { messageLength: 42 });
 */
export function logRequestAuditEvent(
  req: Request,
  eventType: AuditEventType,
  conversationId: string | undefined,
  metadata: Record<string, unknown>,
): void {
  const ctx = extractAuditContext(req);

  void logAuditEvent({
    userId: ctx.userId,
    conversationId,
    eventType,
    metadata,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

