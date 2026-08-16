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

describe('Settings usage field guards', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
  });

  it('renders without crashing when token fields are missing from usage response', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ date: '2026-08-15', requests: 0, limit: 100 }),
    });
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('0 / 100')).toBeInTheDocument();
    });
    expect(screen.getByText(/0 \(0 in \/ 0 out\)/)).toBeInTheDocument();
  });

  it('renders without crashing when usage response is an empty object', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('API Usage')).toBeInTheDocument();
    });
  });
});
