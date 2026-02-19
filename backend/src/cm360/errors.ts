/**
 * Custom error classes for CM360 API integration.
 * Used by token-manager.ts, cm360-client.ts, and tool-executor.ts.
 */

/** Thrown when a user attempts a CM360 operation without having connected their account. */
export class CM360NotConnectedError extends Error {
  constructor() {
    super('CM360 account not connected. Please connect your account in Settings.');
    this.name = 'CM360NotConnectedError';
  }
}

/** Thrown when a user's refresh token has been revoked or is no longer valid. */
export class CM360TokenRevokedError extends Error {
  constructor() {
    super('Your CM360 access has been revoked. Please reconnect in Settings.');
    this.name = 'CM360TokenRevokedError';
  }
}

/** Wraps a Google API error with a normalized status code and optional error code. */
export class CM360APIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly apiErrorCode?: string,
  ) {
    super(message);
    this.name = 'CM360APIError';
  }
}

/** Shape of a Google API (GaxiosError) error object. */
interface GoogleAPIErrorShape {
  code: number;
  message: string;
  errors?: Array<{ message: string; reason: string }>;
}

/**
 * Type guard: returns true if the value looks like a Google API error.
 * Google SDK throws GaxiosError objects with { code: number, message: string, errors?: [...] }.
 */
export function isGoogleAPIError(err: unknown): err is GoogleAPIErrorShape {
  if (typeof err !== 'object' || err === null) return false;
  const obj = err as Record<string, unknown>;
  return typeof obj.code === 'number' && typeof obj.message === 'string';
}

/**
 * Extract a user-friendly message from a Google API error.
 * Prefers the first specific error detail over the top-level message.
 */
export function extractGoogleErrorMessage(
  err: { message: string; errors?: Array<{ message: string; reason: string }> },
): string {
  const specific = err.errors?.[0]?.message;
  return specific ?? err.message;
}
