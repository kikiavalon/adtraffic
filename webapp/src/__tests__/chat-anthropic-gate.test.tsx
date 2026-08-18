import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Chat from '../pages/Chat.js';

const mockAuthFetch = vi.fn();
const mockLogout = vi.fn();
const mockRefreshAnthropicStatus = vi.fn();
const mockUser = { id: 'u1', email: 'test@agency.com', name: 'Test User' };

// Mutable so each test can pick the anthropicConnected state under test.
let mockAnthropicConnected: boolean | null = null;

vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    authFetch: mockAuthFetch,
    cm360Connected: false,
    anthropicConnected: mockAnthropicConnected,
    refreshAnthropicStatus: mockRefreshAnthropicStatus,
  }),
}));

vi.mock('../components/ConversationSidebar.js', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

/** Mock SSE response emitting the provided raw event strings. */
function createSSEResponse(events: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    },
  });

  return {
    ok: true,
    status: 200,
    body: stream,
    headers: new Headers({ 'Content-Type': 'text/event-stream' }),
  };
}

function renderChat() {
  return render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>
  );
}

const BANNER_PHRASE = /Connect your Claude API key in Settings/i;

/**
 * The banner text is split across a <Link>, so match on the banner element's
 * full textContent rather than a single text node.
 */
function findBanner(): HTMLElement | null {
  return screen.queryByText(
    (_content, el) =>
      el?.classList.contains('key-missing-banner') === true &&
      BANNER_PHRASE.test(el.textContent ?? '')
  );
}

describe('Chat — Claude API key gate', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    mockRefreshAnthropicStatus.mockReset();
    mockAnthropicConnected = null;
    sessionStorage.clear();
  });

  it('gates the composer when anthropicConnected is false', () => {
    mockAnthropicConnected = false;
    renderChat();

    expect(screen.getByPlaceholderText('Message Kiki...')).toBeDisabled();

    const banner = findBanner();
    expect(banner).toBeInTheDocument();

    // The banner links to Settings.
    const settingsLink = banner?.querySelector('a[href="/settings"]');
    expect(settingsLink).toBeTruthy();
  });

  it('does not gate when anthropicConnected is true', () => {
    mockAnthropicConnected = true;
    renderChat();

    expect(screen.getByPlaceholderText('Message Kiki...')).not.toBeDisabled();
    expect(findBanner()).not.toBeInTheDocument();
  });

  it('does not gate when anthropicConnected is null (unknown)', () => {
    mockAnthropicConnected = null;
    renderChat();

    expect(screen.getByPlaceholderText('Message Kiki...')).not.toBeDisabled();
    expect(findBanner()).not.toBeInTheDocument();
  });

  it('surfaces the prompt when a send yields a no_anthropic_key SSE error', async () => {
    mockAnthropicConnected = true;
    mockAuthFetch.mockResolvedValue(
      createSSEResponse([
        `event: error\ndata: ${JSON.stringify({
          type: 'error',
          error: 'Connect your Claude API key in Settings to chat.',
          code: 'no_anthropic_key',
        })}\n\n`,
      ])
    );

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // Banner appears and composer disables after the no-key error.
    await waitFor(() => {
      expect(findBanner()).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Message Kiki...')).toBeDisabled();
  });
});
