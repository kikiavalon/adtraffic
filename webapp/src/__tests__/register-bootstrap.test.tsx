import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Register from '../pages/Register.js';
import { AuthProvider } from '../auth/AuthContext.js';

function stubFetch(status: { needsBootstrap: boolean; registrationOpen: boolean }) {
  const fn = vi.fn((url: string) => {
    if (url.includes('/auth/registration-status')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(status) });
    }
    if (url.includes('/auth/me')) {
      return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });
    }
    if (url.includes('/auth/register')) {
      return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve({ token: 't', user: { id: 'u', email: 'x@y.com', name: 'X' } }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ flags: {}, connected: false }) });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function renderRegister() {
  return render(
    <MemoryRouter>
      <AuthProvider><Register /></AuthProvider>
    </MemoryRouter>,
  );
}

describe('Register — bootstrap (agency admin) signup', () => {
  it('shows the Agency field on a fresh instance (needsBootstrap)', async () => {
    stubFetch({ needsBootstrap: true, registrationOpen: true });
    renderRegister();
    expect(await screen.findByLabelText(/agency/i)).toBeInTheDocument();
  });

  it('hides the Agency field for a non-bootstrap (employee) signup', async () => {
    stubFetch({ needsBootstrap: false, registrationOpen: true });
    renderRegister();
    // Wait until the form is on screen, then confirm no Agency field appears.
    await screen.findByLabelText(/^email$/i);
    expect(screen.queryByLabelText(/agency/i)).not.toBeInTheDocument();
  });

  it('submits the agency value with the signup', async () => {
    const fetchMock = stubFetch({ needsBootstrap: true, registrationOpen: true });
    renderRegister();
    await screen.findByLabelText(/agency/i);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/name/i), 'Boss');
    await user.type(screen.getByLabelText(/^email$/i), 'boss@agency.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.type(screen.getByLabelText(/agency/i), 'Acme Media');
    await user.click(screen.getByRole('button', { name: /create|set up/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/register'),
        expect.objectContaining({ body: expect.stringContaining('"agency":"Acme Media"') }),
      );
    });
  });
});
