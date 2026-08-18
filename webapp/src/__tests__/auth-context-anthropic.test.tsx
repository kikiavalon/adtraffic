import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth/AuthContext.js';

// Helper to render a component that uses the auth hook
function TestConsumer({ onAuth }: { onAuth: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  onAuth(auth);
  return (
    <div>
      <span data-testid="anthropic-connected">{String(auth.anthropicConnected)}</span>
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

// Route fetch by URL so anthropic assertions are precise regardless of the
// other fetches the initial-load effect fires (feature-flags + cm360 status).
function makeFetchMock(anthropicResponse: { connected: boolean; last4?: string }) {
  return vi.fn((url: string) => {
    if (url.includes('/settings/anthropic/status')) {
      return Promise.resolve({ ok: true, json: async () => anthropicResponse });
    }
    if (url.includes('/feature-flags')) {
      return Promise.resolve({ ok: true, json: async () => ({ flags: {} }) });
    }
    if (url.includes('/auth/google/status')) {
      return Promise.resolve({ ok: true, json: async () => ({ connected: false }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

describe('AuthContext — anthropic connection status', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  });

  it('calls GET /api/v1/settings/anthropic/status on initial load when authenticated', async () => {
    localStorage.setItem('adtraffic-token', mockToken);
    localStorage.setItem('adtraffic-user', JSON.stringify(mockUser));

    const fetchMock = makeFetchMock({ connected: true, last4: '1234' });
    vi.stubGlobal('fetch', fetchMock);

    renderWithAuth();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/settings/anthropic/status'),
        expect.anything()
      );
    });
  });

  it('sets anthropicConnected to true when the endpoint reports connected', async () => {
    localStorage.setItem('adtraffic-token', mockToken);
    localStorage.setItem('adtraffic-user', JSON.stringify(mockUser));

    vi.stubGlobal('fetch', makeFetchMock({ connected: true, last4: '1234' }));

    const { getAuth } = renderWithAuth();

    await waitFor(() => {
      expect(getAuth().anthropicConnected).toBe(true);
    });
  });

  it('sets anthropicConnected to false when the endpoint reports not connected', async () => {
    localStorage.setItem('adtraffic-token', mockToken);
    localStorage.setItem('adtraffic-user', JSON.stringify(mockUser));

    vi.stubGlobal('fetch', makeFetchMock({ connected: false }));

    const { getAuth } = renderWithAuth();

    await waitFor(() => {
      expect(getAuth().anthropicConnected).toBe(false);
    });
  });

  it('resets anthropicConnected to null after logout()', async () => {
    localStorage.setItem('adtraffic-token', mockToken);
    localStorage.setItem('adtraffic-user', JSON.stringify(mockUser));

    vi.stubGlobal('fetch', makeFetchMock({ connected: true, last4: '1234' }));

    const { getAuth } = renderWithAuth();

    await waitFor(() => {
      expect(getAuth().anthropicConnected).toBe(true);
    });

    act(() => {
      getAuth().logout();
    });

    expect(getAuth().anthropicConnected).toBeNull();
  });
});
