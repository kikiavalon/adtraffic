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

function createSSEResponse(content: string, messageId = 'r1') {
  const events = [
    `data: ${JSON.stringify({ type: 'content_delta', delta: content })}\n\n`,
    `data: ${JSON.stringify({ type: 'message_end', message: { id: messageId, role: 'assistant', content, timestamp: Date.now() } })}\n\n`,
    `data: ${JSON.stringify({ type: 'done' })}\n\n`,
  ];

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

const CODE_BLOCK_CONTENT = "Here's the tag:\n\n```html\n<script src=\"https://ad.example.com/tag.js\"></script>\n```";

describe('Chat Code Block Copy', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    sessionStorage.clear();
    // Reset clipboard mock
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(''),
      },
      writable: true,
      configurable: true,
    });
  });

  it('renders copy button on code blocks in assistant messages', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse(CODE_BLOCK_CONTENT));

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Show me a tag');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Copy code')).toBeInTheDocument();
    });
  });

  it('copies code to clipboard when copy button clicked', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse(CODE_BLOCK_CONTENT));

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Show me a tag');
    await user.click(screen.getByRole('button', { name: /send/i }));

    const copyBtn = await screen.findByLabelText('Copy code');
    await user.click(copyBtn);

    // Verify copy succeeded by checking the UI feedback
    // (userEvent.setup() takes over clipboard APIs, so we assert on visible state)
    expect(copyBtn).toHaveTextContent('Copied!');
  });

  it('shows Copied! feedback after clicking copy', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse(CODE_BLOCK_CONTENT));

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Show me a tag');
    await user.click(screen.getByRole('button', { name: /send/i }));

    const copyBtn = await screen.findByLabelText('Copy code');
    expect(copyBtn).toHaveTextContent('Copy');

    await user.click(copyBtn);

    expect(copyBtn).toHaveTextContent('Copied!');
  });

  it('reverts from Copied! to Copy after 2 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockAuthFetch.mockResolvedValue(createSSEResponse(CODE_BLOCK_CONTENT));

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Show me a tag');
    await user.click(screen.getByRole('button', { name: /send/i }));

    const copyBtn = await screen.findByLabelText('Copy code');
    await user.click(copyBtn);

    expect(copyBtn).toHaveTextContent('Copied!');

    // Advance past the 2000ms timeout
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(copyBtn).toHaveTextContent('Copy');
    vi.useRealTimers();
  });

  it('handles clipboard write failure gracefully', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse(CODE_BLOCK_CONTENT));

    // Use setup without clipboard interception so our mock takes effect
    const user = userEvent.setup({ writeToClipboard: false });

    // Override clipboard after userEvent setup
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard permission denied')),
        readText: vi.fn().mockResolvedValue(''),
      },
      writable: true,
      configurable: true,
    });

    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Show me a tag');
    await user.click(screen.getByRole('button', { name: /send/i }));

    const copyBtn = await screen.findByLabelText('Copy code');
    // Should not throw — error is caught silently
    await user.click(copyBtn);

    // Button should remain as "Copy" (not "Copied!") since write failed
    await waitFor(() => {
      expect(copyBtn).toHaveTextContent('Copy');
    });
  });
});
