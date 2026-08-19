import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

type FeatureFlags = Record<string, boolean | number>;

interface AuthResponse {
  token: string;
  user: AuthUser;
}

interface ErrorResponse {
  error?: string;
}

interface FlagsResponse {
  flags: FeatureFlags;
}

interface ConnectionStatusResponse {
  connected?: boolean;
}

interface MeResponse {
  user: AuthUser;
}

interface AuthContextType {
  user: AuthUser | null;
  /** True once a valid session has been established (cookie-backed). */
  isAuthenticated: boolean;
  /** False until the initial /auth/me session check has resolved. Routes should
   * wait for this before redirecting, to avoid a flash of the login page. */
  authReady: boolean;
  featureFlags: FeatureFlags | null;
  /** null = unknown (treat as demo), false = demo data, true = live CM360 */
  cm360Connected: boolean | null;
  refreshCM360Status: () => Promise<void>;
  /** null = unknown, false = no key connected, true = key connected */
  anthropicConnected: boolean | null;
  refreshAnthropicStatus: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null);
  const [cm360Connected, setCM360Connected] = useState<boolean | null>(null);
  const [anthropicConnected, setAnthropicConnected] = useState<boolean | null>(null);

  // The JWT lives in an httpOnly cookie the client cannot read; every request
  // sends it automatically via credentials: 'include'.
  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/feature-flags`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as FlagsResponse;
        setFeatureFlags(data.flags);
      }
    } catch { /* silently fail — flags are non-critical */ }
  }, []);

  const refreshCM360Status = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/google/status`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as ConnectionStatusResponse;
        setCM360Connected(data.connected === true);
      }
    } catch { /* status stays unknown — UI treats it as demo */ }
  }, []);

  const refreshAnthropicStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/settings/anthropic/status`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as ConnectionStatusResponse;
        setAnthropicConnected(data.connected === true);
      }
    } catch { /* status stays unknown */ }
  }, []);

  const loadSessionExtras = useCallback(() => {
    void fetchFlags();
    void refreshCM360Status();
    void refreshAnthropicStatus();
  }, [fetchFlags, refreshCM360Status, refreshAnthropicStatus]);

  // On load, ask the server who we are. A valid session cookie yields the user;
  // anything else leaves us logged out. authReady gates routing either way.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/me`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json() as MeResponse;
          setUser(data.user);
          loadSessionExtras();
        }
      } catch { /* not authenticated */ }
      finally {
        setAuthReady(true);
      }
    })();
    // Runs once on mount.
  }, [loadSessionExtras]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json() as ErrorResponse;
        throw new Error(data.error ?? 'Login failed');
      }

      const data = await res.json() as AuthResponse;
      // The token arrives in an httpOnly cookie; we keep only the user profile.
      setUser(data.user);
      loadSessionExtras();
    } finally {
      setIsLoading(false);
    }
  }, [loadSessionExtras]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json() as ErrorResponse;
        throw new Error(data.error ?? 'Registration failed');
      }

      const data = await res.json() as AuthResponse;
      setUser(data.user);
      loadSessionExtras();
    } finally {
      setIsLoading(false);
    }
  }, [loadSessionExtras]);

  const logout = useCallback(() => {
    // Clear the httpOnly cookie server-side; fire-and-forget.
    void fetch(`${API_URL}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    setFeatureFlags(null);
    setCM360Connected(null);
    setAnthropicConnected(null);
    sessionStorage.clear();
  }, []);

  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: { ...options?.headers },
    });

    if (res.status === 401) {
      // Session expired or revoked — drop to the logged-out state.
      setUser(null);
    }

    return res;
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      authReady,
      featureFlags,
      cm360Connected,
      refreshCM360Status,
      anthropicConnected,
      refreshAnthropicStatus,
      login,
      register,
      logout,
      isLoading,
      authFetch,
    }),
    [user, authReady, featureFlags, cm360Connected, refreshCM360Status, anthropicConnected, refreshAnthropicStatus, login, register, logout, isLoading, authFetch],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
