/**
 * Trafficking QA — in-memory recorder of successful writes, keyed by conversation.
 *
 * The executeTool post-success hook records; the end-of-turn trigger drains.
 * Both always happen within the same HTTP request lifecycle, so a process-local
 * Map is replica-safe. Entries older than STALE_MS are dropped defensively.
 */

export interface RecordedWrite {
  toolName: string;
  toolInput: Record<string, unknown>;
  result: unknown;
  recordedAt: number;
}

const STALE_MS = 10 * 60 * 1000;
const pending = new Map<string, RecordedWrite[]>();

/** Drop conversations whose NEWEST record is past the stale window — orphaned
 * turns (mid-stream aborts, crashed requests) must not grow the Map unboundedly. */
function evictStaleConversations(): void {
  const cutoff = Date.now() - STALE_MS;
  for (const [conversationId, list] of pending) {
    const newest = list[list.length - 1];
    if (!newest || newest.recordedAt <= cutoff) pending.delete(conversationId);
  }
}

export function recordQaWrite(conversationId: string, write: RecordedWrite): void {
  evictStaleConversations();
  const list = pending.get(conversationId) ?? [];
  list.push(write);
  pending.set(conversationId, list);
}

/** Test introspection: number of conversations currently held. */
export function pendingConversationCount(): number {
  return pending.size;
}

/** Returns and clears the recorded writes for a conversation, dropping stale entries. */
export function drainQaWrites(conversationId: string): RecordedWrite[] {
  const list = pending.get(conversationId) ?? [];
  pending.delete(conversationId);
  const cutoff = Date.now() - STALE_MS;
  return list.filter((w) => w.recordedAt > cutoff);
}
