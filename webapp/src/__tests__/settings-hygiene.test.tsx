import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../pages/Settings.js';

const mockUser = { id: 'u1', email: 'test@agency.com', name: 'Test User' };
const mockLogout = vi.fn();
const mockAuthFetch = vi.fn();
const mockRefreshCM360Status = vi.fn();

vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    authFetch: mockAuthFetch,
    refreshCM360Status: mockRefreshCM360Status,
  }),
}));

const usageResponse = {
  ok: true,
  json: () =>
    Promise.resolve({
      date: '2026-08-15',
      requests: 5,
      limit: 100,
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      estimatedCost: '$0.03',
    }),
};

function connectedStatusResponse(expiresAt: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        connected: true,
        scopes: ['https://www.googleapis.com/auth/dfatrafficking'],
        expiresAt,
      }),
  };
}

function mockFetchByUrl(expiresAt = new Date(Date.now() + 3600_000).toISOString()) {
  mockAuthFetch.mockImplementation((url: string) => {
    if (url.includes('/usage')) return Promise.resolve(usageResponse);
    if (url.includes('/auth/google/status')) return Promise.resolve(connectedStatusResponse(expiresAt));
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );
}

describe('Settings hygiene', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockRefreshCM360Status.mockReset();
  });

  it('does not expose internal API cost estimates', async () => {
    mockFetchByUrl();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText('5 / 100')).toBeInTheDocument();
    });
    expect(screen.queryByText('Estimated cost')).not.toBeInTheDocument();
    expect(screen.queryByText('$0.03')).not.toBeInTheDocument();
  });

  it('does not expose OAuth scope strings or token expiry when connected', async () => {
    mockFetchByUrl();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
    expect(screen.queryByText('Scopes')).not.toBeInTheDocument();
    expect(screen.queryByText('Token expires')).not.toBeInTheDocument();
  });

  it('asks for confirmation before disconnecting and can keep the connection', async () => {
    mockFetchByUrl();
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /disconnect/i }));
    expect(screen.getByText(/returns to demo data/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /keep connected/i }));
    expect(mockAuthFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/disconnect'),
      expect.anything()
    );
  });

  it('disconnects after explicit confirmation', async () => {
    mockFetchByUrl();
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /disconnect/i }));
    await user.click(screen.getByRole('button', { name: /^disconnect cm360$/i }));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/google/disconnect'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('shows an expired-connection state with a reconnect action', async () => {
    mockFetchByUrl(new Date(Date.now() - 3600_000).toISOString());
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/connection expired/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /reconnect/i })).toBeInTheDocument();
  });
});
