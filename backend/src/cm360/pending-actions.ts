import crypto from 'crypto';
import { and, eq, lt } from 'drizzle-orm';
import type { PendingAction, ActionPreview, OperationRiskLevel } from '@adtraffic/shared';
import { db } from '../db/index.js';
import { pendingActions } from '../db/schema.js';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface StoredPendingAction extends PendingAction {
  userId: string;
  conversationId: string;
  toolInput: Record<string, unknown>;
}

interface CreatePendingActionInput {
  userId: string;
  conversationId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  description: string;
  preview: ActionPreview;
  riskLevel: OperationRiskLevel;
  ttlMs?: number;
}

/**
 * Store for in-flight write confirmations.
 *
 * Persistence matters here: pending approvals must survive page refreshes,
 * backend restarts, and requests landing on a different replica. A write
 * gate that silently forgets what it was gating is worse than none.
 *
 * Database-backed when PostgreSQL is available; falls back to an in-memory
 * map in DEMO_MODE (which runs without PostgreSQL) or when the insert fails
 * (e.g. a userId with no users row, as in the behavioral test harness).
 */
const memoryStore = new Map<string, StoredPendingAction>();

function dbEnabled(): boolean {
  return process.env.DEMO_MODE !== 'true';
}

export async function createPendingAction(input: CreatePendingActionInput): Promise<PendingAction> {
  const now = Date.now();
  const ttl = input.ttlMs ?? DEFAULT_TTL_MS;

  const action: StoredPendingAction = {
    actionId: crypto.randomUUID(),
    toolName: input.toolName,
    description: input.description,
    preview: input.preview,
    riskLevel: input.riskLevel,
    proposedAt: now,
    expiresAt: now + ttl,
    userId: input.userId,
    conversationId: input.conversationId,
    toolInput: input.toolInput,
  };

  if (dbEnabled()) {
    try {
      await db.insert(pendingActions).values({
        actionId: action.actionId,
        userId: input.userId,
        conversationId: input.conversationId,
        payload: JSON.stringify(action),
        expiresAt: new Date(action.expiresAt),
      });
      return action;
    } catch { /* fall through to memory */ }
  }
  memoryStore.set(action.actionId, action);
  return action;
}

function getFromMemory(actionId: string, userId: string, consume: boolean): StoredPendingAction | null {
  const action = memoryStore.get(actionId);
  if (!action) return null;
  if (action.userId !== userId) return null;
  if (Date.now() >= action.expiresAt) {
    memoryStore.delete(actionId);
    return null;
  }
  if (consume) memoryStore.delete(actionId);
  return action;
}

function parseRow(payload: string): StoredPendingAction | null {
  try {
    return JSON.parse(payload) as StoredPendingAction;
  } catch {
    return null;
  }
}

export async function getPendingAction(actionId: string, userId: string): Promise<PendingAction | null> {
  if (memoryStore.has(actionId)) return getFromMemory(actionId, userId, false);
  if (!dbEnabled()) return null;
  try {
    const rows = await db
      .select()
      .from(pendingActions)
      .where(and(eq(pendingActions.actionId, actionId), eq(pendingActions.userId, userId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) {
      await db.delete(pendingActions).where(eq(pendingActions.actionId, actionId));
      return null;
    }
    return parseRow(row.payload);
  } catch {
    return null;
  }
}

export async function consumePendingAction(actionId: string, userId: string): Promise<StoredPendingAction | null> {
  if (memoryStore.has(actionId)) return getFromMemory(actionId, userId, true);
  if (!dbEnabled()) return null;
  try {
    // Atomic one-time consume: the DELETE ... RETURNING guarantees only one
    // caller (or replica) can execute a given approval
    const rows = await db
      .delete(pendingActions)
      .where(and(eq(pendingActions.actionId, actionId), eq(pendingActions.userId, userId)))
      .returning();
    const row = rows[0];
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    return parseRow(row.payload);
  } catch {
    return null;
  }
}

/** List unexpired pending actions for a user, optionally scoped to one conversation. */
export async function listPendingActions(userId: string, conversationId?: string): Promise<PendingAction[]> {
  const now = Date.now();
  const fromMemory = [...memoryStore.values()].filter(
    (a) => a.userId === userId && a.expiresAt > now && (!conversationId || a.conversationId === conversationId),
  );
  if (!dbEnabled()) return fromMemory;
  try {
    const rows = await db
      .select()
      .from(pendingActions)
      .where(
        conversationId
          ? and(eq(pendingActions.userId, userId), eq(pendingActions.conversationId, conversationId))
          : eq(pendingActions.userId, userId),
      );
    const fromDb = rows
      .filter((row) => row.expiresAt.getTime() > now)
      .map((row) => parseRow(row.payload))
      .filter((a): a is StoredPendingAction => a !== null);
    return [...fromDb, ...fromMemory];
  } catch {
    return fromMemory;
  }
}

export async function cleanupExpired(): Promise<void> {
  const now = Date.now();
  for (const [id, action] of memoryStore) {
    if (action.expiresAt <= now) memoryStore.delete(id);
  }
  if (!dbEnabled()) return;
  try {
    await db.delete(pendingActions).where(lt(pendingActions.expiresAt, new Date()));
  } catch { /* best effort */ }
}
