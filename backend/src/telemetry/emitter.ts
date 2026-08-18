import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PostHog } from 'posthog-node';
import { readConfig } from './config-store.js';
import { POSTHOG_KEY, POSTHOG_HOST, isTelemetryConfigured } from './config.js';
import { logger } from '../lib/logger.js';

function getAppVersion(): string {
  try {
    // backend/src/telemetry -> repo root package.json
    const here = dirname(fileURLToPath(import.meta.url));
    const rootPkg = join(here, '..', '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(rootPkg, 'utf8')) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Awaitable core — used directly by tests. */
export async function emitStartupEventAsync(): Promise<void> {
  try {
    const config = readConfig();
    if (!config || config.consent !== true || !config.installId) return;
    if (!isTelemetryConfigured()) return;

    // Capture the narrowed install id so the async closure below keeps its
    // non-undefined type (TS re-widens optional fields inside nested closures).
    const installId = config.installId;

    const client = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });

    const set =
      config.email || config.agency
        ? {
            $set: {
              ...(config.email ? { email: config.email } : {}),
              ...(config.agency ? { agency: config.agency } : {}),
            },
          }
        : {};

    const send = (async () => {
      client.capture({
        distinctId: installId,
        event: 'app_started',
        properties: {
          appVersion: getAppVersion(),
          nodeVersion: process.version,
          os: process.platform,
          ...set,
        },
      });
      await client.shutdown();
    })();
    // Prevent an unhandled rejection if the timeout wins the race below.
    send.catch(() => undefined);

    // Cap the send at 2s so a hung request can never delay anything (belt-and-
    // suspenders — the caller already fire-and-forgets this whole function).
    await Promise.race([
      send,
      new Promise<void>((resolve) => {
        setTimeout(resolve, 2000).unref();
      }),
    ]);
  } catch (err) {
    logger.debug(
      { err: { message: err instanceof Error ? err.message : 'unknown' } },
      'telemetry emit failed',
    );
  }
}

/** Fire-and-forget wrapper — called from index.ts. Never blocks startup. */
export function emitStartupEvent(): void {
  void emitStartupEventAsync();
}
