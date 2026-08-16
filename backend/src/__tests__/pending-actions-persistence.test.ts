import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import {
  createPendingAction,
  getPendingAction,
  consumePendingAction,
  listPendingActions,
} from '../cm360/pending-actions.js';

async function makeUser(email: string): Promise<string> {
  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash: 'x', name: 'Test' })
    .returning();
  return user!.id;
}

function actionInput(userId: string, conversationId = 'conv-1') {
  return {
    userId,
    conversationId,
    toolName: 'cm360_create_campaign',
    toolInput: { name: 'Test Campaign' },
    description: 'Create a campaign',
    preview: {
      entityType: 'Campaign',
      entityName: 'Test Campaign',
      operation: 'create' as const,
    },
    riskLevel: 'standard' as const,
  };
}

describe('Pending actions — database persistence', () => {
  let userId: string;

  beforeEach(async () => {
    await db.delete(schema.pendingActions);
    await db.delete(schema.approvalQueue);
    await db.delete(schema.auditLogs);
    await db.delete(schema.oauthTokens);
    await db.delete(schema.featureFlagOverrides);
    await db.delete(schema.messages);
    await db.delete(schema.conversations);
    await db.delete(schema.users);
    userId = await makeUser('pending-test@test.com');
  });

  it('persists a created action to the database', async () => {
    const action = await createPendingAction(actionInput(userId));

    const rows = await db.select().from(schema.pendingActions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actionId).toBe(action.actionId);
    expect(rows[0]!.userId).toBe(userId);
  });

  it('retrieves a pending action without consuming it', async () => {
    const action = await createPendingAction(actionInput(userId));

    const first = await getPendingAction(action.actionId, userId);
    const second = await getPendingAction(action.actionId, userId);
    expect(first?.actionId).toBe(action.actionId);
    expect(second?.actionId).toBe(action.actionId);
  });

  it('consuming an action removes it and returns toolInput', async () => {
    const action = await createPendingAction(actionInput(userId));

    const consumed = await consumePendingAction(action.actionId, userId);
    expect(consumed?.toolInput).toEqual({ name: 'Test Campaign' });

    const again = await consumePendingAction(action.actionId, userId);
    expect(again).toBeNull();
  });

  it('does not return actions belonging to another user', async () => {
    const action = await createPendingAction(actionInput(userId));
    const otherId = await makeUser('other@test.com');

    expect(await getPendingAction(action.actionId, otherId)).toBeNull();
    expect(await consumePendingAction(action.actionId, otherId)).toBeNull();
  });

  it('does not return expired actions', async () => {
    const action = await createPendingAction({ ...actionInput(userId), ttlMs: -1000 });
    expect(await getPendingAction(action.actionId, userId)).toBeNull();
  });

  it('lists unexpired pending actions for a conversation', async () => {
    await createPendingAction(actionInput(userId, 'conv-1'));
    await createPendingAction(actionInput(userId, 'conv-1'));
    await createPendingAction(actionInput(userId, 'conv-2'));
    await createPendingAction({ ...actionInput(userId, 'conv-1'), ttlMs: -1000 });

    const conv1 = await listPendingActions(userId, 'conv-1');
    expect(conv1).toHaveLength(2);

    const all = await listPendingActions(userId);
    expect(all).toHaveLength(3);
  });
});
