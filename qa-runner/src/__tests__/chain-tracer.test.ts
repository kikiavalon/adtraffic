import { describe, it, expect } from 'vitest';
import {
  parseMetaRefreshUrl,
  classifyHops,
  buildChainTrace,
  HOP_CAP,
  HOP_WARN_THRESHOLD,
  type RawNavigationEvent,
} from '../chain-tracer.js';

const CLICK = 'https://ad.doubleclick.net/ddm/trackclk/N1.DEMO/p1;dc_trk_cid=101';

function ev(overrides: Partial<RawNavigationEvent> & { url: string }): RawNavigationEvent {
  return { ...overrides };
}

describe('parseMetaRefreshUrl', () => {
  it('parses <meta http-equiv="refresh"> with delay and url', () => {
    const html = '<html><head><meta http-equiv="refresh" content="0;url=/next?a=1"></head></html>';
    expect(parseMetaRefreshUrl(html, 'https://x.com/page')).toBe('https://x.com/next?a=1');
  });

  it('is case-insensitive and tolerates spaces/quotes', () => {
    const html = "<META HTTP-EQUIV='Refresh' CONTENT='2; URL=https://y.com/z'>";
    expect(parseMetaRefreshUrl(html, 'https://x.com/')).toBe('https://y.com/z');
  });

  it('returns null when there is no refresh tag', () => {
    expect(parseMetaRefreshUrl('<html><body>hi</body></html>', 'https://x.com/')).toBeNull();
  });

  it('runs in linear time on adversarial meta-heavy HTML (ReDoS guard)', () => {
    // Many "<meta" starts with no closing ">". The old combined <meta[^>]+...[^>]*>
    // was O(n^2) — ~5.5s at this size; the bounded body scan is ~linear (well under
    // a second). The generous ceiling catches a revert without flaking.
    const start = performance.now();
    expect(parseMetaRefreshUrl('<meta '.repeat(50000), 'https://x.com/')).toBeNull();
    expect(parseMetaRefreshUrl('<meta http-equiv=' + ' '.repeat(50000), 'https://x.com/')).toBeNull();
    expect(performance.now() - start).toBeLessThan(2500);
  });
});

describe('classifyHops', () => {
  it('classifies click → 3xx → meta refresh → js', () => {
    const events: RawNavigationEvent[] = [
      ev({ url: CLICK, status: 302, redirectLocation: 'https://mid.com/a' }),
      ev({ url: 'https://mid.com/a', status: 200, documentHtml: '<meta http-equiv="refresh" content="0;url=https://mid.com/b">' }),
      ev({ url: 'https://mid.com/b', status: 200, documentHtml: '<script>location.href="https://final.com/lp"</script>' }),
      ev({ url: 'https://final.com/lp', status: 200, documentHtml: '<h1>lp</h1>' }),
    ];
    const hops = classifyHops(events);
    expect(hops.map((h) => h.via)).toEqual(['click', 'http_3xx', 'meta_refresh', 'js']);
    expect(hops.every((h) => h.https)).toBe(true);
  });

  it('flags non-https hops and computes latency', () => {
    const hops = classifyHops([ev({ url: 'http://x.com/', status: 200, startedAt: 100, endedAt: 350 })]);
    expect(hops[0]!.https).toBe(false);
    expect(hops[0]!.latencyMs).toBe(250);
  });
});

describe('buildChainTrace', () => {
  const base = { navigationCount: 1, landed: true };

  it('assembles finalUrl/finalStatus and marks the cap', () => {
    const events = Array.from({ length: HOP_CAP }, (_, i) =>
      ev({ url: `https://x.com/${i}`, status: 302, redirectLocation: `https://x.com/${i + 1}` }));
    const trace = buildChainTrace({ ...base, landed: false, events });
    expect(trace.truncatedAtCap).toBe(true);
    expect(trace.hops.length).toBe(HOP_CAP);
    expect(trace.finalUrl).toBe(`https://x.com/${HOP_CAP - 1}`);
  });

  it('carries landed/finalStatus/body-length/error through', () => {
    const trace = buildChainTrace({
      ...base,
      events: [ev({ url: 'https://x.com/lp', status: 200, documentHtml: '<h1>x</h1>' })],
      finalBodyTextLength: 42,
      loadMs: 900,
    });
    expect(trace.landed).toBe(true);
    expect(trace.finalStatus).toBe(200);
    expect(trace.finalBodyTextLength).toBe(42);
    expect(trace.truncatedAtCap).toBe(false);
  });

  it('an empty event list yields a dead-click trace', () => {
    const trace = buildChainTrace({ navigationCount: 0, landed: false, events: [], errorMessage: undefined });
    expect(trace.hops).toEqual([]);
    expect(trace.finalUrl).toBeUndefined();
  });

  it("Chromium's internal redirect abort counts as hitting the cap", () => {
    const trace = buildChainTrace({
      ...base, landed: false,
      events: [ev({ url: 'https://x.com/loop', status: 302, redirectLocation: 'https://x.com/loop' })],
      errorMessage: 'net::ERR_TOO_MANY_REDIRECTS',
    });
    expect(trace.truncatedAtCap).toBe(true);
  });

  it('exports the design thresholds', () => {
    expect(HOP_WARN_THRESHOLD).toBe(4);
    expect(HOP_CAP).toBe(20);
  });
});
