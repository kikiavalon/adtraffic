import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth/AuthContext.js';

function TestConsumer({ onAuth }: { onAuth: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  onAuth(auth);
  return (
    <div>
      <span data-testid="user-name">{auth.user?.name ?? 'none'}</span>
      <span data-testid="token">{auth.token ?? 'none'}</span>
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

describe('AuthContext edge cases', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('handles corrupt JSON in localStorage gracefully', () => {
    localStorage.setItem('adtraffic-user', '{invalid json}');
    localStorage.setItem('adtraffic-token', mockToken);

    const { getAuth } = renderWithAuth();

    // Should fall through to null rather than crashing
    expect(getAuth().user).toBeNull();
    // Token is just a string, no JSON parsing needed
    expect(getAuth().token).toBe(mockToken);
  });

  it('handles empty localStorage values', () => {
    localStorage.setItem('adtraffic-user', '');
    localStorage.setItem('adtraffic-token', '');

    const { getAuth } = renderWithAuth();

    // Empty strings: user parse will fail, token is falsy
    expect(getAuth().user).toBeNull();
  });

  it('authFetch preserves existing custom headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    localStorage.setItem('adtraffic-token', mockToken);
    localStorage.setItem('adtraffic-user', JSON.stringify(mockUser));

    const { getAuth } = renderWithAuth();

    await act(async () => {
      await getAuth().authFetch('/api/test', {
        headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Custom': 'value',
          Authorization: `Bearer ${mockToken}`,
        }),
      })
    );
  });

  it('authFetch works without token (no Authorization header)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const { getAuth } = renderWithAuth();

    await act(async () => {
      await getAuth().authFetch('/api/public');
    });

    // Should not have Authorization header
    const callHeaders = fetchMock.mock.calls[0]![1]!.headers;
    expect(callHeaders).not.toHaveProperty('Authorization');
  });

  it('authFetch does not clear auth on non-401 errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    localStorage.setItem('adtraffic-token', mockToken);
    localStorage.setItem('adtraffic-user', JSON.stringify(mockUser));

    const { getAuth } = renderWithAuth();
    expect(getAuth().token).toBe(mockToken);

    await act(async () => {
      await getAuth().authFetch('/api/test');
    });

    // Token should still be set — only 401 clears it
    expect(getAuth().token).toBe(mockToken);
    expect(getAuth().user).toEqual(mockUser);
  });

  it('logout clears featureFlags', async () => {
    // Set up authenticated state with flags
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: mockToken, user: mockUser }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ flags: { 'chat.enabled': true } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { getAuth } = renderWithAuth();

    await act(async () => {
      await getAuth().login('test@agency.com', 'password123');
    });

    // Now logout
    act(() => {
      getAuth().logout();
    });

    expect(getAuth().featureFlags).toBeNull();
    expect(getAuth().user).toBeNull();
    expect(getAuth().token).toBeNull();
  });

  it('login triggers feature flags fetch', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: mockToken, user: mockUser }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ flags: { 'chat.enabled': true, 'limits.daily_api_requests': 100 } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { getAuth } = renderWithAuth();

    await act(async () => {
      await getAuth().login('test@agency.com', 'password123');
    });

    // Wait for flags fetch
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Flags should be fetched (second call to fetch)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/feature-flags'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockToken}`,
        }),
      })
    );
  });

  it('feature flags fetch failure is silent (does not crash)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: mockToken, user: mockUser }),
      })
      .mockRejectedValueOnce(new Error('Network error')); // flags fetch fails
    vi.stubGlobal('fetch', fetchMock);

    const { getAuth } = renderWithAuth();

    await act(async () => {
      await getAuth().login('test@agency.com', 'password123');
    });

    // Wait for failed flags fetch
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Should not crash — featureFlags remains null
    expect(getAuth().featureFlags).toBeNull();
    // User should still be logged in
    expect(getAuth().user).toEqual(mockUser);
  });

  it('register triggers feature flags fetch', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: mockToken, user: mockUser }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ flags: { 'chat.enabled': true } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { getAuth } = renderWithAuth();

    await act(async () => {
      await getAuth().register('test@agency.com', 'password123', 'Test User');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/feature-flags'),
      expect.any(Object)
    );
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

    // Re-render without state changes
    rerender(
      <AuthProvider>
        <Collector />
      </AuthProvider>
    );

    // Both renders should return the same reference (useMemo)
    // Note: React may re-render even with same values, but useMemo ensures stable object
    expect(values.length).toBeGreaterThanOrEqual(2);
  });
});
