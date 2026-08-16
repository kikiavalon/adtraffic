import { describe, it, expect, beforeEach } from 'vitest';
import { createPendingAction, getPendingAction, consumePendingAction, cleanupExpired } from '../cm360/pending-actions.js';

describe('pending-actions', async () => {
  beforeEach(async () => {
    await cleanupExpired(); // clear state
  });

  it('creates and retrieves a pending action', async () => {
    const action = await createPendingAction({
      userId: 'user-1',
      conversationId: 'conv-1',
      toolName: 'cm360_create_campaign',
      toolInput: { advertiserId: '123', name: 'Test Campaign' },
      description: 'Create campaign "Test Campaign" for advertiser 123',
      preview: {
        entityType: 'Campaign',
        entityName: 'Test Campaign',
        operation: 'create',
        fields: [{ field: 'Advertiser', value: '123' }, { field: 'Name', value: 'Test Campaign' }],
      },
      riskLevel: 'standard',
    });

    expect(action.actionId).toBeDefined();
    expect(action.expiresAt).toBeGreaterThan(Date.now());

    const retrieved = await getPendingAction(action.actionId, 'user-1');
    expect(retrieved).toBeDefined();
    expect(retrieved!.toolName).toBe('cm360_create_campaign');
  });

  it('returns null for wrong user (IDOR protection)', async () => {
    const action = await createPendingAction({
      userId: 'user-1',
      conversationId: 'conv-1',
      toolName: 'cm360_create_campaign',
      toolInput: {},
      description: 'test',
      preview: { entityType: 'Campaign', entityName: 'test', operation: 'create' },
      riskLevel: 'standard',
    });

    expect(await getPendingAction(action.actionId, 'user-2')).toBeNull();
  });

  it('consumes a pending action (one-time use)', async () => {
    const action = await createPendingAction({
      userId: 'user-1',
      conversationId: 'conv-1',
      toolName: 'cm360_create_campaign',
      toolInput: { name: 'test' },
      description: 'test',
      preview: { entityType: 'Campaign', entityName: 'test', operation: 'create' },
      riskLevel: 'standard',
    });

    const consumed = await consumePendingAction(action.actionId, 'user-1');
    expect(consumed).toBeDefined();
    expect(consumed!.toolInput).toEqual({ name: 'test' });

    // Second consume returns null (already used)
    expect(await consumePendingAction(action.actionId, 'user-1')).toBeNull();
  });

  it('expires actions after TTL', async () => {
    const action = await createPendingAction({
      userId: 'user-1',
      conversationId: 'conv-1',
      toolName: 'cm360_create_campaign',
      toolInput: {},
      description: 'test',
      preview: { entityType: 'Campaign', entityName: 'test', operation: 'create' },
      riskLevel: 'standard',
      ttlMs: 0, // expire immediately
    });

    // Wait a tick
    const retrieved = await getPendingAction(action.actionId, 'user-1');
    expect(retrieved).toBeNull();
  });
});
