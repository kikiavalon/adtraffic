import { configExists, writeConfig } from './config-store.js';

/**
 * On the first ever run (no telemetry config), print a one-time disclosure that
 * telemetry exists and is OFF, then persist {consent:false, noticeShown:true}
 * so it never prints again. Sends nothing. Returns whether the notice was shown.
 */
export function maybeShowFirstBootNotice(): boolean {
  if (configExists()) return false;

  console.log(
    '\n─ AdTraffic telemetry ─\n' +
      'AdTraffic collects NO usage data by default. Optional, anonymous telemetry\n' +
      'is available and currently OFF. To enable it (and optionally share your\n' +
      'email + agency so we know which teams find this useful), run:\n' +
      '  npm run telemetry\n' +
      'Details: docs/TELEMETRY.md\n',
  );

  writeConfig({ consent: false, noticeShown: true });
  return true;
}
