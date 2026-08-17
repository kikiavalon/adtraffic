import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { QAClickTestJob, QAClickTestResult, QATouchedEntity } from '@adtraffic/shared';
import { mockStore } from '../cm360/mock-data-store.js';
import { fetchCampaignContext } from '../qa/click-resolver.js';
import { getDefaultFlags } from '../feature-flags/flag-registry.js';

const mockLoad = vi.fn();
vi.mock('../qa/qa-runner-loader.js', () => ({ loadClickTestRunner: () => mockLoad() }));

const { runClickLayer, MAX_CLICK_TESTS_PER_RUN } = await import('../qa/qa-click.js');

function fakeRunner(): (job: QAClickTestJob) => Promise<QAClickTestResult> {
  return (job) => Promise.resolve({
    runId: job.runId, adId: job.adId,
    checks: [{ checkKey: `clickthrough.click_test.ad:${job.adId}`, category: 'clickthrough', status: 'pass', message: 'ok' }],
    evidence: { contentType: 'image/png', dataBase64: Buffer.from('x').toString('base64'), forCheckKey: `landing.renders.ad:${job.adId}` },
  });
}

async function makeInput(adCount = 1) {
  const campaign = mockStore.listCampaigns()[0]!;
  const ctx = (await fetchCampaignContext('p', campaign.id))!;
  const ads = ctx.ads.slice(0, adCount);
  const touched: QATouchedEntity[] = ads.map((ad) => ({ toolName: 'cm360_update_ad', entityType: 'ad', entityId: ad.id }));
  return {
    runId: randomUUID(),
    profileId: 'p',
    touched,
    ctx,
    userId: randomUUID(),
    conversationId: `conv-${randomUUID()}`,
    flags: { ...getDefaultFlags(), 'qa.enabled': true, 'qa.click_test.enabled': true },
  };
}

beforeEach(() => {
  mockLoad.mockReset();
  delete process.env.DEMO_MODE;
});

describe('runClickLayer gating', () => {
  it('returns nothing when qa.click_test.enabled is off (Phase 1 byte-identical)', async () => {
    const input = await makeInput();
    input.flags = { ...getDefaultFlags(), 'qa.enabled': true };
    expect(await runClickLayer(input)).toEqual({ checks: [], jobs: [] });
  });

  it('returns nothing when the turn touched no ads', async () => {
    const input = await makeInput();
    input.touched = [{ toolName: 'cm360_update_campaign', entityType: 'campaign', entityId: '1' }];
    expect(await runClickLayer(input)).toEqual({ checks: [], jobs: [] });
  });

  it('skips (with note) when there is no campaign context', async () => {
    const input = await makeInput();
    const outcome = await runClickLayer({ ...input, ctx: null });
    expect(outcome.jobs).toEqual([]);
    expect(outcome.checks[0]!.status).toBe('skipped');
  });
});

describe('runClickLayer — DEMO_MODE in-process', () => {
  beforeEach(() => { process.env.DEMO_MODE = 'true'; });

  it('runs the loaded runner and returns real checks synchronously (no jobs)', async () => {
    mockLoad.mockResolvedValue(fakeRunner());
    const input = await makeInput();
    const outcome = await runClickLayer(input);
    expect(outcome.jobs).toEqual([]);
    expect(outcome.checks.some((c) => c.checkKey.startsWith('clickthrough.click_test.ad:'))).toBe(true);
  });

  it('builds demo jobs pointing at the fixtures with localhost exempted', async () => {
    let seen: QAClickTestJob | undefined;
    mockLoad.mockResolvedValue((job: QAClickTestJob) => { seen = job; return fakeRunner()(job); });
    await runClickLayer(await makeInput());
    expect(seen!.clickUrl).toContain('/demo/click/');
    expect(seen!.expectedUrl).toContain('/demo/landing/');
    expect(seen!.expectedUrl).toContain('ap_dest=');
    expect(seen!.allowInsecureHosts).toEqual(['localhost', '127.0.0.1']);
  });

  it('skips with an install hint when Playwright/qa-runner is unavailable', async () => {
    mockLoad.mockResolvedValue(null);
    const outcome = await runClickLayer(await makeInput());
    expect(outcome.jobs).toEqual([]);
    const skip = outcome.checks.find((c) => c.checkKey.startsWith('clickthrough.click_test.ad:'));
    expect(skip?.status).toBe('skipped');
    expect(skip?.message).toContain('npx playwright install chromium');
  });

  it('a runner crash yields a fail check, never a throw', async () => {
    mockLoad.mockResolvedValue(() => Promise.reject(new Error('chromium died')));
    const outcome = await runClickLayer(await makeInput());
    const failed = outcome.checks.find((c) => c.checkKey.startsWith('clickthrough.click_test.ad:'));
    expect(failed?.status).toBe('fail');
    expect(failed?.detail?.['runnerFailure']).toBe(true);
  });
});

describe('runClickLayer — live job building (enqueue happens in qa-service AFTER persist)', () => {
  it('returns real-tag jobs with the trackclk first-hop expectation plus queued placeholders', async () => {
    const outcome = await runClickLayer(await makeInput());
    expect(outcome.jobs.length).toBe(1);
    expect(outcome.jobs[0]!.expectedFirstHopPattern).toContain('trackclk');
    expect(outcome.jobs[0]!.clickUrl).toBeTruthy();
    const placeholder = outcome.checks.find((c) => c.checkKey === `clickthrough.click_test.ad:${outcome.jobs[0]!.adId}`);
    expect(placeholder?.status).toBe('skipped');
    expect(placeholder?.detail?.['queued']).toBe(true);
  });

  it('caps click tests per run and says so on the overflow ads', async () => {
    const input = await makeInput(1);
    // Fabricate more touched ads than the cap
    input.touched = Array.from({ length: MAX_CLICK_TESTS_PER_RUN + 2 }, (_, i) => ({
      toolName: 'cm360_update_ad', entityType: 'ad' as const, entityId: `fake-${i}`,
    }));
    const outcome = await runClickLayer(input);
    expect(outcome.jobs).toEqual([]); // fake ids aren't in ctx → no jobs built
    // First MAX get the not-found skip; the overflow ids get the explicit cap skip
    for (const overflowId of [`fake-${MAX_CLICK_TESTS_PER_RUN}`, `fake-${MAX_CLICK_TESTS_PER_RUN + 1}`]) {
      const check = outcome.checks.find((c) => c.checkKey === `clickthrough.click_test.ad:${overflowId}`);
      expect(check?.status).toBe('skipped');
      expect(check?.message).toContain('cap');
    }
  });
});
