import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../pages/Settings.js';

const mockUser = { id: 'u1', email: 'test@agency.com', name: 'Test User' };
const mockLogout = vi.fn();
const mockAuthFetch = vi.fn();

vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    authFetch: mockAuthFetch,
  }),
}));

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );
}

const mockUsage = {
  date: '2026-02-18',
  requests: 42,
  limit: 100,
  inputTokens: 5000,
  outputTokens: 3000,
  totalTokens: 8000,
  estimatedCost: '$0.12',
};

describe('Settings', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
  });

  it('renders user name and email', () => {
    mockAuthFetch.mockResolvedValue({ ok: false });
    renderSettings();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@agency.com')).toBeInTheDocument();
  });

  it('fetches /api/usage on mount', () => {
    mockAuthFetch.mockResolvedValue({ ok: false });
    renderSettings();
    expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/usage'));
  });

  it('displays usage data when fetch succeeds', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUsage),
    });
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('42 / 100')).toBeInTheDocument();
    });
    expect(screen.getByText('8,000 (5,000 in / 3,000 out)')).toBeInTheDocument();
    expect(screen.getByText('$0.12')).toBeInTheDocument();
  });

  it('shows error message when usage fetch fails', async () => {
    mockAuthFetch.mockResolvedValue({ ok: false });
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Failed to load usage data')).toBeInTheDocument();
    });
  });

  it('has back to chat link and sign out button', () => {
    mockAuthFetch.mockResolvedValue({ ok: false });
    renderSettings();
    expect(screen.getByText(/back to chat/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });
});
