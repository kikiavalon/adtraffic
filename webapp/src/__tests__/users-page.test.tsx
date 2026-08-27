import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Users from '../pages/Users.js';
import { AuthProvider } from '../auth/AuthContext.js';

const USERS = [
  { id: 'a1', email: 'boss@agency.com', name: 'Boss', role: 'admin', createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'e1', email: 'emp@agency.com', name: 'Emp', role: 'junior', createdAt: '2026-08-02T00:00:00.000Z' },
];

type Handler = (url: string, method: string, opts?: RequestInit) => Promise<unknown>;

function stubFetch(usersApi: Handler) {
  const fn = vi.fn((url: string, opts?: RequestInit) => {
    const method = (opts?.method ?? 'GET').toUpperCase();
    if (url.includes('/auth/me')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ user: { id: 'a1', email: 'boss@agency.com', name: 'Boss', role: 'admin' } }) });
    }
    if (url.includes('/auth/registration-status')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ needsBootstrap: false, registrationOpen: false }) });
    }
    if (url.includes('/api/v1/users')) return usersApi(url, method, opts);
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ flags: {}, connected: false }) });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const okJson = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

function renderUsers() {
  return render(<MemoryRouter><AuthProvider><Users /></AuthProvider></MemoryRouter>);
}

describe('Users admin screen', () => {
  it('lists the users', async () => {
    stubFetch(() => okJson({ users: USERS }));
    renderUsers();
    expect(await screen.findByText('boss@agency.com')).toBeInTheDocument();
    expect(screen.getByText('emp@agency.com')).toBeInTheDocument();
  });

  it('creates a user via the form and shows it', async () => {
    const created = { id: 'n1', email: 'new@agency.com', name: 'New', role: 'senior', createdAt: '2026-08-03T00:00:00.000Z' };
    const fetchMock = stubFetch((_url, method) =>
      method === 'POST' ? okJson({ user: created }, 201) : okJson({ users: USERS }),
    );
    renderUsers();
    await screen.findByText('boss@agency.com');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/name/i), 'New');
    await user.type(screen.getByLabelText(/email/i), 'new@agency.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /add user/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users'),
        expect.objectContaining({ method: 'POST', body: expect.stringContaining('"email":"new@agency.com"') }),
      );
    });
    expect(await screen.findByText('new@agency.com')).toBeInTheDocument();
  });

  it('changes a row role via the dropdown (PATCH)', async () => {
    const fetchMock = stubFetch((_url, method) =>
      method === 'PATCH' ? okJson({ user: { ...USERS[1], role: 'senior' } }) : okJson({ users: USERS }),
    );
    renderUsers();
    await screen.findByText('emp@agency.com');

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Role for emp@agency.com'), 'senior');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users/e1'),
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ role: 'senior' }) }),
      );
    });
  });
});
