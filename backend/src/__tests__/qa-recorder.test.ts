import { randomUUID } from 'crypto';
import { describe, it, expect } from 'vitest';
import { recordQaWrite, drainQaWrites, pendingConversationCount } from '../qa/qa-recorder.js';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';

describe('qa-recorder', () => {
  it('records and drains per conversation', () => {
    recordQaWrite('conv-1', { toolName: 'cm360_update_ad', toolInput: { adId: '1' }, result: null, recordedAt: Date.now() });
    recordQaWrite('conv-2', { toolName: 'cm360_create_ad', toolInput: {}, result: null, recordedAt: Date.now() });
    const drained = drainQaWrites('conv-1');
    expect(drained.length).toBe(1);
    expect(drained[0]!.toolName).toBe('cm360_update_ad');
    expect(drainQaWrites('conv-1')).toEqual([]);       // drain empties
    expect(drainQaWrites('conv-2').length).toBe(1);    // isolation
  });

  it('drops stale entries older than 10 minutes', () => {
    recordQaWrite('conv-stale', { toolName: 'cm360_update_ad', toolInput: {}, result: null, recordedAt: Date.now() - 11 * 60 * 1000 });
    expect(drainQaWrites('conv-stale')).toEqual([]);
  });

  it('evicts orphaned conversations from the map on the next record (no unbounded growth)', () => {
    recordQaWrite('conv-orphan', { toolName: 'cm360_update_ad', toolInput: {}, result: null, recordedAt: Date.now() - 11 * 60 * 1000 });
    recordQaWrite('conv-live', { toolName: 'cm360_update_ad', toolInput: {}, result: null, recordedAt: Date.now() });
    expect(pendingConversationCount()).toBe(1); // conv-orphan evicted, conv-live kept
    drainQaWrites('conv-live'); // clean up for other tests
  });
});

describe('executeTool QA recording hook', () => {
  it('records a successful mutating tool call for the conversation', async () => {
    const conversationId = `conv-${randomUUID()}`;
    const ad = mockStore.listAds()[0]!;
    const result = await executeTool(
      'cm360_update_ad',
      { profileId: 'p', adId: ad.id, name: ad.name },
      randomUUID(), // userId present → real path → NotConnected → mock fallback
      conversationId,
    );
    expect(result.isError).toBe(false);
    const drained = drainQaWrites(conversationId);
    expect(drained.length).toBe(1);
    expect(drained[0]!.toolName).toBe('cm360_update_ad');
  });

  it('does not record read tools', async () => {
    const conversationId = `conv-${randomUUID()}`;
    await executeTool('cm360_list_ads', { profileId: 'p' }, randomUUID(), conversationId);
    expect(drainQaWrites(conversationId)).toEqual([]);
  });

  it('does not record failed writes', async () => {
    const conversationId = `conv-${randomUUID()}`;
    await executeTool('cm360_update_ad', { profileId: 'p', adId: 'no-such-ad', name: 'x' }, randomUUID(), conversationId);
    expect(drainQaWrites(conversationId)).toEqual([]);
  });
});
