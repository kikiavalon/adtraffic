import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../auth/routeGuards.js';
import { AuthProvider } from '../auth/AuthContext.js';

function stubFetch(opts: { authenticated: boolean; needsBootstrap: boolean }) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/auth/registration-status')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ needsBootstrap: opts.needsBootstrap, registrationOpen: opts.needsBootstrap }),
      });
    }
    if (url.includes('/auth/me')) {
      return Promise.resolve(
        opts.authenticated
          ? { ok: true, status: 200, json: () => Promise.resolve({ user: { id: '1', email: 'a@b.com', name: 'A' } }) }
          : { ok: false, status: 401, json: () => Promise.resolve({}) },
      );
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ flags: {}, connected: false }) });
  }));
}

function renderGuarded(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<ProtectedRoute><div>Chat Page</div></ProtectedRoute>} />
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/register" element={<div>Register Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute — first-run redirect target', () => {
  it('sends an unauthenticated user to /register on a fresh instance (needsBootstrap)', async () => {
    stubFetch({ authenticated: false, needsBootstrap: true });
    renderGuarded('/');
    expect(await screen.findByText('Register Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('sends an unauthenticated user to /login when the instance is already set up', async () => {
    stubFetch({ authenticated: false, needsBootstrap: false });
    renderGuarded('/');
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Register Page')).not.toBeInTheDocument();
  });

  it('renders the protected page when authenticated', async () => {
    stubFetch({ authenticated: true, needsBootstrap: false });
    renderGuarded('/');
    expect(await screen.findByText('Chat Page')).toBeInTheDocument();
  });
});
