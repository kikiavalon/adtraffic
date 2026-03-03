/**
 * Frontend interaction tracker for audit events.
 *
 * Buffers interaction events and periodically flushes them to the
 * backend audit endpoint (POST /api/v1/audit/interactions) in batches.
 * All operations are fire-and-forget — the tracker never blocks the UI
 * or throws errors to callers.
 */

const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const FLUSH_INTERVAL = 5_000; // 5 seconds

interface InteractionEvent {
  eventType: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}

type AuthFetchFn = (url: string, options?: RequestInit) => Promise<Response>;

let buffer: InteractionEvent[] = [];
let registeredAuthFetch: AuthFetchFn | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Track a user interaction event.
 * Events are buffered and sent in batches — this call is synchronous and instant.
 */
export function trackInteraction(eventType: string, metadata: Record<string, unknown>): void {
  buffer.push({ eventType, metadata, timestamp: Date.now() });
}

/**
 * Flush all buffered events to the backend.
 * Fire-and-forget: never throws, never blocks the UI.
 */
export function flushInteractions(): void {
  if (buffer.length === 0) return;
  if (!registeredAuthFetch) return;

  const events = [...buffer];
  buffer = [];

  // Fire-and-forget — don't await, catch all errors silently
  void registeredAuthFetch(`${API_URL}/api/v1/audit/interactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  }).catch(() => {
    // Silently swallow errors — tracking must never crash the app
  });
}

/**
 * Register the authenticated fetch function.
 * Must be called before flush will work (typically in a useEffect in Chat.tsx).
 */
export function setAuthFetch(fetchFn: AuthFetchFn): void {
  registeredAuthFetch = fetchFn;
}

/**
 * Get the current number of buffered events (for testing).
 */
export function getBufferSize(): number {
  return buffer.length;
}

/**
 * Reset the tracker state (for testing).
 * Clears the buffer, authFetch reference, and auto-flush timer.
 */
export function resetTracker(): void {
  buffer = [];
  registeredAuthFetch = null;
  if (flushTimer !== null) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/**
 * Start the auto-flush interval timer.
 * Call once on app initialization. Returns a cleanup function.
 *
 * Note: visibilitychange handling (session_ended + flush) lives in Chat.tsx,
 * not here, to avoid duplicate listeners.
 */
export function startAutoFlush(): () => void {
  // Periodic flush every 5 seconds
  flushTimer = setInterval(() => {
    flushInteractions();
  }, FLUSH_INTERVAL);

  // Return cleanup function
  return () => {
    if (flushTimer !== null) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  };
}
