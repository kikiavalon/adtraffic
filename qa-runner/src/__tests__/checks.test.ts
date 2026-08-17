import { describe, it, expect } from 'vitest';
import type { QAChainTrace, QAClickTestJob } from '@adtraffic/shared';
import { deriveClickChecks, diffParams, macroAwareEquals } from '../checks.js';

const JOB: QAClickTestJob = {
  runId: 'run-1',
  adId: '2001',
  clickUrl: 'https://ad.doubleclick.net/ddm/trackclk/N1.DEMO/p1;dc_trk_cid=101',
  expectedUrl: 'https://www.apexmotors.com/offers?utm_source=cm360&utm_medium=display&utm_campaign=apex-offers&utm_content=suffix-%epid!',
  expectedFirstHopPattern: '^https://ad\\.doubleclick\\.net/ddm/trackclk/',
};

function cleanTrace(): QAChainTrace {
  return {
    hops: [
      { url: JOB.clickUrl, status: 302, via: 'click', https: true },
      { url: 'https://www.apexmotors.com/offers?utm_source=cm360&utm_medium=display&utm_campaign=apex-offers&utm_content=suffix-77001', status: 200, via: 'http_3xx', https: true },
    ],
    finalUrl: 'https://www.apexmotors.com/offers?utm_source=cm360&utm_medium=display&utm_campaign=apex-offers&utm_content=suffix-77001',
    navigationCount: 1,
    truncatedAtCap: false,
    landed: true,
    finalStatus: 200,
    finalBodyTextLength: 1200,
    loadMs: 850,
  };
}

function byKey(checks: ReturnType<typeof deriveClickChecks>, prefix: string) {
  return checks.find((c) => c.checkKey.startsWith(prefix));
}

describe('macroAwareEquals / diffParams', () => {
  it('CM360 macros in the expected value match any expansion', () => {
    expect(macroAwareEquals('suffix-%epid!', 'suffix-77001')).toBe(true);
    expect(macroAwareEquals('suffix-%epid!', 'other-77001')).toBe(false);
    expect(macroAwareEquals('plain', 'plain')).toBe(true);
  });

  it('diffs missing, mismatched, and unexpected params', () => {
    const diff = diffParams(
      'https://x.com/?utm_source=cm360&utm_medium=display&cb=%n',
      'https://x.com/?utm_source=dcm&cb=123&extra=1',
    );
    expect(diff.missing).toEqual(['utm_medium']);
    expect(diff.mismatched).toEqual([{ key: 'utm_source', expected: 'cm360', actual: 'dcm' }]);
    expect(diff.unexpected).toEqual(['extra']);
  });
});

describe('deriveClickChecks — clean chain', () => {
  const checks = deriveClickChecks(JOB, cleanTrace());

  it('passes A1/A2/A3/A4/A5, B6/B7/B8, C9 and the summary', () => {
    for (const prefix of [
      'clickthrough.single_navigation', 'clickthrough.first_hop', 'clickthrough.chain_length',
      'clickthrough.final_url', 'clickthrough.unresolved_macros',
      'landing.http_status', 'landing.https', 'landing.renders',
      'tracking.param_diff', 'clickthrough.click_test',
    ]) {
      expect(byKey(checks, prefix)?.status, prefix).toBe('pass');
    }
  });

  it('keys are suffixed ad:2001 and the summary carries the chain detail', () => {
    expect(byKey(checks, 'clickthrough.click_test')!.checkKey).toBe('clickthrough.click_test.ad:2001');
    expect((byKey(checks, 'clickthrough.click_test')!.detail as { chain: unknown[] }).chain.length).toBe(2);
  });
});

