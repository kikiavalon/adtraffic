import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth/AuthContext.js';

function TestConsumer({ onAuth }: { onAuth: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  onAuth(auth);
  return null;
}

function jsonRes(body: unknown, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: () => Promise.resolve(body) };
}

/** Route global fetch by URL; /auth/me defaults to 401, others to empty-ok. */
function stubFetch(overrides: Array<[string, () => unknown]> = []) {
  const fn = vi.fn((url: string) => {
    for (const [needle, resp] of overrides) {
      if (url.includes(needle)) return Promise.resolve(resp());
    }
    if (url.includes('/auth/me')) return Promise.resolve(jsonRes({}, false, 401));
    return Promise.resolve(jsonRes({ flags: {}, connected: false }));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function renderWithAuth() {
  let authRef: ReturnType<typeof useAuth> | null = null;
  const utils = render(
    <AuthProvider>
      <TestConsumer onAuth={(a) => { authRef = a; }} />
    </AuthProvider>,
  );
  return { ...utils, getAuth: () => authRef! };
}

describe('AuthContext — registration status + agency', () => {
  beforeEach(() => { stubFetch(); });

  it('exposes needsBootstrap / registrationOpen from /auth/registration-status', async () => {
    stubFetch([['/auth/registration-status', () => jsonRes({ needsBootstrap: true, registrationOpen: true })]]);
    const { getAuth } = renderWithAuth();
    await waitFor(() => expect(getAuth().needsBootstrap).toBe(true));
    expect(getAuth().registrationOpen).toBe(true);
  });

  it('register() includes agency in the body only when provided', async () => {
    const fetchMock = stubFetch([
      ['/auth/register', () => jsonRes({ token: 't', user: { id: 'u', email: 'boss@agency.com', name: 'Boss' } }, true, 201)],
    ]);
    const { getAuth } = renderWithAuth();
    await waitFor(() => expect(getAuth().authReady).toBe(true));

    await act(async () => {
      await getAuth().register('boss@agency.com', 'password123', 'Boss', 'Acme Media');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/register'),
      expect.objectContaining({
        body: JSON.stringify({ email: 'boss@agency.com', password: 'password123', name: 'Boss', agency: 'Acme Media' }),
      }),
    );
  });
});
