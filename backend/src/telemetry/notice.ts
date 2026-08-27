import { stdin } from 'process';
import { configExists, readConfig, writeConfig, buildConsentConfig } from './config-store.js';
import { runInteractiveSetup } from './cli.js';

/**
 * Non-interactive first-boot path: print a one-time disclosure that anonymous
 * telemetry is ON by default (with a one-command opt-out), then persist a
 * default-ON config (consent + install id) so it never prints again. Only
 * anonymous data is ever sent; email/agency are added only via `npm run
 * telemetry`. Returns whether the notice was shown.
 */
export function showHeadlessNotice(): boolean {
  if (configExists()) return false;

  console.log(
    '\n─ AdTraffic telemetry ─\n' +
      'Anonymous usage telemetry is ON. On each start AdTraffic sends only an install\n' +
      'id + app/Node version + OS — never your chat, CM360 data, or credentials.\n' +
      'To turn it off, or to add your email + agency so we can reach out, run:\n' +
      '  npm run telemetry\n' +
      'Details: docs/TELEMETRY.md\n',
  );

  writeConfig(buildConsentConfig({ enable: true }, readConfig()));
  return true;
}

/**
 * First-run entry point, called once at backend boot. If a human is at the
 * terminal (a real TTY, outside CI) we show the interactive prompt so they can
 * add their email/agency or opt out; otherwise — Docker, CI, a headless server,
 * a second replica — we fall back to the non-blocking default-ON notice so boot
 * is never held waiting for input that will never come. No-op once configured.
 */
export async function runFirstRun(deps?: {
  isTTY?: boolean;
  isCI?: boolean;
  interactiveSetup?: () => Promise<void>;
}): Promise<'prompted' | 'notice' | 'skipped'> {
  if (configExists()) return 'skipped';

  const isTTY = deps?.isTTY ?? Boolean(stdin.isTTY);
  const isCI = deps?.isCI ?? process.env.CI === 'true';

  if (isTTY && !isCI) {
    const setup = deps?.interactiveSetup ?? runInteractiveSetup;
    await setup();
    return 'prompted';
  }

  showHeadlessNotice();
  return 'notice';
}
