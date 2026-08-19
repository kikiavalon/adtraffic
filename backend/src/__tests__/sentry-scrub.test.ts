import { describe, it, expect } from 'vitest';
import { scrubSentryEvent } from '../sentry.js';
import type { Event } from '@sentry/node';

describe('scrubSentryEvent', () => {
  it('redacts secrets in every carrier the old scrub missed', () => {
    const hexSecret = 'deadbeef'.repeat(8); // 64 hex chars, e.g. ENCRYPTION_KEY
    const ciphertext = 'a'.repeat(24) + ':' + 'b'.repeat(32) + ':' + 'cafe1234'; // iv:tag:ct
    const event = {
      message: 'boom sk-ant-topLevelKEY and user leak@example.com',
      request: {
        headers: { authorization: 'Bearer eyJhdr.abc.def', 'x-keep': 'ok' },
        query_string: 'state=eyJqs.mmm.nnn&page=2',
        cookies: { session: 'eyJcookie.aaa.bbb' },
        data: {
          credentials: { apiKey: 'sk-ant-nestedKEY123' }, // nested (depth > 1)
          deeper: { level: { access_token: 'goog-access-secret' } },
        },
      },
      exception: { values: [{ value: `crashed with sk-ant-inException and ${hexSecret}` }] },
      breadcrumbs: [{ message: 'crumb sk-ant-inBreadcrumb', data: { token: 'refresh-xyz' } }],
      contexts: { custom: { note: `ciphertext ${ciphertext}` } },
      extra: { detail: 'sk-ant-inExtra', googleTok: 'ya29.a0AfB_secretGoogleToken' },
      tags: { sessionId: 'sess-hijackable-123', csrfToken: 'csrf-plainvalue-456' },
    } as unknown as Event;

    const out = JSON.stringify(scrubSentryEvent(event));

    // Secrets, wherever they were, are gone.
    expect(out).not.toContain('sk-ant-');
    expect(out).not.toContain('eyJhdr'); // JWT in header
    expect(out).not.toContain('eyJqs'); // JWT in query_string
    expect(out).not.toContain('eyJcookie'); // JWT in cookie
    expect(out).not.toContain('leak@example.com');
    expect(out).not.toContain('goog-access-secret'); // nested access_token key
    expect(out).not.toContain('refresh-xyz'); // token key in a breadcrumb
    expect(out).not.toContain(hexSecret);
    expect(out).not.toContain(ciphertext);
    expect(out).not.toContain('ya29.a0AfB'); // Google OAuth token in free text
    expect(out).not.toContain('sess-hijackable'); // sessionId key
    expect(out).not.toContain('csrf-plainvalue'); // csrfToken key

    // Non-sensitive data is preserved.
    expect(out).toContain('x-keep');
    expect(out).toContain('ok');
    expect(out).toContain('page=2');
  });
});