describe('deriveClickChecks — failures', () => {
  it('dead click: navigationCount 0 fails A1', () => {
    const checks = deriveClickChecks(JOB, { ...cleanTrace(), navigationCount: 0, hops: [], finalUrl: undefined, landed: false });
    expect(byKey(checks, 'clickthrough.single_navigation')?.status).toBe('fail');
    expect(byKey(checks, 'clickthrough.click_test')?.status).toBe('fail');
  });

  it('double-fire: navigationCount 2 fails A1', () => {
    const checks = deriveClickChecks(JOB, { ...cleanTrace(), navigationCount: 2 });
    expect(byKey(checks, 'clickthrough.single_navigation')?.status).toBe('fail');
  });

  it('first hop bypassing trackclk fails A2 (click tracking broken)', () => {
    const trace = cleanTrace();
    trace.hops[0] = { ...trace.hops[0]!, url: 'https://www.apexmotors.com/offers' };
    const checks = deriveClickChecks(JOB, trace);
    expect(byKey(checks, 'clickthrough.first_hop')?.status).toBe('fail');
  });

  it('5–20 hops warns, cap fails (A3)', () => {
    const hop = cleanTrace().hops[0]!;
    const warned = deriveClickChecks(JOB, { ...cleanTrace(), hops: Array.from({ length: 6 }, () => hop) });
    expect(byKey(warned, 'clickthrough.chain_length')?.status).toBe('warn');
    const capped = deriveClickChecks(JOB, { ...cleanTrace(), truncatedAtCap: true, landed: false });
    expect(byKey(capped, 'clickthrough.chain_length')?.status).toBe('fail');
  });

  it('unexpanded macros in the final URL fail A5', () => {
    const trace = cleanTrace();
    trace.finalUrl = 'https://www.apexmotors.com/offers?utm_content=suffix-%epid!';
    const checks = deriveClickChecks(JOB, trace);
    expect(byKey(checks, 'clickthrough.unresolved_macros')?.status).toBe('fail');
  });

  it('wrong final host/path fails A4', () => {
    const trace = cleanTrace();
    trace.finalUrl = 'https://wrong.com/offers?utm_source=cm360';
    const checks = deriveClickChecks(JOB, trace);
    expect(byKey(checks, 'clickthrough.final_url')?.status).toBe('fail');
  });

  it('4xx landing fails B6; blank page fails B8', () => {
    const status = deriveClickChecks(JOB, { ...cleanTrace(), finalStatus: 404, landed: true });
    expect(byKey(status, 'landing.http_status')?.status).toBe('fail');
    const blank = deriveClickChecks(JOB, { ...cleanTrace(), finalBodyTextLength: 0 });
    expect(byKey(blank, 'landing.renders')?.status).toBe('fail');
  });

  it('insecure hop fails B7 unless the host is allowlisted (demo localhost)', () => {
    const trace = cleanTrace();
    trace.hops[1] = { ...trace.hops[1]!, url: 'http://localhost:3001/demo/landing/1', https: false };
    expect(byKey(deriveClickChecks(JOB, trace), 'landing.https')?.status).toBe('fail');
    const demoJob = { ...JOB, allowInsecureHosts: ['localhost', '127.0.0.1'] };
    expect(byKey(deriveClickChecks(demoJob, trace), 'landing.https')?.status).toBe('pass');
  });

  it('missing/mismatched params fail C9; extra-only params warn', () => {
    const trace = cleanTrace();
    trace.finalUrl = 'https://www.apexmotors.com/offers?utm_source=cm360&utm_medium=display&utm_campaign=apex-offers&utm_content=suffix-77001&gclid=x';
    expect(byKey(deriveClickChecks(JOB, trace), 'tracking.param_diff')?.status).toBe('warn');
    trace.finalUrl = 'https://www.apexmotors.com/offers?utm_source=cm360';
    expect(byKey(deriveClickChecks(JOB, trace), 'tracking.param_diff')?.status).toBe('fail');
  });

  it('navigation error surfaces in the summary message', () => {
    const checks = deriveClickChecks(JOB, {
      ...cleanTrace(), landed: false, finalStatus: undefined, errorMessage: 'net::ERR_NAME_NOT_RESOLVED',
    });
    expect(byKey(checks, 'clickthrough.click_test')?.status).toBe('fail');
    expect(byKey(checks, 'clickthrough.click_test')?.message).toContain('ERR_NAME_NOT_RESOLVED');
  });
});
