import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import type { PendingAction } from '@adtraffic/shared';

export interface ApprovalItem {
  id: string;
  requesterId: string;
  conversationId: string | null;
  actionPayload: PendingAction;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  executionResult: ApprovalExecutionResult | null;
  note: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

/** Outcome of executing an approved action, stored on the approval row */
export interface ApprovalExecutionResult {
  result: unknown;
  isError: boolean;
  errorMessage?: string;
  executedAt: string;
}

/** Submit a junior user's write operation for approval. Returns the approval queue ID. */
export async function submitForApproval(requesterId: string, action: PendingAction, conversationId?: string): Promise<string> {
  const result = await db.insert(schema.approvalQueue).values({
    requesterId,
    conversationId: conversationId ?? null,
    actionPayload: JSON.stringify(action),
  }).returning({ id: schema.approvalQueue.id });

  const inserted = result[0];
  if (!inserted) throw new Error('Failed to insert approval request');
  return inserted.id;
}

/** Get all pending approvals for senior/admin users to review. */
export async function getPendingApprovals(approverId?: string): Promise<ApprovalItem[]> {
  // approverId is accepted for future filtering (e.g., supervisor hierarchy).
  // Currently returns all pending items — authorization is enforced at the API layer
  // via requirePermission('canApproveOthers').
  void approverId;
  const rows = await db.select().from(schema.approvalQueue)
    .where(eq(schema.approvalQueue.status, 'pending'))
    .orderBy(schema.approvalQueue.createdAt);

  return rows.map(mapRow);
}

/** Approve a pending request. */
export async function approveRequest(approvalId: string, approverId: string, note?: string): Promise<void> {
  const result = await db.update(schema.approvalQueue)
    .set({
      status: 'approved' as const,
      approverId,
      note: note ?? null,
      resolvedAt: new Date(),
    })
    .where(and(
      eq(schema.approvalQueue.id, approvalId),
      eq(schema.approvalQueue.status, 'pending'),
    ))
    .returning({ id: schema.approvalQueue.id });

  if (result.length === 0) {
    throw new Error('Approval request not found or already resolved');
  }
}

/** Record the outcome of executing an approved action on its queue row. */
export async function recordExecutionResult(approvalId: string, execution: ApprovalExecutionResult): Promise<void> {
  await db.update(schema.approvalQueue)
    .set({ executionResult: JSON.stringify(execution) })
    .where(eq(schema.approvalQueue.id, approvalId));
}

/** Get a single approval queue entry by ID. Returns null if not found. */
export async function getApprovalById(approvalId: string): Promise<ApprovalItem | null> {
  const rows = await db.select().from(schema.approvalQueue)
    .where(eq(schema.approvalQueue.id, approvalId));
  const row = rows[0];
  if (!row) return null;
  return mapRow(row);
}

/** Get approval requests submitted by a specific user. */
export async function getMyRequests(requesterId: string, statusFilter?: string): Promise<ApprovalItem[]> {
  const conditions = [eq(schema.approvalQueue.requesterId, requesterId)];
  if (statusFilter) {
    conditions.push(eq(schema.approvalQueue.status, statusFilter as 'pending' | 'approved' | 'rejected' | 'expired'));
  }
  const rows = await db.select().from(schema.approvalQueue)
    .where(and(...conditions))
    .orderBy(schema.approvalQueue.createdAt);
  return rows.map(mapRow);
}

/** Reject a pending request. */
export async function rejectRequest(approvalId: string, approverId: string, note?: string): Promise<void> {
  const result = await db.update(schema.approvalQueue)
    .set({
      status: 'rejected' as const,
      approverId,
      note: note ?? null,
      resolvedAt: new Date(),
    })
    .where(and(
      eq(schema.approvalQueue.id, approvalId),
      eq(schema.approvalQueue.status, 'pending'),
    ))
    .returning({ id: schema.approvalQueue.id });

  if (result.length === 0) {
    throw new Error('Approval request not found or already resolved');
  }
}

function mapRow(row: typeof schema.approvalQueue.$inferSelect): ApprovalItem {
  let actionPayload: PendingAction;
  try {
    actionPayload = JSON.parse(row.actionPayload) as PendingAction;
  } catch {
    throw new Error(`Corrupted actionPayload in approval queue row ${row.id}`);
  }
  let executionResult: ApprovalExecutionResult | null = null;
  if (row.executionResult) {
    try {
      executionResult = JSON.parse(row.executionResult) as ApprovalExecutionResult;
    } catch {
      // A corrupted execution record shouldn't make the whole row unreadable
      executionResult = null;
    }
  }
  return {
    id: row.id,
    requesterId: row.requesterId,
    conversationId: row.conversationId,
    actionPayload,
    status: row.status,
    executionResult,
    note: row.note,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  };
}
