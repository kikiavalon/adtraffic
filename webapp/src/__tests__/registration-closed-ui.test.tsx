import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login.js';
import Register from '../pages/Register.js';
import { AuthProvider } from '../auth/AuthContext.js';

function stub(status: { needsBootstrap: boolean; registrationOpen: boolean }) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/auth/registration-status')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(status) });
    }
    if (url.includes('/auth/me')) {
      return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ flags: {}, connected: false }) });
  }));
}

const renderWith = (node: ReactElement) =>
  render(<MemoryRouter><AuthProvider>{node}</AuthProvider></MemoryRouter>);

describe('Closed registration UI', () => {
  it('Login hides "Create one" when registration is closed', async () => {
    stub({ needsBootstrap: false, registrationOpen: false });
    renderWith(<Login />);
    await screen.findByText(/sign in to chat/i);
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /create one/i })).not.toBeInTheDocument(),
    );
  });

  it('Login shows "Create one" when registration is open', async () => {
    stub({ needsBootstrap: false, registrationOpen: true });
    renderWith(<Login />);
    expect(await screen.findByRole('link', { name: /create one/i })).toBeInTheDocument();
  });

  it('Register shows a closed message on a direct visit when registration is closed', async () => {
    stub({ needsBootstrap: false, registrationOpen: false });
    renderWith(<Register />);
    expect(await screen.findByText(/registration is closed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
  });
});
