import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../pages/Settings.js';

const mockUser = { id: 'u1', email: 'test@agency.com', name: 'Test User' };
const mockLogout = vi.fn();
const mockAuthFetch = vi.fn();
let mockFeatureFlags: Record<string, boolean | number> | null = null;

vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    authFetch: mockAuthFetch,
    featureFlags: mockFeatureFlags,
  }),
}));

const mockUsage = {
  date: '2026-02-19',
  requests: 42,
  limit: 100,
  inputTokens: 5000,
  outputTokens: 3000,
  totalTokens: 8000,
  estimatedCost: '$0.12',
};

const mockUsageHigh = {
  ...mockUsage,
  requests: 75,
};

const mockUsageDanger = {
  ...mockUsage,
  requests: 95,
};

const mockCM360Connected = {
  connected: true,
  scopes: ['https://www.googleapis.com/auth/dfatrafficking', 'https://www.googleapis.com/auth/dfareporting'],
  expiresAt: '2027-03-01T00:00:00Z',
};

const mockCM360Disconnected = {
  connected: false,
};

function createOkResponse(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}

function createErrorResponse() {
  return { ok: false };
}

function renderSettings(initialEntries: string[] = ['/settings']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Settings />
    </MemoryRouter>
  );
}

describe('Settings — Usage Bar', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    mockFeatureFlags = null;
  });

  it('shows normal usage bar (no warning class) below 70%', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage)) // usage: 42%
      .mockResolvedValueOnce(createOkResponse(mockCM360Disconnected)); // cm360

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('42 / 100')).toBeInTheDocument();
    });

    const barFill = document.querySelector('.usage-bar-fill');
    expect(barFill).toBeTruthy();
    expect(barFill!.classList.contains('usage-bar-warning')).toBe(false);
    expect(barFill!.classList.contains('usage-bar-danger')).toBe(false);
  });

  it('shows warning class at 70%+', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsageHigh)) // 75%
      .mockResolvedValueOnce(createOkResponse(mockCM360Disconnected));

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('75 / 100')).toBeInTheDocument();
    });

    const barFill = document.querySelector('.usage-bar-fill');
    expect(barFill!.classList.contains('usage-bar-warning')).toBe(true);
    expect(barFill!.classList.contains('usage-bar-danger')).toBe(false);
  });

  it('shows danger class at 90%+', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsageDanger)) // 95%
      .mockResolvedValueOnce(createOkResponse(mockCM360Disconnected));

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('95 / 100')).toBeInTheDocument();
    });

    const barFill = document.querySelector('.usage-bar-fill');
    expect(barFill!.classList.contains('usage-bar-danger')).toBe(true);
  });

  it('Refresh button refetches usage data', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage)) // initial usage
      .mockResolvedValueOnce(createOkResponse(mockCM360Disconnected)) // initial cm360
      .mockResolvedValueOnce(createOkResponse({ ...mockUsage, requests: 50 })); // refreshed usage

    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('42 / 100')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Refresh usage'));

    await waitFor(() => {
      expect(screen.getByText('50 / 100')).toBeInTheDocument();
    });
  });
});

describe('Settings — CM360 Connection', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    mockFeatureFlags = null;
  });

  it('shows loading state while fetching CM360 status', () => {
    // Never resolve — keep in loading state
    mockAuthFetch.mockReturnValue(new Promise(() => {}));

    renderSettings();

    expect(screen.getByText('Loading connection status...')).toBeInTheDocument();
  });

  it('shows connected state without exposing scopes or token expiry', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage))
      .mockResolvedValueOnce(createOkResponse(mockCM360Connected));

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
    expect(screen.queryByText(/dfatrafficking/)).not.toBeInTheDocument();
    expect(screen.queryByText('Token expires')).not.toBeInTheDocument();
    expect(screen.getByText(/Disconnect/)).toBeInTheDocument();
  });

  it('shows disconnected state with connect button', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage))
      .mockResolvedValueOnce(createOkResponse(mockCM360Disconnected));

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/Connect your Google CM360 account/)).toBeInTheDocument();
    });
    expect(screen.getByText('Connect CM360 Account')).toBeInTheDocument();
  });

  it('Connect button calls /auth/google/connect', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage))
      .mockResolvedValueOnce(createOkResponse(mockCM360Disconnected))
      .mockResolvedValueOnce(createOkResponse({ url: 'https://accounts.google.com/oauth' }));

    // Mock window.location.href assignment
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: '' },
      writable: true,
    });
    Object.defineProperty(window.location, 'href', {
      set: hrefSetter,
    });

    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Connect CM360 Account')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Connect CM360 Account'));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/auth/google/connect'));
    });
  });

  it('Disconnect button calls /auth/google/disconnect and shows toast', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage))
      .mockResolvedValueOnce(createOkResponse(mockCM360Connected))
      .mockResolvedValueOnce(createOkResponse({})); // disconnect response

    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Disconnect\u2026')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Disconnect\u2026'));
    await user.click(screen.getByText('Disconnect CM360'));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/google/disconnect'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('CM360 account disconnected')).toBeInTheDocument();
    });
  });

  it('shows error when CM360 status fetch fails', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage))
      .mockResolvedValueOnce(createErrorResponse()); // cm360 status fails

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Failed to load CM360 status')).toBeInTheDocument();
    });
  });

  it('shows error when disconnect fails', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage))
      .mockResolvedValueOnce(createOkResponse(mockCM360Connected))
      .mockResolvedValueOnce(createErrorResponse()); // disconnect fails

    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Disconnect\u2026')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Disconnect\u2026'));
    await user.click(screen.getByText('Disconnect CM360'));

    await waitFor(() => {
      expect(screen.getByText('Failed to disconnect')).toBeInTheDocument();
    });
  });

  it('shows Disconnecting... while action is in progress', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage))
      .mockResolvedValueOnce(createOkResponse(mockCM360Connected))
      .mockReturnValueOnce(new Promise(() => {})); // disconnect hangs

    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Disconnect\u2026')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Disconnect\u2026'));
    await user.click(screen.getByText('Disconnect CM360'));

    expect(screen.getByText('Disconnecting...')).toBeInTheDocument();
  });
});

