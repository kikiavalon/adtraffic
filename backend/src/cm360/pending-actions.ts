import crypto from 'crypto';
import type { PendingAction, ActionPreview, OperationRiskLevel } from '@adtraffic/shared';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface StoredPendingAction extends PendingAction {
  userId: string;
  conversationId: string;
  toolInput: Record<string, unknown>;
}

const store = new Map<string, StoredPendingAction>();

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

export function createPendingAction(input: CreatePendingActionInput): PendingAction {
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

  store.set(action.actionId, action);
  return action;
}

export function getPendingAction(actionId: string, userId: string): PendingAction | null {
  const action = store.get(actionId);
  if (!action) return null;
  if (action.userId !== userId) return null;
  if (Date.now() >= action.expiresAt) {
    store.delete(actionId);
    return null;
  }
  return action;
}

export function consumePendingAction(actionId: string, userId: string): StoredPendingAction | null {
  const action = store.get(actionId);
  if (!action) return null;
  if (action.userId !== userId) return null;
  if (Date.now() >= action.expiresAt) {
    store.delete(actionId);
    return null;
  }
  store.delete(actionId); // one-time use
  return action;
}

export function cleanupExpired(): void {
  store.clear();
}
