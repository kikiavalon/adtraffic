import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth/AuthContext.js';

// Helper to render a component that uses the auth hook
function TestConsumer({ onAuth }: { onAuth: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  onAuth(auth);
  return (
    <div>
      <span data-testid="user-name">{auth.user?.name ?? 'none'}</span>
      <span data-testid="token">{auth.token ?? 'none'}</span>
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

describe('AuthContext', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('provides null user and token when no localStorage data', () => {
    const { getAuth } = renderWithAuth();
    expect(getAuth().user).toBeNull();
    expect(getAuth().token).toBeNull();
  });

  it('restores user and token from localStorage on mount', () => {
    localStorage.setItem('adtraffic-token', mockToken);
    localStorage.setItem('adtraffic-user', JSON.stringify(mockUser));

    const { getAuth } = renderWithAuth();
    expect(getAuth().user).toEqual(mockUser);
    expect(getAuth().token).toBe(mockToken);
  });

  it('login() calls POST /api/auth/login with email and password', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: mockToken, user: mockUser }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { getAuth } = renderWithAuth();

    await act(async () => {
      await getAuth().login('test@agency.com', 'password123');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@agency.com', password: 'password123' }),
      })
    );
  });

  it('login() sets user and token on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: mockToken, user: mockUser }),
    }));

    const { getAuth } = renderWithAuth();

    await act(async () => {
      await getAuth().login('test@agency.com', 'password123');
    });

    expect(getAuth().user).toEqual(mockUser);
    expect(getAuth().token).toBe(mockToken);
  });

  it('login() throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid credentials' }),
    }));

    const { getAuth } = renderWithAuth();

    await expect(act(async () => {
      await getAuth().login('bad@test.com', 'wrong');
    })).rejects.toThrow('Invalid credentials');
  });

  it('register() calls POST /api/auth/register with email, password, and name', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: mockToken, user: mockUser }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { getAuth } = renderWithAuth();

    await act(async () => {
      await getAuth().register('test@agency.com', 'password123', 'Test User');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/register'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@agency.com', password: 'password123', name: 'Test User' }),
      })
    );
  });

  it('register() sets user and token on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: mockToken, user: mockUser }),
    }));

    const { getAuth } = renderWithAuth();

    await act(async () => {
      await getAuth().register('test@agency.com', 'password123', 'Test User');
    });

    expect(getAuth().user).toEqual(mockUser);
    expect(getAuth().token).toBe(mockToken);
  });

  it('register() throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Email already exists' }),
    }));

    const { getAuth } = renderWithAuth();

    await expect(act(async () => {
      await getAuth().register('dup@test.com', 'pass1234', 'Dup');
    })).rejects.toThrow('Email already exists');
  });

  it('logout() clears user, token, localStorage, and sessionStorage', async () => {
    localStorage.setItem('adtraffic-token', mockToken);
    localStorage.setItem('adtraffic-user', JSON.stringify(mockUser));
    sessionStorage.setItem('adtraffic-conv-id', 'conv-123');

    const { getAuth } = renderWithAuth();
    expect(getAuth().token).toBe(mockToken);

    act(() => {
      getAuth().logout();
    });

    expect(getAuth().user).toBeNull();
    expect(getAuth().token).toBeNull();
    expect(localStorage.getItem('adtraffic-token')).toBeNull();
    expect(localStorage.getItem('adtraffic-user')).toBeNull();
    expect(sessionStorage.getItem('adtraffic-conv-id')).toBeNull();
  });

  it('authFetch() adds Authorization header with Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    localStorage.setItem('adtraffic-token', mockToken);
    localStorage.setItem('adtraffic-user', JSON.stringify(mockUser));

    const { getAuth } = renderWithAuth();

    await act(async () => {
      await getAuth().authFetch('/api/test');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockToken}`,
        }),
      })
    );
  });

  it('authFetch() clears auth state on 401 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    localStorage.setItem('adtraffic-token', mockToken);
    localStorage.setItem('adtraffic-user', JSON.stringify(mockUser));

    const { getAuth } = renderWithAuth();
    expect(getAuth().token).toBe(mockToken);

    await act(async () => {
      await getAuth().authFetch('/api/protected');
    });

    expect(getAuth().user).toBeNull();
    expect(getAuth().token).toBeNull();
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer onAuth={() => {}} />);
    }).toThrow('useAuth must be used within AuthProvider');

    spy.mockRestore();
  });
});
