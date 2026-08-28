import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Clean-boot guarantee — the demo's first impression must be pristine.
 *
 * A non-technical user running the app in DEMO_MODE must never see error-level
 * logs or connection noise. This is the regression guard for the demo-mode
 * Redis bug: initRedis() ran even in DEMO_MODE, so a machine with no Redis
 * dialed localhost:6379 and printed red ECONNREFUSED errors that read as a
 * crash (the tester's log ended exactly there).
 *
 * It spawns the REAL entry point as a child process — outside vitest's
 * NODE_ENV=test, so the true boot path runs — with Redis pointed at a dead
 * port to simulate a machine with no Redis, and asserts the boot output is
 * clean.
 */

const testDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(testDir, '..', '..'); // .../backend
const entry = path.join(backendRoot, 'src', 'index.ts');

const BOOT_MARKER = 'AdTraffic.ai backend started';

function bootDemoAndCaptureOutput(): Promise<string> {
  return new Promise((resolve, reject) => {
    // High random port so parallel/other work never collides.
    const port = 20000 + Math.floor(Math.random() * 20000);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DEMO_MODE: 'true',
      NODE_ENV: 'development', // NOT 'test' — exercise the real boot + pretty logs
      PORT: String(port),
      JWT_SECRET: 'clean-boot-test-secret-ignore-000000000000000000',
      // Dead port → simulates a machine with no Redis (the tester's situation).
      REDIS_URL: 'redis://127.0.0.1:6399',
      // Keep the test hermetic: never emit a real telemetry event.
      POSTHOG_KEY: '',
    };

    // Run via the same node that runs vitest, with tsx as a loader — no reliance
    // on PATH or shell. tsx resolves from the workspace node_modules.
    const child = spawn(process.execPath, ['--import', 'tsx', entry], {
      cwd: backendRoot,
      env,
      detached: true, // own process group → kill any forked children on teardown
    });

    let output = '';
    let settled = false;
    const collect = (buf: Buffer) => {
      output += buf.toString();
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);

    const finish = (err: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimeout);
      clearInterval(poll);
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL'); // kill the group
      } catch {
        /* already gone */
      }
      if (err) reject(err);
      else resolve(output);
    };

    const hardTimeout = setTimeout(
      () => finish(new Error(`Backend did not boot within 20s. Output so far:\n${output}`)),
      20_000,
    );

    // Once booted, collect a grace window so any immediate async connection
    // errors (which fire ~instantly on a closed local port) are captured too.
    const poll = setInterval(() => {
      if (!settled && output.includes(BOOT_MARKER)) {
        clearInterval(poll);
        setTimeout(() => finish(null), 2500);
      }
    }, 100);

    child.on('error', (err) => finish(err));
    child.on('exit', (code) => {
      if (!settled && !output.includes(BOOT_MARKER)) {
        finish(new Error(`Backend exited early (code ${code}). Output:\n${output}`));
      }
    });
  });
}

describe('DEMO_MODE clean boot', () => {
  it(
    'boots with no error-level logs or Redis connection noise',
    async () => {
      const output = await bootDemoAndCaptureOutput();

      // Sanity: it actually reached "started" (a crash would also be "clean").
      expect(output).toContain(BOOT_MARKER);

      // The bug: red ERROR / connection noise on a machine with no Redis.
      expect(output).not.toMatch(/ERROR|FATAL/);
      expect(output).not.toMatch(/ECONNREFUSED|Redis reconnecting|max retries exceeded/);

      // Intended behavior: demo mode skips Redis with one calm notice.
      expect(output).toMatch(/Redis skipped \(DEMO_MODE\)/i);
    },
    30_000,
  );
});
