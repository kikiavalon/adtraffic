/**
 * Telemetry destination. The PostHog *project* key is write-only and safe to
 * commit. Until the maintainer pastes a real key, the placeholder makes
 * isTelemetryConfigured() return false, so nothing is ever sent even if a user
 * has opted in. Both values are overridable via env vars for local testing.
 */
export const POSTHOG_KEY = process.env.POSTHOG_KEY ?? 'phc_PLACEHOLDER_REPLACE_ME';
export const POSTHOG_HOST = process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com';

/** True only when a real (non-placeholder) PostHog key is present. */
export function isTelemetryConfigured(): boolean {
  return POSTHOG_KEY.length > 0 && !POSTHOG_KEY.includes('PLACEHOLDER');
}
