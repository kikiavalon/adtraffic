/**
 * Telemetry destination. The PostHog *project* key is write-only and safe to
 * commit (the same kind of key any website ships in its front-end). It ships
 * real, so anonymous telemetry is armed by default. Override via env vars: set
 * POSTHOG_KEY to an empty value to turn telemetry off, or to a different project
 * key; set POSTHOG_HOST for your region. isTelemetryConfigured() is false only
 * when the key is empty or a placeholder.
 */
export const POSTHOG_KEY = process.env.POSTHOG_KEY ?? 'phc_Amup32zQLXadxFs53ncnAQXCZ4aaPWa37B3JENEru5EV';
export const POSTHOG_HOST = process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com';

/** True only when a real (non-placeholder) PostHog key is present. */
export function isTelemetryConfigured(): boolean {
  return POSTHOG_KEY.length > 0 && !POSTHOG_KEY.includes('PLACEHOLDER');
}
