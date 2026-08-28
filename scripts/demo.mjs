#!/usr/bin/env node
/*
 * AdTraffic — friendly demo runner (macOS / Windows / Linux).
 *
 * Turns the raw toolchain into a calm, non-technical experience:
 *   Installing AdTraffic...  ->  Preparing...  ->  Launching demo...  ->  browser opens
 *
 * All npm/build/server output is redirected to a log file the user never sees
 * unless something fails. Uses Node builtins ONLY — it runs before the first
 * `npm install`, so it must not import anything from node_modules.
 *
 * Invoked two ways:
 *   - `npm run demo`            (someone who already has the repo)
 *   - by install.sh / install.ps1 after they fetch Node + the code
 */
import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createWriteStream, mkdirSync } from 'node:fs';
import { createServer } from 'node:net';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = platform() === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const WEBAPP_URL = 'http://localhost:5173';
const BACKEND_PORT = 3001;
const WEBAPP_PORT = 5173;
const LAUNCH_TIMEOUT_MS = 90_000;

// One log file, overwritten each run. Only surfaced if a step fails.
const logDir = join(repoRoot, '.demo-logs');
mkdirSync(logDir, { recursive: true });
const logPath = join(logDir, 'demo.log');
const log = createWriteStream(logPath, { flags: 'w' });

const useSpinner = Boolean(process.stdout.isTTY);
const SPIN = ['|', '/', '-', '\\'];

function line(msg = '') {
  process.stdout.write(msg + '\n');
}

function banner() {
  line();
  line('  ────────────────────────────────');
  line('     AdTraffic — Demo');
  line('  ────────────────────────────────');
  line();
}

/** Run one command quietly with a labeled spinner; reject with a friendly error. */
function runStep(label, cmd, args) {
  return new Promise((resolve, reject) => {
    let spin;
    if (useSpinner) {
      let i = 0;
      process.stdout.write(`  ${SPIN[0]} ${label}... `);
      spin = setInterval(() => {
        i = (i + 1) % SPIN.length;
        process.stdout.write(`\r  ${SPIN[i]} ${label}... `);
      }, 120);
    } else {
      line(`  ${label}...`);
    }

    const child = spawn(cmd, args, {
      cwd: repoRoot,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
      // Windows blocks spawning npm.cmd with shell:false (CVE-2024-27980).
      shell: isWin,
    });
    child.stdout.on('data', (b) => log.write(b));
    child.stderr.on('data', (b) => log.write(b));

    child.on('error', (err) => {
      if (spin) clearInterval(spin);
      reject(new Error(`${label} failed to start: ${err.message}`));
    });
    child.on('close', (code) => {
      if (spin) clearInterval(spin);
      if (code === 0) {
        if (useSpinner) process.stdout.write(`\r  ✓ ${label}      \n`);
        else line(`  done: ${label}`);
        resolve();
      } else {
        if (useSpinner) process.stdout.write(`\r  ✗ ${label}      \n`);
        reject(new Error(`${label} exited with code ${code}`));
      }
    });
  });
}

function openBrowser(url) {
  try {
    const [cmd, args] =
      platform() === 'darwin'
        ? ['open', [url]]
        : isWin
          ? ['cmd', ['/c', 'start', '', url]]
          : ['xdg-open', [url]];
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true, shell: false });
    child.on('error', () => {}); // best-effort; the URL is printed regardless
    child.unref();
  } catch {
    /* best-effort */
  }
}

/** Resolve true if a TCP port is free on localhost, false if something holds it. */
function portFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

function alreadyRunning() {
  line();
  line('  It looks like AdTraffic may already be running (a required port is in use).');
  line(`  First, try opening ${WEBAPP_URL} in your browser.`);
  line('  If that does not work, close any open AdTraffic windows or tabs and run this again.');
  line();
  process.exitCode = 1;
}

function fail(err) {
  line();
  line(`  Something went wrong while getting the demo ready.`);
  line(`  A full log was saved here:`);
  line(`    ${logPath}`);
  line(`  Send that file to the AdTraffic team and we'll sort it out.`);
  line();
  log.write(`\n[demo runner] ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exitCode = 1;
}

async function main() {
  banner();

  await runStep('Installing AdTraffic', npmCmd, [
    'install',
    '--no-audit',
    '--no-fund',
    '--loglevel=error',
  ]);
  await runStep('Preparing', npmCmd, ['run', 'build', '--workspace=shared']);

  // Pre-flight: if either port is busy the servers can't bind and the demo
  // would hang. Catch the common "already running / ran twice" case instantly.
  const [backendFree, webappFree] = await Promise.all([
    portFree(BACKEND_PORT),
    portFree(WEBAPP_PORT),
  ]);
  if (!backendFree || !webappFree) {
    alreadyRunning();
    return;
  }

  line();
  line('  Launching demo...');

  const dev = spawn(npmCmd, ['run', 'dev'], {
    cwd: repoRoot,
    env: { ...process.env, DEMO_MODE: 'true', NODE_NO_WARNINGS: '1' },
    // Windows blocks spawning npm.cmd with shell:false (CVE-2024-27980).
    shell: isWin,
  });

  let opened = false;
  let settled = false;

  // Safety net: never hang forever waiting for the servers to report ready.
  const watchdog = setTimeout(() => {
    if (opened || settled) return;
    settled = true;
    line();
    line('  The demo is taking longer than expected to start.');
    line(`  A full log was saved here:\n    ${logPath}`);
    line('  Send that file to the AdTraffic team and we can help.');
    try {
      dev.kill('SIGINT');
    } catch {
      /* already gone */
    }
    process.exitCode = 1;
  }, LAUNCH_TIMEOUT_MS);

  const ready = () => {
    opened = true;
    clearTimeout(watchdog);
    line();
    line('  ────────────────────────────────');
    line('   ✓ AdTraffic is running!');
    line('  ────────────────────────────────');
    line();
    line(`   Opening ${WEBAPP_URL} in your browser...`);
    line();
    line('   Keep this window open. Close it (or press Ctrl-C) to stop.');
    line();
    openBrowser(WEBAPP_URL);
  };

  const watch = (buf) => {
    const s = buf.toString();
    log.write(s);
    if (!opened && s.includes(`localhost:${WEBAPP_PORT}`)) ready();
  };
  dev.stdout.on('data', watch);
  dev.stderr.on('data', watch);

  dev.on('error', (err) => {
    clearTimeout(watchdog);
    fail(new Error(`Could not launch the demo: ${err.message}`));
  });
  dev.on('close', (code) => {
    clearTimeout(watchdog);
    // A clean Ctrl-C exits the servers; a failure before "ready" is worth flagging.
    if (!opened && !settled && code && code !== 0) {
      fail(new Error(`Demo servers exited with code ${code}`));
    }
    process.exit(process.exitCode ?? code ?? 0);
  });

  const stop = () => {
    try {
      dev.kill('SIGINT');
    } catch {
      /* already gone */
    }
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch(fail);
