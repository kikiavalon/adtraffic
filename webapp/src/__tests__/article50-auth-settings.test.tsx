import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login.js';
import Register from '../pages/Register.js';
import Settings from '../pages/Settings.js';

const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockLogout = vi.fn();
const mockAuthFetch = vi.fn();
const mockUser = { id: 'u1', email: 'test@agency.com', name: 'Test User' };

vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: mockUser,
    login: mockLogin,
    register: mockRegister,
    logout: mockLogout,
    authFetch: mockAuthFetch,
    isLoading: false,
    featureFlags: null,
  }),
}));

describe('EU AI Act — Auth pages AI disclosure', () => {
  it('Login page shows AI disclosure text', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByText(/uses AI/i)).toBeInTheDocument();
  });

  it('Register page shows AI disclosure text', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
    expect(screen.getByText(/uses AI/i)).toBeInTheDocument();
  });
});

describe('EU AI Act — Settings AI disclosure', () => {
  beforeEach(() => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ dailyRequests: 0, dailyLimit: 100, tokensUsed: 0, estimatedCost: 0 }),
    });
  });

  it('Settings page shows About AdTraffic.ai section', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    expect(screen.getByText('About AdTraffic.ai')).toBeInTheDocument();
  });

  it('About section mentions artificial intelligence', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    expect(screen.getByText(/artificial intelligence/i)).toBeInTheDocument();
  });

  it('About section mentions Claude by Anthropic', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    expect(screen.getByText(/Claude by Anthropic/i)).toBeInTheDocument();
  });
});
