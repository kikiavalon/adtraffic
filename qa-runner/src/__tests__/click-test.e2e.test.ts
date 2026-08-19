import { existsSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium } from 'playwright';
import type { QAClickTestJob } from '@adtraffic/shared';
import { runClickTest } from '../click-test.js';
import { startFixtureServer, type FixtureServer } from './fixture-server.js';

function browsersAvailable(): boolean {
  try { return existsSync(chromium.executablePath()); } catch { return false; }
}

const LOCAL = ['localhost', '127.0.0.1'];

// Skips cleanly when browsers are missing — install with: npx playwright install chromium
describe.skipIf(!browsersAvailable())('runClickTest against local fixtures', () => {
  let fx: FixtureServer;
  beforeAll(async () => { fx = await startFixtureServer(); });
  afterAll(async () => { await fx.close(); });

  function job(path: string, overrides: Partial<QAClickTestJob> = {}): QAClickTestJob {
    return {
      runId: 'run-e2e', adId: '9001',
      clickUrl: `${fx.baseUrl}${path}`,
      expectedUrl: `${fx.baseUrl}/landing?utm_source=cm360&utm_medium=display&utm_campaign=fixture`,
      expectedFirstHopPattern: `^${fx.baseUrl.replace(/[.:/]/g, '\\$&')}${path.replace(/[.:/]/g, '\\$&')}`,
      allowInsecureHosts: LOCAL,
      ...overrides,
    };
  }

  it('blocks a click-through to a host that is not allowlisted (SSRF egress guard)', async () => {
    // Same local fixture, but the runner is NOT told to trust it — mirrors the
    // live path, where a user-controlled click-through resolves to an internal
    // address. The egress guard must abort the fetch so the chain never reaches
    // the target.
    const result = await runClickTest(job('/click', { allowInsecureHosts: [] }), { settleMs: 800 });
    const summary = result.checks.find((c) => c.checkKey.startsWith('clickthrough.click_test'));
    expect(summary?.status).toBe('fail');
  }, 30_000);

  it('traces a 302 chain end-to-end with evidence', async () => {
    const result = await runClickTest(job('/click'), { settleMs: 800 });
    const summary = result.checks.find((c) => c.checkKey === 'clickthrough.click_test.ad:9001');
    expect(summary?.status).toBe('pass');
    const chain = (summary?.detail as { chain: Array<{ via: string }> }).chain;
    expect(chain.map((h) => h.via)).toEqual(['click', 'http_3xx', 'http_3xx']);
    expect(result.evidence?.contentType).toBe('image/png');
    expect(result.evidence!.dataBase64.length).toBeGreaterThan(1000);
  }, 30_000);

  it('classifies meta-refresh and JS redirects', async () => {
    const meta = await runClickTest(job('/meta'), { settleMs: 800 });
    const metaChain = (meta.checks.find((c) => c.checkKey.startsWith('clickthrough.click_test'))!.detail as { chain: Array<{ via: string }> }).chain;
    expect(metaChain.map((h) => h.via)).toContain('meta_refresh');

    const js = await runClickTest(job('/js'), { settleMs: 800 });
    const jsChain = (js.checks.find((c) => c.checkKey.startsWith('clickthrough.click_test'))!.detail as { chain: Array<{ via: string }> }).chain;
    expect(jsChain.map((h) => h.via)).toContain('js');
  }, 45_000);

  it('a redirect loop hits the 20-hop cap and fails chain_length', async () => {
    // Deterministic either way: Chromium may abort the loop itself with
    // ERR_TOO_MANY_REDIRECTS before 20 events land — buildChainTrace treats
    // that error as truncatedAtCap, so chain_length fails in both paths.
    const result = await runClickTest(job('/loop'), { settleMs: 800 });
    expect(result.checks.find((c) => c.checkKey.startsWith('clickthrough.chain_length'))?.status).toBe('fail');
    expect(result.checks.find((c) => c.checkKey.startsWith('clickthrough.click_test'))?.status).toBe('fail');
  }, 45_000);

  it('a blank landing page fails landing.renders', async () => {
    const result = await runClickTest(job('/blank', { expectedUrl: `${fx.baseUrl}/blank` }), { settleMs: 800 });
    expect(result.checks.find((c) => c.checkKey.startsWith('landing.renders'))?.status).toBe('fail');
  }, 30_000);

  it('a 404 landing fails landing.http_status', async () => {
    const result = await runClickTest(job('/missing', { expectedUrl: `${fx.baseUrl}/missing` }), { settleMs: 800 });
    expect(result.checks.find((c) => c.checkKey.startsWith('landing.http_status'))?.status).toBe('fail');
  }, 30_000);
});
