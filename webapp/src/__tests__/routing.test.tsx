import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../auth/AuthContext.js';

// We test the route guards (ProtectedRoute / PublicRoute) from App.tsx
// by re-implementing them here to avoid the full App component tree
// (which pulls in Chat.tsx and its many dependencies).

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
  if (!authReady) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
  if (!authReady) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function TestRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ProtectedRoute><div>Chat Page</div></ProtectedRoute>} />
      <Route path="/login" element={<PublicRoute><div>Login Page</div></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><div>Register Page</div></PublicRoute>} />
      <Route path="/settings" element={<ProtectedRoute><div>Settings Page</div></ProtectedRoute>} />
    </Routes>
  );
}

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <TestRoutes />
      </AuthProvider>
    </MemoryRouter>
  );
}

/** Route /auth/me to establish (or deny) a session; other endpoints return empty-ok. */
function stubSession(authenticated: boolean) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/auth/me')) {
      return Promise.resolve(
        authenticated
          ? { ok: true, status: 200, json: () => Promise.resolve({ user: { id: '1', email: 'a@b.com', name: 'A' } }) }
          : { ok: false, status: 401, json: () => Promise.resolve({}) }
      );
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ flags: {}, connected: false }) });
  }));
}

describe('Routing', () => {
  beforeEach(() => {
    stubSession(false);
  });

  it('redirects to /login when accessing / unauthenticated', async () => {
    renderApp('/');
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Chat Page')).not.toBeInTheDocument();
  });

  it('renders Chat at / when authenticated', async () => {
    stubSession(true);
    renderApp('/');
    expect(await screen.findByText('Chat Page')).toBeInTheDocument();
  });

  it('renders Login at /login when unauthenticated', async () => {
    renderApp('/login');
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to / when accessing /login while authenticated', async () => {
    stubSession(true);
    renderApp('/login');
    expect(await screen.findByText('Chat Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('renders Settings at /settings when authenticated', async () => {
    stubSession(true);
    renderApp('/settings');
    expect(await screen.findByText('Settings Page')).toBeInTheDocument();
  });
});
