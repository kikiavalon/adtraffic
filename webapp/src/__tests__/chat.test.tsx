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

/**
 * Helper to create a mock SSE response for the streaming chat endpoint.
 * The Chat component reads from response.body as a ReadableStream.
 */
function createSSEResponse(content: string, messageId = 'r1') {
  const events = [
    `event: message_start\ndata: ${JSON.stringify({ type: 'message_start', messageId, conversationId: 'c1' })}\n\n`,
    `event: content_delta\ndata: ${JSON.stringify({ type: 'content_delta', delta: content })}\n\n`,
    `event: message_end\ndata: ${JSON.stringify({ type: 'message_end', message: { id: messageId, role: 'assistant', content, timestamp: Date.now() } })}\n\n`,
    `event: done\ndata: ${JSON.stringify({ type: 'done' })}\n\n`,
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

/**
 * Helper to create a pending SSE response that can be resolved later.
 * Returns [promise, resolve] so the test can control when events arrive.
 */
function createPendingSSEResponse() {
  let resolveStream: () => void;
  const content = 'Done';
  const messageId = 'r1';

  const events = [
    `event: message_start\ndata: ${JSON.stringify({ type: 'message_start', messageId, conversationId: 'c1' })}\n\n`,
    `event: content_delta\ndata: ${JSON.stringify({ type: 'content_delta', delta: content })}\n\n`,
    `event: message_end\ndata: ${JSON.stringify({ type: 'message_end', message: { id: messageId, role: 'assistant', content, timestamp: Date.now() } })}\n\n`,
    `event: done\ndata: ${JSON.stringify({ type: 'done' })}\n\n`,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Wait until resolved to emit events
      new Promise<void>((resolve) => {
        resolveStream = resolve;
      }).then(() => {
        for (const event of events) {
          controller.enqueue(encoder.encode(event));
        }
        controller.close();
      });
    },
  });

  const response = {
    ok: true,
    status: 200,
    body: stream,
    headers: new Headers({ 'Content-Type': 'text/event-stream' }),
  };

  return [response, () => resolveStream()] as const;
}

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
    expect(screen.getByText(/an AI assistant/i)).toBeInTheDocument();
  });

  it('renders the sidebar component', () => {
    renderChat();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('sends message on Send button click', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse('Response here'));

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
    mockAuthFetch.mockResolvedValue(createSSEResponse('Got it'));

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Test message');
    await user.keyboard('{Enter}');

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('shows typing indicator while loading', async () => {
    const [response, resolve] = createPendingSSEResponse();
    mockAuthFetch.mockResolvedValue(response);

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Test');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // Typing indicator should be visible while streaming hasn't completed
    expect(screen.getByRole('status', { name: /kiki ai is responding/i })).toBeInTheDocument();

    // Resolve the stream
    await act(async () => {
      resolve();
      // Give the stream time to process
      await new Promise((r) => setTimeout(r, 50));
    });

    // Typing indicator should be gone
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /kiki ai is responding/i })).not.toBeInTheDocument();
    });
  });

  it('keeps input enabled but send disabled while loading', async () => {
    const [response, resolve] = createPendingSSEResponse();
    mockAuthFetch.mockResolvedValue(response);

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Test');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(input).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();

    await act(async () => {
      resolve();
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => {
      expect(input).not.toBeDisabled();
    });
  });

  it('clears input after sending', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse('OK'));

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(input).toHaveValue('');
  });

  it('shows New Chat button that resets messages', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse('OK'));

    const user = userEvent.setup();
    renderChat();

    const newChatBtn = screen.getByTitle('Start new conversation');
    expect(newChatBtn).toBeInTheDocument();

    await user.click(newChatBtn);

    // Welcome message should still be visible (reset to initial state)
    expect(screen.getByText(/an AI assistant/i)).toBeInTheDocument();
  });
});
