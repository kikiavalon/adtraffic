import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../pages/Settings.js';

const mockUser = { id: 'u1', email: 'test@agency.com', name: 'Test User' };
const mockLogout = vi.fn();
const mockAuthFetch = vi.fn();
const mockRefreshAnthropicStatus = vi.fn();
let mockFeatureFlags: Record<string, boolean | number> | null = null;

vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    authFetch: mockAuthFetch,
    featureFlags: mockFeatureFlags,
    refreshCM360Status: vi.fn(),
    refreshAnthropicStatus: mockRefreshAnthropicStatus,
  }),
}));

const mockUsage = {
  date: '2026-08-18',
  requests: 5,
  limit: 100,
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
  estimatedCost: '$0.03',
};

const INVALID_KEY_MESSAGE = "That API key didn't work — check it and try again.";

function createOkResponse(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}

// Per-test responder for all /settings/anthropic calls (status GET, PUT, DELETE).
let anthropicResponder: (url: string, opts?: { method?: string }) => Promise<unknown>;

function setupAuthFetch() {
  mockAuthFetch.mockImplementation((url: string, opts?: { method?: string }) => {
    if (url.includes('/settings/anthropic')) return anthropicResponder(url, opts);
    if (url.includes('/usage')) return Promise.resolve(createOkResponse(mockUsage));
    if (url.includes('/auth/google/status')) return Promise.resolve(createOkResponse({ connected: false }));
    return Promise.resolve(createOkResponse({}));
  });
}

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );
}

function passwordInput(): HTMLInputElement | null {
  return document.querySelector('input[type="password"]');
}

describe('Settings — Claude API key', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    mockRefreshAnthropicStatus.mockReset();
    mockFeatureFlags = null;
    anthropicResponder = () => Promise.resolve(createOkResponse({ connected: false }));
    setupAuthFetch();
  });

  it('renders a masked key input, Connect button, and console.anthropic.com link when not connected', async () => {
    anthropicResponder = () => Promise.resolve(createOkResponse({ connected: false }));

    renderSettings();

    await waitFor(() => {
      expect(passwordInput()).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
    const link = document.querySelector('a[href*="console.anthropic.com"]');
    expect(link).toBeTruthy();
  });

  it('connects successfully, shows last4 with a Connected marker, and refreshes status', async () => {
    anthropicResponder = (_url, opts) => {
      if (opts?.method === 'PUT') {
        return Promise.resolve(
          createOkResponse({ connected: true, last4: '1234', verifiedAt: '2026-08-18T00:00:00Z' }),
        );
      }
      return Promise.resolve(createOkResponse({ connected: false }));
    };

    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(passwordInput()).toBeTruthy();
    });

    await user.type(passwordInput()!, 'sk-ant-abc1234');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(screen.getByText(/1234/)).toBeInTheDocument();
    });
    // The connected marker (checkmark) is unique to the Claude API section.
    expect(screen.getByText(/Connected ✓/)).toBeInTheDocument();
    expect(mockRefreshAnthropicStatus).toHaveBeenCalled();
  });

  it('shows the inline error from a 400 and stays not connected', async () => {
    anthropicResponder = (_url, opts) => {
      if (opts?.method === 'PUT') {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: INVALID_KEY_MESSAGE }),
        });
      }
      return Promise.resolve(createOkResponse({ connected: false }));
    };

    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(passwordInput()).toBeTruthy();
    });

    await user.type(passwordInput()!, 'sk-ant-badkey');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(screen.getByText(INVALID_KEY_MESSAGE)).toBeInTheDocument();
    });
    // Section stays not-connected: the input is still present.
    expect(passwordInput()).toBeTruthy();
  });

  it('disconnects and returns to the not-connected state, refreshing status', async () => {
    anthropicResponder = (_url, opts) => {
      if (opts?.method === 'DELETE') {
        return Promise.resolve(createOkResponse({ connected: false }));
      }
      return Promise.resolve(createOkResponse({ connected: true, last4: '1234' }));
    };

    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/1234/)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /disconnect/i }));

    await waitFor(() => {
      expect(passwordInput()).toBeTruthy();
    });
    expect(mockRefreshAnthropicStatus).toHaveBeenCalled();
  });

  it('never renders the raw API key anywhere in the DOM', async () => {
    const rawKey = 'sk-ant-SECRET1234';
    anthropicResponder = (_url, opts) => {
      if (opts?.method === 'PUT') {
        return Promise.resolve(
          createOkResponse({ connected: true, last4: '1234', verifiedAt: '2026-08-18T00:00:00Z' }),
        );
      }
      return Promise.resolve(createOkResponse({ connected: false }));
    };

    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(passwordInput()).toBeTruthy();
    });

    await user.type(passwordInput()!, rawKey);
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(screen.getByText(/1234/)).toBeInTheDocument();
    });

    expect(document.body.textContent).not.toContain(rawKey);
  });
});
