import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
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

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Login failed');
      }

      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Registration failed');
      }

      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
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

  const value = useMemo(() => ({ user, token, login, register, logout, isLoading, authFetch }), [user, token, login, register, logout, isLoading, authFetch]);

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
