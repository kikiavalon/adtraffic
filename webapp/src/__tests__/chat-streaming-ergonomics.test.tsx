import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    cm360Connected: false,
  }),
}));

vi.mock('../components/ConversationSidebar.js', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

/** SSE response that stays open until release() is called. */
function createPendingSSEResponse() {
  let release!: () => void;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      new Promise<void>((resolve) => { release = resolve; }).then(() => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content_delta', delta: 'Done' })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'message_end', message: { id: 'r1', role: 'assistant', content: 'Done', timestamp: Date.now() } })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();
      });
    },
  });
  return [{
    ok: true,
    status: 200,
    body: stream,
    headers: new Headers({ 'Content-Type': 'text/event-stream' }),
  }, () => release()] as const;
}

function renderChat() {
  return render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>
  );
}

describe('Streaming ergonomics', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    sessionStorage.clear();
  });

  it('keeps the composer enabled while a response is streaming', async () => {
    const [response, release] = createPendingSSEResponse();
    mockAuthFetch.mockResolvedValue(response);
    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByPlaceholderText('Message Kiki...')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();

    release();
  });

  it('shows a Stop button while streaming that aborts the response', async () => {
    const [response] = createPendingSSEResponse();
    mockAuthFetch.mockResolvedValue(response);
    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    const stopBtn = await screen.findByRole('button', { name: /stop/i });
    await user.click(stopBtn);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    });
  });

  it('does not render an empty assistant bubble before the first delta arrives', async () => {
    const [response, release] = createPendingSSEResponse();
    mockAuthFetch.mockResolvedValue(response);
    const user = userEvent.setup();
    renderChat();

    const bubblesBefore = document.querySelectorAll('.chat-message-assistant').length;

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // No new assistant bubble until content actually streams
    expect(document.querySelectorAll('.chat-message-assistant').length).toBe(bubblesBefore);

    release();
    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  it('does not show the jump-to-latest pill by default', () => {
    renderChat();
    expect(screen.queryByRole('button', { name: /jump to latest/i })).not.toBeInTheDocument();
  });
});
