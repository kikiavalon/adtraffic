import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth/AuthContext.js';

// Helper to render a component that uses the auth hook
function TestConsumer({ onAuth }: { onAuth: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  onAuth(auth);
  return (
    <div>
      <span data-testid="user-name">{auth.user?.name ?? 'none'}</span>
      <span data-testid="authed">{String(auth.isAuthenticated)}</span>
      <span data-testid="loading">{String(auth.isLoading)}</span>
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

/**
 * Route the global fetch by URL. `overrides` win first; otherwise /auth/me
 * defaults to 401 (logged out) and flags/status endpoints return empty-ok.
 */
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

/** Render and wait for the initial /auth/me session check to resolve. */
async function renderReady() {
  const utils = renderWithAuth();
  await waitFor(() => expect(utils.getAuth().authReady).toBe(true));
  return utils;
}

describe('AuthContext', () => {
  beforeEach(() => {
    stubFetch();
  });

  it('is unauthenticated when /auth/me returns 401', async () => {
    const { getAuth } = await renderReady();
    expect(getAuth().user).toBeNull();
    expect(getAuth().isAuthenticated).toBe(false);
  });

  it('rehydrates the user from /auth/me on mount', async () => {
    stubFetch([['/auth/me', () => jsonRes({ user: mockUser })]]);
    const { getAuth } = await renderReady();
    expect(getAuth().user).toEqual(mockUser);
    expect(getAuth().isAuthenticated).toBe(true);
  });

  it('login() POSTs /auth/login with credentials included', async () => {
    const fetchMock = stubFetch([['/auth/login', () => jsonRes({ token: mockToken, user: mockUser })]]);
    const { getAuth } = await renderReady();

    await act(async () => {
      await getAuth().login('test@agency.com', 'password123');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/login'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'test@agency.com', password: 'password123' }),
      })
    );
  });

  it('login() sets the user on success (token stays in the cookie)', async () => {
    stubFetch([['/auth/login', () => jsonRes({ token: mockToken, user: mockUser })]]);
    const { getAuth } = await renderReady();

    await act(async () => {
      await getAuth().login('test@agency.com', 'password123');
    });

    expect(getAuth().user).toEqual(mockUser);
    expect(getAuth().isAuthenticated).toBe(true);
  });

  it('login() throws on non-ok response', async () => {
    stubFetch([['/auth/login', () => jsonRes({ error: 'Invalid credentials' }, false, 401)]]);
    const { getAuth } = await renderReady();

    await expect(act(async () => {
      await getAuth().login('bad@test.com', 'wrong');
    })).rejects.toThrow('Invalid credentials');
  });

  it('register() POSTs /auth/register with credentials included', async () => {
    const fetchMock = stubFetch([['/auth/register', () => jsonRes({ token: mockToken, user: mockUser }, true, 201)]]);
    const { getAuth } = await renderReady();

    await act(async () => {
      await getAuth().register('test@agency.com', 'password123', 'Test User');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/register'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'test@agency.com', password: 'password123', name: 'Test User' }),
      })
    );
  });

  it('register() sets the user on success', async () => {
    stubFetch([['/auth/register', () => jsonRes({ token: mockToken, user: mockUser }, true, 201)]]);
    const { getAuth } = await renderReady();

    await act(async () => {
      await getAuth().register('test@agency.com', 'password123', 'Test User');
    });

    expect(getAuth().user).toEqual(mockUser);
  });

  it('register() throws on non-ok response', async () => {
    stubFetch([['/auth/register', () => jsonRes({ error: 'Email already exists' }, false, 409)]]);
    const { getAuth } = await renderReady();

    await expect(act(async () => {
      await getAuth().register('dup@test.com', 'pass1234', 'Dup');
    })).rejects.toThrow('Email already exists');
  });

  it('logout() POSTs /auth/logout, clears the user and sessionStorage', async () => {
    const fetchMock = stubFetch([['/auth/me', () => jsonRes({ user: mockUser })]]);
    sessionStorage.setItem('adtraffic-conv-id', 'conv-123');

    const { getAuth } = await renderReady();
    expect(getAuth().isAuthenticated).toBe(true);

    act(() => {
      getAuth().logout();
    });

    expect(getAuth().user).toBeNull();
    expect(getAuth().isAuthenticated).toBe(false);
    expect(sessionStorage.getItem('adtraffic-conv-id')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/logout'),
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('authFetch() sends credentials and no Authorization header', async () => {
    const fetchMock = stubFetch();
    const { getAuth } = await renderReady();

    await act(async () => {
      await getAuth().authFetch('/api/test');
    });

    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/test');
    expect(call).toBeDefined();
    expect(call![1]).toEqual(expect.objectContaining({ credentials: 'include' }));
    const headers = (call![1] as RequestInit).headers as Record<string, string>;
    expect(headers?.['Authorization']).toBeUndefined();
  });

  it('authFetch() clears the user on a 401 response', async () => {
    stubFetch([
      ['/auth/me', () => jsonRes({ user: mockUser })],
      ['/api/protected', () => jsonRes({}, false, 401)],
    ]);

    const { getAuth } = await renderReady();
    expect(getAuth().isAuthenticated).toBe(true);

    await act(async () => {
      await getAuth().authFetch('/api/protected');
    });

    expect(getAuth().user).toBeNull();
    expect(getAuth().isAuthenticated).toBe(false);
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      render(<TestConsumer onAuth={() => {}} />);
    }).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });
});
