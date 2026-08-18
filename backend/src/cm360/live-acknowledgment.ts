/**
 * Live CM360 connection acknowledgment — single source of truth for the
 * typed-acknowledgment gate on the OAuth connect flow.
 *
 * The live CM360 path is unverified against Google's production API
 * (see DISCLAIMER.md at the repo root). Before the OAuth redirect is
 * allowed, the user must type LIVE_ACK_PHRASE exactly; the acknowledgment
 * is persisted (userId, timestamp, app version, the warning text shown)
 * so the record of what the user saw and accepted survives.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/** The phrase the user must type, character for character. */
export const LIVE_ACK_PHRASE = 'I understand the live CM360 path is unverified';

/**
 * The warning shown in the connect dialog — the key bullets of
 * DISCLAIMER.md. Keep in sync with that file when it changes.
 */
export const LIVE_ACK_WARNING_TEXT = [
  'The live CM360 path is unverified. All 70 tools are fully implemented, but none has been exercised against Google’s production API. Demo/mock mode is the tested and supported experience.',
  'This software writes to systems that control live ad spend. Errors, defects, or unintended agent actions may result in incorrect campaign configuration, misdelivered or wasted media spend, and consequent financial or contractual loss.',
  'Kiki is an LLM agent and is non-deterministic. Write-safety confirmations and post-write QA reduce, but do not eliminate, the risk of unintended actions. Review every proposed change before confirming it.',
  'You are responsible for your own credentials, accounts, and compliance, including all activity and spend under them.',
  'Test against a non-production CM360 network first.',
].join('\n');

/** App version recorded with each acknowledgment (root package.json). */
export function getAppVersion(): string {
  try {
    // backend/src/cm360 -> repo root package.json
    const here = dirname(fileURLToPath(import.meta.url));
    const rootPkg = join(here, '..', '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(rootPkg, 'utf8')) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
