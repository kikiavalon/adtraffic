import { describe, it, expect } from 'vitest';
import {
  validateConfiguredUrl,
  findUnresolvedMacros,
  validateSourceConsistency,
  VALID_CM360_MACROS,
} from '../qa/url-validator.js';

const CLEAN = 'https://apexmotors.com/suv?utm_source=cm360&utm_medium=display&utm_campaign=apex-q3-2026&utm_content=%epid!&cb=%n';

describe('validateConfiguredUrl', () => {
  it('passes a clean fully-tagged URL with valid macros', () => {
    expect(validateConfiguredUrl(CLEAN)).toEqual([]);
  });

  it('macro table is the verified 8-macro set with no timestamp macro', () => {
    expect(VALID_CM360_MACROS).toEqual(['%ebuy!', '%epid!', '%eaid!', '%ecid!', '%eadv!', '%esid!', '%n', '%g']);
  });

  it('flags missing https (mistake 8)', () => {
    const v = validateConfiguredUrl('http://x.com/?utm_source=cm360&utm_medium=display&utm_campaign=c');
    expect(v.some((c) => c.checkKey.startsWith('url.not_https') && c.status === 'fail')).toBe(true);
  });

  it('flags duplicate ? (mistake 8)', () => {
    const v = validateConfiguredUrl('https://x.com/?a=1?utm_source=cm360&utm_medium=display&utm_campaign=c');
    expect(v.some((c) => c.checkKey.startsWith('url.duplicate_query'))).toBe(true);
  });

  it('flags unknown macros — no invented timestamp macro (mistake 5 family)', () => {
    const v = validateConfiguredUrl('https://x.com/?utm_source=cm360&utm_medium=display&utm_campaign=c&t=%etimestamp!');
    expect(v.some((c) => c.checkKey.startsWith('macro.unknown') && c.status === 'fail')).toBe(true);
  });

  it('flags uppercase macros — macros are case-sensitive lowercase', () => {
    const v = validateConfiguredUrl('https://x.com/?utm_source=cm360&utm_medium=display&utm_campaign=c&p=%EPID!');
    expect(v.some((c) => c.checkKey.startsWith('macro.case') && c.status === 'fail')).toBe(true);
  });

  it('flags partial UTM tagging (mistake 3 / GA4 rule, check 14)', () => {
    const v = validateConfiguredUrl('https://x.com/?utm_source=cm360');
    const hit = v.find((c) => c.checkKey.startsWith('utm.partial_tagging'));
    expect(hit?.status).toBe('fail');
    expect(hit?.message).toContain('utm_medium');
  });

  it('does not flag partial tagging on a URL with no UTMs at all', () => {
    expect(validateConfiguredUrl('https://x.com/page')).toEqual([]);
  });

  it('enforces required params when asked (check 10)', () => {
    const v = validateConfiguredUrl('https://x.com/page', { requiredParams: ['utm_source', 'utm_medium', 'utm_campaign'] });
    expect(v.filter((c) => c.checkKey.startsWith('utm.required_missing')).length).toBe(3);
  });

  it('warns on mixed-case UTM values (mistake 1)', () => {
    const v = validateConfiguredUrl('https://x.com/?utm_source=CM360&utm_medium=display&utm_campaign=c');
    expect(v.some((c) => c.checkKey.startsWith('utm.case') && c.status === 'warn')).toBe(true);
  });

  it('fails on spaces in UTM values (mistake 2)', () => {
    const v = validateConfiguredUrl('https://x.com/?utm_source=cm360&utm_medium=display&utm_campaign=Spring%20Sale');
    expect(v.some((c) => c.checkKey.startsWith('utm.spaces') && c.status === 'fail')).toBe(true);
  });

  it('scopes check keys with keySuffix so multiple URLs stay unique per run', () => {
    const v = validateConfiguredUrl('http://x.com/', { keySuffix: 'ad:2001' });
    expect(v[0]!.checkKey).toBe('url.not_https.ad:2001');
  });
});

describe('findUnresolvedMacros (check 5)', () => {
  it('flags %%MACRO%% and ${CLICK_URL} template tokens', () => {
    const v = findUnresolvedMacros('https://x.com/?u=%%CLICK_URL_UNESC%%&c=${CLICK_URL}');
    expect(v.length).toBe(1);
    expect(v[0]!.status).toBe('fail');
    expect(v[0]!.message).toContain('%%CLICK_URL_UNESC%%');
    expect(v[0]!.message).toContain('${CLICK_URL}');
  });

  it('treats CM360 macros as resolvable by default (configured URLs)', () => {
    expect(findUnresolvedMacros(CLEAN)).toEqual([]);
  });

  it('flags CM360 macros too when checking a FINAL url (Phase 2 mode)', () => {
    const v = findUnresolvedMacros('https://x.com/?p=%epid!', { treatCm360MacrosAsUnresolved: true });
    expect(v.length).toBe(1);
    expect(v[0]!.message).toContain('%epid!');
  });
});

describe('validateSourceConsistency (mistake 4)', () => {
  it('fails when dcm/dfa/cm360 sources are mixed across a campaign', () => {
    const v = validateSourceConsistency([
      { url: 'https://x.com/?utm_source=cm360&utm_medium=display&utm_campaign=c', label: 'ad:1' },
      { url: 'https://x.com/?utm_source=dcm&utm_medium=display&utm_campaign=c', label: 'ad:2' },
    ]);
    expect(v.length).toBe(1);
    expect(v[0]!.checkKey).toBe('utm.source_mixed');
    expect(v[0]!.status).toBe('fail');
    expect(v[0]!.message).toContain('cm360');
    expect(v[0]!.message).toContain('dcm');
  });

  it('passes when all URLs agree', () => {
    const v = validateSourceConsistency([
      { url: 'https://x.com/?utm_source=cm360&utm_medium=display&utm_campaign=c', label: 'ad:1' },
      { url: 'https://y.com/?utm_source=cm360&utm_medium=video&utm_campaign=d', label: 'ad:2' },
    ]);
    expect(v).toEqual([]);
  });
});
