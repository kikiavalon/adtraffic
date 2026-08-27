import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Users from '../pages/Users.js';
import { AuthProvider } from '../auth/AuthContext.js';

const USERS = [
  { id: 'a1', email: 'boss@agency.com', name: 'Boss', role: 'admin', active: true, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'e1', email: 'emp@agency.com', name: 'Emp', role: 'junior', active: true, createdAt: '2026-08-02T00:00:00.000Z' },
  { id: 'x1', email: 'gone@agency.com', name: 'Gone', role: 'junior', active: false, createdAt: '2026-08-03T00:00:00.000Z' },
];

type Handler = (url: string, method: string) => Promise<unknown>;
const okJson = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

function stubFetch(usersApi: Handler) {
  const fn = vi.fn((url: string, opts?: RequestInit) => {
    const method = (opts?.method ?? 'GET').toUpperCase();
    if (url.includes('/auth/me')) {
      return okJson({ user: { id: 'a1', email: 'boss@agency.com', name: 'Boss', role: 'admin' } });
    }
    if (url.includes('/auth/registration-status')) return okJson({ needsBootstrap: false, registrationOpen: false });
    if (url.includes('/api/v1/users')) return usersApi(url, method);
    return okJson({ flags: {}, connected: false });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const renderUsers = () => render(<MemoryRouter><AuthProvider><Users /></AuthProvider></MemoryRouter>);

describe('Users admin screen — deactivate / reactivate', () => {
  it('deactivates an active user via DELETE', async () => {
    const fetchMock = stubFetch((_url, method) =>
      method === 'DELETE' ? okJson({ user: { ...USERS[1], active: false } }) : okJson({ users: USERS }),
    );
    renderUsers();
    await screen.findByText('emp@agency.com');
    await userEvent.setup().click(screen.getByLabelText('Deactivate emp@agency.com'));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users/e1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('reactivates an inactive user via POST /reactivate', async () => {
    const fetchMock = stubFetch((url, method) =>
      method === 'POST' && url.includes('/reactivate') ? okJson({ user: { ...USERS[2], active: true } }) : okJson({ users: USERS }),
    );
    renderUsers();
    await screen.findByText('gone@agency.com');
    await userEvent.setup().click(screen.getByLabelText('Reactivate gone@agency.com'));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users/x1/reactivate'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('does not offer a Deactivate control for your own account', async () => {
    stubFetch(() => okJson({ users: USERS }));
    renderUsers();
    await screen.findByText('boss@agency.com');
    expect(screen.queryByLabelText('Deactivate boss@agency.com')).not.toBeInTheDocument();
  });
});
