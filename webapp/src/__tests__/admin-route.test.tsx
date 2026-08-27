import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminRoute } from '../auth/routeGuards.js';
import { AuthProvider } from '../auth/AuthContext.js';

function stubFetch(role: string | null) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/auth/me')) {
      return Promise.resolve(
        role
          ? { ok: true, status: 200, json: () => Promise.resolve({ user: { id: '1', email: 'a@b.com', name: 'A', role } }) }
          : { ok: false, status: 401, json: () => Promise.resolve({}) },
      );
    }
    if (url.includes('/auth/registration-status')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ needsBootstrap: false, registrationOpen: false }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ flags: {}, connected: false }) });
  }));
}

function renderAt(role: string | null) {
  stubFetch(role);
  return render(
    <MemoryRouter initialEntries={['/users']}>
      <AuthProvider>
        <Routes>
          <Route path="/users" element={<AdminRoute><div>Users Admin</div></AdminRoute>} />
          <Route path="/" element={<div>Home</div>} />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminRoute', () => {
  it('renders children for an admin', async () => {
    renderAt('admin');
    expect(await screen.findByText('Users Admin')).toBeInTheDocument();
  });

  it('redirects a non-admin (senior) to home', async () => {
    renderAt('senior');
    expect(await screen.findByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Users Admin')).not.toBeInTheDocument();
  });

  it('sends an unauthenticated user to login', async () => {
    renderAt(null);
    expect(await screen.findByText('Login')).toBeInTheDocument();
    expect(screen.queryByText('Users Admin')).not.toBeInTheDocument();
  });
});
