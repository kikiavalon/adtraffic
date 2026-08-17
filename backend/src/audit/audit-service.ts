/**
 * Audit logging service for compliance-grade interaction tracking.
 *
 * Every user action, tool execution, and system event is logged to the
 * audit_logs table for enterprise compliance. The audit service:
 *
 * - NEVER crashes the application (fire-and-forget with error logging)
 * - NEVER stores raw IP addresses (SHA-256 hashed, truncated to 16 chars)
 * - Truncates user agent strings to 500 characters
 * - Stores structured metadata as JSON for flexible querying
 */

import crypto from 'node:crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import { logger } from '../lib/logger.js';

/** All supported audit event types — single source of truth */
export const VALID_EVENT_TYPES = [
  'message_sent',          // User sent a chat message
  'message_received',      // Kiki responded
  'tool_proposed',         // Kiki proposed a write tool (confirmation_required)
  'tool_executed',         // Tool was executed (read or approved write)
  'confirmation_approved', // User approved a write operation
  'confirmation_rejected', // User rejected a write operation
  'confirmation_routed_to_approval', // Junior user's write op was routed to approval queue
  'confirmation_typed',    // User typed destructive confirmation text
  'button_clicked',        // User clicked a quick reply button
  'error_occurred',        // An error was encountered
  'session_started',       // User opened a conversation
  'session_ended',         // User closed/navigated away
  'rate_limited',          // User hit rate limit
  'daily_limit_reached',   // User hit daily API limit
  'qa_run_started',        // Trafficking QA run began for a chat turn's writes
  'qa_run_completed',      // Trafficking QA run finished (status in metadata)
] as const;

/** Union type derived from VALID_EVENT_TYPES array */
export type AuditEventType = typeof VALID_EVENT_TYPES[number];

/** Input for logging an audit event */
export interface AuditEntry {
  userId: string;
  conversationId?: string;
  sessionId?: string;
  eventType: AuditEventType;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/** Options for querying the audit log */
export interface AuditLogQueryOptions {
  conversationId?: string;
  limit?: number;
  offset?: number;
}

/** Maximum length for stored user agent strings */
const MAX_USER_AGENT_LENGTH = 500;

/** Length of truncated IP hash (first 16 hex chars of SHA-256) */
const IP_HASH_LENGTH = 16;

/**
 * Hash an IP address using SHA-256 and truncate to 16 hex characters.
 * Returns undefined if no IP is provided.
 *
 * The truncated hash is sufficient for grouping requests by origin
 * without being reversible to the original IP address.
 */
export function hashIp(ip?: string): string | undefined {
  if (!ip) return undefined;
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, IP_HASH_LENGTH);
}

/**
 * Log an audit event to the database.
 *
 * This function is fire-and-forget: if the DB write fails, the error
 * is logged but never thrown. Audit logging must never crash the app.
 */
export async function logAuditEvent(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: entry.userId,
      conversationId: entry.conversationId ?? null,
      sessionId: entry.sessionId ?? null,
      eventType: entry.eventType,
      metadata: JSON.stringify(entry.metadata),
      ipHash: hashIp(entry.ipAddress),
      userAgent: entry.userAgent?.substring(0, MAX_USER_AGENT_LENGTH) ?? null,
    });
  } catch (error) {
    // Audit logging should never crash the app -- log and continue
    logger.error(
      {
        err: error instanceof Error ? { message: error.message } : { message: 'Unknown' },
        eventType: entry.eventType,
        userId: entry.userId,
      },
      'Failed to write audit log',
    );
  }
}

/**
 * Query audit log entries for a user.
 *
 * Always filters by userId (required). Optionally filters by conversationId.
 * Supports pagination via limit (default 50, max 250) and offset (default 0).
 * Results are ordered by createdAt descending (newest first).
 */
export async function getAuditLog(
  userId: string,
  options?: AuditLogQueryOptions,
): Promise<Array<typeof auditLogs.$inferSelect>> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 250);
  const offset = Math.max(options?.offset ?? 0, 0);

  const conditions = [eq(auditLogs.userId, userId)];

  if (options?.conversationId) {
    conditions.push(eq(auditLogs.conversationId, options.conversationId));
  }

  return db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);
}