describe('Settings — Feature Flags', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
  });

  it('displays feature flags when available', async () => {
    mockFeatureFlags = {
      'cm360.write_operations': true,
      'cm360.read_operations': true,
      'cm360.tag_generation': false,
      'limits.daily_api_requests': 100,
    };

    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage))
      .mockResolvedValueOnce(createOkResponse(mockCM360Disconnected));

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Features')).toBeInTheDocument();
    });

    expect(screen.getByText('CM360 Write Operations')).toBeInTheDocument();
    expect(screen.getByText('CM360 Read Operations')).toBeInTheDocument();
    expect(screen.getByText('Tag Generation')).toBeInTheDocument();
    expect(screen.getByText('Daily API Requests')).toBeInTheDocument();
  });

  it('shows Enabled/Disabled for boolean flags', async () => {
    mockFeatureFlags = {
      'cm360.write_operations': true,
      'cm360.tag_generation': false,
    };

    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage))
      .mockResolvedValueOnce(createOkResponse(mockCM360Disconnected));

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Features')).toBeInTheDocument();
    });

    const enabled = screen.getAllByText('Enabled');
    const disabled = screen.getAllByText('Disabled');
    expect(enabled.length).toBe(1);
    expect(disabled.length).toBe(1);
  });

  it('shows numeric value for numeric flags', async () => {
    mockFeatureFlags = {
      'limits.daily_api_requests': 100,
      'limits.max_tool_rounds': 5,
    };

    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage))
      .mockResolvedValueOnce(createOkResponse(mockCM360Disconnected));

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('does not show Features section when flags are null', async () => {
    mockFeatureFlags = null;

    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage))
      .mockResolvedValueOnce(createOkResponse(mockCM360Disconnected));

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('42 / 100')).toBeInTheDocument();
    });

    expect(screen.queryByText('Features')).not.toBeInTheDocument();
  });
});

describe('Settings — Toast', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    mockFeatureFlags = null;
  });

  it('shows toast on ?cm360=connected query param', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage))
      .mockResolvedValueOnce(createOkResponse(mockCM360Connected))
      .mockResolvedValueOnce(createOkResponse(mockCM360Connected)); // re-fetch after toast

    renderSettings(['/settings?cm360=connected']);

    await waitFor(() => {
      expect(screen.getByText('CM360 account connected successfully!')).toBeInTheDocument();
    });
  });

  it('auto-dismisses toast after 5 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockAuthFetch
      .mockResolvedValueOnce(createOkResponse(mockUsage))
      .mockResolvedValueOnce(createOkResponse(mockCM360Connected))
      .mockResolvedValueOnce(createOkResponse({})); // disconnect

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Disconnect\u2026')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Disconnect\u2026'));
    await user.click(screen.getByText('Disconnect CM360'));

    await waitFor(() => {
      expect(screen.getByText('CM360 account disconnected')).toBeInTheDocument();
    });

    // Advance past 5 seconds
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });

    expect(screen.queryByText('CM360 account disconnected')).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});

describe('Settings — Usage Error States', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    mockFeatureFlags = null;
  });

  it('shows error when backend is unreachable', async () => {
    mockAuthFetch.mockRejectedValue(new Error('Network error'));

    renderSettings();

    // Both usage and CM360 fetches fail, each producing an error message
    await waitFor(() => {
      const errors = screen.getAllByText('Could not connect to backend');
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });
});
