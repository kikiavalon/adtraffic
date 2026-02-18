import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Chat from '../pages/Chat.js';

const mockAuthFetch = vi.fn();
const mockLogout = vi.fn();
const mockUser = { id: 'u1', email: 'test@agency.com', name: 'Test User' };

vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    authFetch: mockAuthFetch,
  }),
}));

vi.mock('../components/ConversationSidebar.js', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

function renderChat() {
  return render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>
  );
}

describe('Chat', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    sessionStorage.clear();
  });

  it('renders welcome message on mount', () => {
    renderChat();
    expect(screen.getByText(/your CM360 trafficking assistant/)).toBeInTheDocument();
  });

  it('renders the sidebar component', () => {
    renderChat();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('sends message on Send button click', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        message: { id: 'r1', role: 'assistant', content: 'Response here', timestamp: Date.now() },
      }),
    });

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Hello Kiki');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // User message should appear
    expect(screen.getByText('Hello Kiki')).toBeInTheDocument();

    // Wait for assistant response
    await waitFor(() => {
      expect(screen.getByText('Response here')).toBeInTheDocument();
    });
  });

  it('sends message on Enter key (not shift+Enter)', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        message: { id: 'r1', role: 'assistant', content: 'Got it', timestamp: Date.now() },
      }),
    });

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Test message');
    await user.keyboard('{Enter}');

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('shows typing indicator while loading', async () => {
    // Create a promise we can control
    let resolveResponse: (value: unknown) => void;
    const responsePromise = new Promise((resolve) => {
      resolveResponse = resolve;
    });

    mockAuthFetch.mockReturnValue(responsePromise);

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Test');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // Typing indicator should be visible
    expect(screen.getByRole('status', { name: /kiki is typing/i })).toBeInTheDocument();

    // Resolve the response
    await act(async () => {
      resolveResponse!({
        ok: true,
        json: () => Promise.resolve({
          message: { id: 'r1', role: 'assistant', content: 'Done', timestamp: Date.now() },
        }),
      });
    });

    // Typing indicator should be gone
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /kiki is typing/i })).not.toBeInTheDocument();
    });
  });

  it('disables input while loading', async () => {
    let resolveResponse: (value: unknown) => void;
    mockAuthFetch.mockReturnValue(new Promise((resolve) => { resolveResponse = resolve; }));

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Test');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(input).toBeDisabled();

    await act(async () => {
      resolveResponse!({
        ok: true,
        json: () => Promise.resolve({
          message: { id: 'r1', role: 'assistant', content: 'Done', timestamp: Date.now() },
        }),
      });
    });

    await waitFor(() => {
      expect(input).not.toBeDisabled();
    });
  });

  it('clears input after sending', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        message: { id: 'r1', role: 'assistant', content: 'OK', timestamp: Date.now() },
      }),
    });

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(input).toHaveValue('');
  });

  it('shows New Chat button that resets messages', async () => {
    mockAuthFetch.mockResolvedValue({ ok: true });

    const user = userEvent.setup();
    renderChat();

    const newChatBtn = screen.getByTitle('Start new conversation');
    expect(newChatBtn).toBeInTheDocument();

    await user.click(newChatBtn);

    // Welcome message should still be visible (reset to initial state)
    expect(screen.getByText(/your CM360 trafficking assistant/)).toBeInTheDocument();
  });
});
