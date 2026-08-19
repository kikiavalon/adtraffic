import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
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

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
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
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('adtraffic-user');
    if (saved) {
      try { return JSON.parse(saved) as AuthUser; } catch { /* fall through */ }
    }
    return null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('adtraffic-token');
  });
  const [isLoading, setIsLoading] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null);
  const [cm360Connected, setCM360Connected] = useState<boolean | null>(null);
  const [anthropicConnected, setAnthropicConnected] = useState<boolean | null>(null);

  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  useEffect(() => {
    if (token && user) {
      localStorage.setItem('adtraffic-token', token);
      localStorage.setItem('adtraffic-user', JSON.stringify(user));
    } else {
      localStorage.removeItem('adtraffic-token');
      localStorage.removeItem('adtraffic-user');
    }
  }, [token, user]);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/feature-flags`, {
        headers: tokenRef.current ? { 'Authorization': `Bearer ${tokenRef.current}` } : {},
      });
      if (res.ok) {
        const data = await res.json() as FlagsResponse;
        setFeatureFlags(data.flags);
      }
    } catch { /* silently fail — flags are non-critical */ }
  }, []);

  const refreshCM360Status = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/google/status`, {
        headers: tokenRef.current ? { 'Authorization': `Bearer ${tokenRef.current}` } : {},
      });
      if (res.ok) {
        const data = await res.json() as ConnectionStatusResponse;
        setCM360Connected(data.connected === true);
      }
    } catch { /* status stays unknown — UI treats it as demo */ }
  }, []);

  const refreshAnthropicStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/settings/anthropic/status`, {
        headers: tokenRef.current ? { 'Authorization': `Bearer ${tokenRef.current}` } : {},
      });
      if (res.ok) {
        const data = await res.json() as ConnectionStatusResponse;
        setAnthropicConnected(data.connected === true);
      }
    } catch { /* status stays unknown */ }
  }, []);

  // Fetch flags on initial load when user is already authenticated
  useEffect(() => {
    if (token && user) { void fetchFlags(); void refreshCM360Status(); void refreshAnthropicStatus(); }
    // Runs once on mount; the initial-hydration effect intentionally omits deps.
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json() as ErrorResponse;
        throw new Error(data.error ?? 'Login failed');
      }

      const data = await res.json() as AuthResponse;
      setToken(data.token);
      setUser(data.user);
      tokenRef.current = data.token;
      // Fetch feature flags and CM360 connection status after login
      void fetchFlags();
      void refreshCM360Status();
      void refreshAnthropicStatus();
    } finally {
      setIsLoading(false);
    }
  }, [fetchFlags, refreshCM360Status, refreshAnthropicStatus]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!res.ok) {
        const data = await res.json() as ErrorResponse;
        throw new Error(data.error ?? 'Registration failed');
      }

      const data = await res.json() as AuthResponse;
      setToken(data.token);
      setUser(data.user);
      tokenRef.current = data.token;
      // Fetch feature flags and CM360 connection status after registration
      void fetchFlags();
      void refreshCM360Status();
      void refreshAnthropicStatus();
    } finally {
      setIsLoading(false);
    }
  }, [fetchFlags, refreshCM360Status, refreshAnthropicStatus]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setFeatureFlags(null);
    setCM360Connected(null);
    setAnthropicConnected(null);
    sessionStorage.clear();
  }, []);

  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        ...(tokenRef.current ? { 'Authorization': `Bearer ${tokenRef.current}` } : {}),
      },
    });

    if (res.status === 401) {
      setToken(null);
      setUser(null);
      localStorage.removeItem('adtraffic-token');
      localStorage.removeItem('adtraffic-user');
    }

    return res;
  }, []);

  const value = useMemo(() => ({ user, token, featureFlags, cm360Connected, refreshCM360Status, anthropicConnected, refreshAnthropicStatus, login, register, logout, isLoading, authFetch }), [user, token, featureFlags, cm360Connected, refreshCM360Status, anthropicConnected, refreshAnthropicStatus, login, register, logout, isLoading, authFetch]);

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
