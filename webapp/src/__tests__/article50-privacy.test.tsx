import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Privacy from '../pages/Privacy.js';

vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    logout: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    isLoading: false,
    authFetch: vi.fn(),
  }),
}));

describe('EU AI Act — Privacy Policy page', () => {
  it('renders Privacy Policy heading', () => {
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>
    );
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
  });

  it('includes AI Disclosure section', () => {
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>
    );
    expect(screen.getByText('AI Disclosure')).toBeInTheDocument();
  });

  it('mentions Claude by Anthropic', () => {
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>
    );
    const matches = screen.getAllByText(/Claude.*Anthropic/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('mentions data retention policy', () => {
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>
    );
    expect(screen.getByText('Data Retention')).toBeInTheDocument();
  });

  it('includes security section', () => {
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>
    );
    expect(screen.getByText('Security')).toBeInTheDocument();
  });
});
