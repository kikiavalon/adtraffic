import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../pages/Settings.js';

const mockUser = { id: 'u1', email: 'test@agency.com', name: 'Test User' };
const mockLogout = vi.fn();
const mockAuthFetch = vi.fn();

vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    authFetch: mockAuthFetch,
    featureFlags: null,
    refreshCM360Status: vi.fn(),
    refreshAnthropicStatus: vi.fn(),
  }),
}));

const ACK_PHRASE = 'I understand the live CM360 path is unverified';
const ACK_WARNING =
  'The live CM360 path is unverified. None of the 70 tools has been exercised against Google’s production API.\nThis software writes to systems that control live ad spend.';

const mockUsage = { date: '2026-08-18', requests: 1, limit: 100, inputTokens: 0, outputTokens: 0, totalTokens: 0 };

function ok(data: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
}

/** URL-routed authFetch mock; records acknowledge/connect calls. */
function installFetchMock(overrides: { acknowledgeResponse?: () => Promise<unknown> } = {}) {
  const calls = { acknowledge: [] as unknown[], connect: 0 };
  mockAuthFetch.mockImplementation((url: string, init?: { body?: string }) => {
    if (url.includes('/api/v1/usage')) return ok(mockUsage);
    if (url.includes('/auth/google/status')) return ok({ connected: false });
    if (url.includes('/settings/anthropic/status')) return ok({ connected: false });
    if (url.includes('/auth/google/acknowledgment')) {
      return ok({ acknowledged: false, phrase: ACK_PHRASE, warningText: ACK_WARNING });
    }
    if (url.includes('/auth/google/acknowledge')) {
      calls.acknowledge.push(init?.body ? JSON.parse(init.body) : null);
      if (overrides.acknowledgeResponse) return overrides.acknowledgeResponse();
      return ok({ acknowledged: true });
    }
    if (url.includes('/auth/google/connect')) {
      calls.connect += 1;
      return ok({ url: 'https://accounts.google.com/oauth' });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
  return calls;
}

function mockLocationHref() {
  const hrefSetter = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, href: '' },
    writable: true,
  });
  Object.defineProperty(window.location, 'href', { set: hrefSetter });
  return hrefSetter;
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Settings />
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(screen.getByText('Connect CM360 Account')).toBeInTheDocument();
  });
  await user.click(screen.getByText('Connect CM360 Account'));
  await waitFor(() => {
    expect(screen.getByLabelText(/type the acknowledgment/i)).toBeInTheDocument();
  });
}

describe('Settings — live CM360 typed acknowledgment', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
  });

  it('clicking Connect opens the acknowledgment dialog instead of redirecting', async () => {
    const calls = installFetchMock();
    const user = userEvent.setup();

    await openDialog(user);

    // Warning content from DISCLAIMER.md is surfaced
    expect(screen.getByText(/writes to systems that control live ad spend/)).toBeInTheDocument();
    // The exact phrase to type is displayed
    expect(screen.getByText(ACK_PHRASE)).toBeInTheDocument();
    // No OAuth redirect has been requested yet
    expect(calls.connect).toBe(0);
    expect(calls.acknowledge).toHaveLength(0);
  });

  it('uses a typed text input, not a checkbox', async () => {
    installFetchMock();
    const user = userEvent.setup();

    await openDialog(user);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/type the acknowledgment/i)).toHaveAttribute('type', 'text');
  });

  it('keeps the continue button disabled until the exact phrase is typed', async () => {
    installFetchMock();
    const user = userEvent.setup();

    await openDialog(user);

    const continueBtn = screen.getByRole('button', { name: /acknowledge & continue/i });
    expect(continueBtn).toBeDisabled();

    await user.type(screen.getByLabelText(/type the acknowledgment/i), 'I understand');
    expect(continueBtn).toBeDisabled();
  });

  it('typing the exact phrase enables continue, posts the acknowledgment, then redirects to Google', async () => {
    const calls = installFetchMock();
    const hrefSetter = mockLocationHref();
    const user = userEvent.setup();

    await openDialog(user);

    await user.type(screen.getByLabelText(/type the acknowledgment/i), ACK_PHRASE);
    const continueBtn = screen.getByRole('button', { name: /acknowledge & continue/i });
    expect(continueBtn).toBeEnabled();

    await user.click(continueBtn);

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith('https://accounts.google.com/oauth');
    });
    expect(calls.acknowledge).toEqual([{ acknowledgment: ACK_PHRASE }]);
    expect(calls.connect).toBe(1);
  });

  it('Cancel closes the dialog without acknowledging or connecting', async () => {
    const calls = installFetchMock();
    const user = userEvent.setup();

    await openDialog(user);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/type the acknowledgment/i)).not.toBeInTheDocument();
    });
    expect(calls.acknowledge).toHaveLength(0);
    expect(calls.connect).toBe(0);
  });

  it('shows an error and does not redirect when the acknowledgment is rejected', async () => {
    const calls = installFetchMock({
      acknowledgeResponse: () =>
        Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'The acknowledgment must be typed exactly' }) }),
    });
    const hrefSetter = mockLocationHref();
    const user = userEvent.setup();

    await openDialog(user);

    await user.type(screen.getByLabelText(/type the acknowledgment/i), ACK_PHRASE);
    await user.click(screen.getByRole('button', { name: /acknowledge & continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/must be typed exactly/i)).toBeInTheDocument();
    });
    expect(hrefSetter).not.toHaveBeenCalled();
    expect(calls.connect).toBe(0);
  });
});
