import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import { readConfig, writeConfig, buildConsentConfig } from './config-store.js';
import { POSTHOG_HOST } from './config.js';

export function parseYesNo(input: string, defaultValue: boolean): boolean {
  const v = input.trim().toLowerCase();
  if (v === '') return defaultValue;
  return v === 'y' || v === 'yes';
}

/**
 * Interactive telemetry setup. Telemetry is ON by default — this prompt lets a
 * user keep it on (and optionally share email + agency so we can reach out), or
 * turn it off. Reused by `npm run telemetry` and by the first-run boot flow.
 */
export async function runInteractiveSetup(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    console.log('\nAdTraffic — usage telemetry\n');
    console.log('Anonymous telemetry is ON by default. On each backend start AdTraffic sends');
    console.log('ONE event to PostHog:');
    console.log('  • app version, Node version, OS  • a random install id');
    console.log('  • optionally your email + agency (only if you enter them below)');
    console.log('It NEVER sends: chat prompts, CM360 data, credentials, or request contents.');
    console.log(`Destination: ${POSTHOG_HOST}   Details: docs/TELEMETRY.md\n`);

    const enable = parseYesNo(await rl.question('Keep anonymous usage telemetry ON? [Y/n] '), true);
    if (!enable) {
      writeConfig(buildConsentConfig({ enable: false }, readConfig()));
      console.log('\nTelemetry turned OFF. Nothing will be sent. Re-run `npm run telemetry` anytime.\n');
      return;
    }

    const email = (await rl.question('Optional — email (Enter to skip): ')).trim();
    const agency = (await rl.question('Optional — agency name (Enter to skip): ')).trim();

    writeConfig(buildConsentConfig({ enable: true, email, agency }, readConfig()));
    console.log('\nTelemetry ON. Thank you! Re-run `npm run telemetry` to change or turn it off.\n');
  } finally {
    rl.close();
  }
}

// Run only when invoked directly (not when imported by tests or the boot flow).
if (process.argv[1] && process.argv[1].endsWith('cli.ts')) {
  void runInteractiveSetup();
}
