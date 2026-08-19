import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth/AuthContext.js';

function TestConsumer({ onAuth }: { onAuth: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  onAuth(auth);
  return (
    <div>
      <span data-testid="user-name">{auth.user?.name ?? 'none'}</span>
      <span data-testid="authed">{String(auth.isAuthenticated)}</span>
      <span data-testid="flags">{auth.featureFlags ? JSON.stringify(auth.featureFlags) : 'none'}</span>
    </div>
  );
}

function renderWithAuth() {
  let authRef: ReturnType<typeof useAuth> | null = null;
  const onAuth = (auth: ReturnType<typeof useAuth>) => { authRef = auth; };
  const utils = render(
    <AuthProvider>
      <TestConsumer onAuth={onAuth} />
    </AuthProvider>
  );
  return { ...utils, getAuth: () => authRef! };
}

const mockUser = { id: 'u1', email: 'test@agency.com', name: 'Test User' };
const mockToken = 'jwt-token-123';

type FetchStub = ReturnType<typeof vi.fn>;

function jsonRes(body: unknown, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: () => Promise.resolve(body) };
}

function stubFetch(overrides: Array<[string, () => unknown]> = []): FetchStub {
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

async function renderReady() {
  const utils = renderWithAuth();
  await waitFor(() => expect(utils.getAuth().authReady).toBe(true));
  return utils;
}

describe('AuthContext edge cases', () => {
  beforeEach(() => {
    stubFetch();
  });

  it('stays logged out when the initial session check fails', async () => {
    stubFetch([['/auth/me', () => { throw new Error('network'); }]]);
    const { getAuth } = await renderReady();
    expect(getAuth().user).toBeNull();
    expect(getAuth().isAuthenticated).toBe(false);
  });

  it('authFetch preserves custom headers and includes credentials', async () => {
    const fetchMock = stubFetch();
    const { getAuth } = await renderReady();

    await act(async () => {
      await getAuth().authFetch('/api/test', {
        headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
      });
    });

    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/test');
    expect(call).toBeDefined();
    expect(call![1]).toEqual(expect.objectContaining({ credentials: 'include' }));
    expect((call![1] as RequestInit).headers).toEqual(expect.objectContaining({
      'Content-Type': 'application/json',
      'X-Custom': 'value',
    }));
  });

  it('authFetch never sends an Authorization header', async () => {
    const fetchMock = stubFetch();
    const { getAuth } = await renderReady();

    await act(async () => {
      await getAuth().authFetch('/api/public');
    });

    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/public');
    const headers = (call![1] as RequestInit).headers as Record<string, string>;
    expect(headers?.['Authorization']).toBeUndefined();
  });

  it('authFetch does not clear the session on non-401 errors', async () => {
    stubFetch([
      ['/auth/me', () => jsonRes({ user: mockUser })],
      ['/api/test', () => jsonRes({}, false, 500)],
    ]);
    const { getAuth } = await renderReady();
    expect(getAuth().isAuthenticated).toBe(true);

    await act(async () => {
      await getAuth().authFetch('/api/test');
    });

    expect(getAuth().isAuthenticated).toBe(true);
    expect(getAuth().user).toEqual(mockUser);
  });

  it('logout clears featureFlags and user', async () => {
    stubFetch([
      ['/auth/login', () => jsonRes({ token: mockToken, user: mockUser })],
      ['/feature-flags', () => jsonRes({ flags: { 'chat.enabled': true } })],
    ]);
    const { getAuth } = await renderReady();

    await act(async () => {
      await getAuth().login('test@agency.com', 'password123');
    });
    await waitFor(() => expect(getAuth().featureFlags).not.toBeNull());

    act(() => {
      getAuth().logout();
    });

    expect(getAuth().featureFlags).toBeNull();
    expect(getAuth().user).toBeNull();
    expect(getAuth().isAuthenticated).toBe(false);
  });

  it('login triggers a feature-flags fetch with credentials and no Authorization header', async () => {
    const fetchMock = stubFetch([
      ['/auth/login', () => jsonRes({ token: mockToken, user: mockUser })],
      ['/feature-flags', () => jsonRes({ flags: { 'chat.enabled': true, 'limits.daily_api_requests': 100 } })],
    ]);
    const { getAuth } = await renderReady();

    await act(async () => {
      await getAuth().login('test@agency.com', 'password123');
    });
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/v1/feature-flags'))).toBe(true);
    });

    const flagsCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/v1/feature-flags'));
    expect(flagsCall![1]).toEqual(expect.objectContaining({ credentials: 'include' }));
    const headers = (flagsCall![1] as RequestInit | undefined)?.headers as Record<string, string> | undefined;
    expect(headers?.['Authorization']).toBeUndefined();
  });

  it('feature-flags fetch failure is silent (does not crash)', async () => {
    stubFetch([
      ['/auth/login', () => jsonRes({ token: mockToken, user: mockUser })],
      ['/feature-flags', () => { throw new Error('Network error'); }],
    ]);
    const { getAuth } = await renderReady();

    await act(async () => {
      await getAuth().login('test@agency.com', 'password123');
    });

    expect(getAuth().featureFlags).toBeNull();
    expect(getAuth().user).toEqual(mockUser);
  });

  it('register triggers a feature-flags fetch', async () => {
    const fetchMock = stubFetch([
      ['/auth/register', () => jsonRes({ token: mockToken, user: mockUser }, true, 201)],
      ['/feature-flags', () => jsonRes({ flags: { 'chat.enabled': true } })],
    ]);
    const { getAuth } = await renderReady();

    await act(async () => {
      await getAuth().register('test@agency.com', 'password123', 'Test User');
    });
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/v1/feature-flags'))).toBe(true);
    });
  });

  it('context value is memoized (stable reference)', () => {
    const values: ReturnType<typeof useAuth>[] = [];

    function Collector() {
      const auth = useAuth();
      values.push(auth);
      return null;
    }

    const { rerender } = render(
      <AuthProvider>
        <Collector />
      </AuthProvider>
    );

    rerender(
      <AuthProvider>
        <Collector />
      </AuthProvider>
    );

    expect(values.length).toBeGreaterThanOrEqual(2);
  });
});
