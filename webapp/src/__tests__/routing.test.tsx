import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../auth/AuthContext.js';

// We test the route guards (ProtectedRoute / PublicRoute) from App.tsx
// by re-implementing them here to avoid the full App component tree
// (which pulls in Chat.tsx and its many dependencies).

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (token) return <Navigate to="/" replace />;
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

describe('Routing', () => {
  it('redirects to /login when accessing / unauthenticated', () => {
    renderApp('/');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Chat Page')).not.toBeInTheDocument();
  });

  it('renders Chat at / when authenticated', () => {
    localStorage.setItem('adtraffic-token', 'test-token');
    localStorage.setItem('adtraffic-user', JSON.stringify({ id: '1', email: 'a@b.com', name: 'A' }));

    renderApp('/');
    expect(screen.getByText('Chat Page')).toBeInTheDocument();
  });

  it('renders Login at /login when unauthenticated', () => {
    renderApp('/login');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to / when accessing /login while authenticated', () => {
    localStorage.setItem('adtraffic-token', 'test-token');
    localStorage.setItem('adtraffic-user', JSON.stringify({ id: '1', email: 'a@b.com', name: 'A' }));

    renderApp('/login');
    expect(screen.getByText('Chat Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('renders Settings at /settings when authenticated', () => {
    localStorage.setItem('adtraffic-token', 'test-token');
    localStorage.setItem('adtraffic-user', JSON.stringify({ id: '1', email: 'a@b.com', name: 'A' }));

    // Need to stub fetch for Settings component usage fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 200 }));

    renderApp('/settings');
    expect(screen.getByText('Settings Page')).toBeInTheDocument();
  });
});
