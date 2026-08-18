import { randomUUID } from 'crypto';
import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import { readConfig, writeConfig } from './config-store.js';
import { POSTHOG_HOST } from './config.js';

export function parseYesNo(input: string, defaultValue: boolean): boolean {
  const v = input.trim().toLowerCase();
  if (v === '') return defaultValue;
  return v === 'y' || v === 'yes';
}

async function main(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    console.log('\nAdTraffic — optional usage telemetry\n');
    console.log('If enabled, on each backend start AdTraffic sends ONE event to PostHog:');
    console.log('  • app version, Node version, OS  • a random install id');
    console.log('  • optionally your email + agency (only if you enter them below)');
    console.log('It NEVER sends: chat prompts, CM360 data, credentials, or request contents.');
    console.log(`Destination: ${POSTHOG_HOST}   Details: docs/TELEMETRY.md\n`);

    const enable = parseYesNo(await rl.question('Enable anonymous usage telemetry? [y/N] '), false);
    if (!enable) {
      writeConfig({ consent: false, noticeShown: true });
      console.log('\nTelemetry left OFF. Nothing will be sent. Re-run `npm run telemetry` anytime.\n');
      return;
    }

    const email = (await rl.question('Optional — email (Enter to skip): ')).trim();
    const agency = (await rl.question('Optional — agency name (Enter to skip): ')).trim();

    const existing = readConfig();
    writeConfig({
      consent: true,
      noticeShown: true,
      installId: existing?.installId ?? randomUUID(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      ...(email ? { email } : {}),
      ...(agency ? { agency } : {}),
    });

    console.log('\nTelemetry ENABLED. Thank you! Re-run `npm run telemetry` to change or disable.\n');
  } finally {
    rl.close();
  }
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith('cli.ts')) {
  void main();
}
