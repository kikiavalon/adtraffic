import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext.js';

/**
 * Gate for authenticated-only routes. Unauthenticated visitors are sent to the
 * signup screen on a fresh instance (needsBootstrap → create the agency admin)
 * and to login once the instance is set up. We render nothing until both the
 * session check and the registration status have resolved, to avoid a flash of
 * the wrong screen.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady, needsBootstrap } = useAuth();
  if (!authReady) return null;
  if (!isAuthenticated) {
    if (needsBootstrap === null) return null; // wait for registration-status
    return <Navigate to={needsBootstrap ? '/register' : '/login'} replace />;
  }
  return <>{children}</>;
}

/** Gate for the auth screens: send already-authenticated users home. */
export function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
  if (!authReady) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Gate for admin-only routes (user management). Non-admins are sent home;
 *  unauthenticated visitors go to login. */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady, user } = useAuth();
  if (!authReady) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}
