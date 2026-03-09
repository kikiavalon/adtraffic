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

function createPendingSSEResponse() {
  let resolveStream: () => void;
  const content = 'Done';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      new Promise<void>((resolve) => { resolveStream = resolve; }).then(() => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content_delta', delta: content })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'message_end', message: { id: 'r1', role: 'assistant', content, timestamp: Date.now() } })}\n\n`));
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
  }, () => resolveStream()] as const;
}

function renderChat(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Chat />
    </MemoryRouter>
  );
}

describe('Chat edge cases', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    sessionStorage.clear();
  });

  it('rejects empty messages', async () => {
    const user = userEvent.setup();
    renderChat();

    // Try to send empty message
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeDisabled();

    // Type spaces only
    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, '   ');
    expect(sendBtn).toBeDisabled();
  });

  it('Send button disabled when input is empty', () => {
    renderChat();
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeDisabled();
  });

  it('Send button disabled while loading', async () => {
    const [response, resolve] = createPendingSSEResponse();
    mockAuthFetch.mockResolvedValue(response);

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Test');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // While loading, send button should be disabled
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();

    // Clean up
    resolve();
  });

  it('does not send on Shift+Enter (allows newline)', async () => {
    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Line one');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    // Should NOT have called authFetch (no message sent)
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it('renders user message as plain text', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse('Response'));

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Hello Kiki');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // User message should exist as plain text (not in a markdown container)
    const userMsg = screen.getByText('Hello Kiki');
    expect(userMsg.closest('.chat-message-user')).toBeTruthy();
  });

  it('renders assistant message with avatar and name', async () => {
    renderChat(); // Welcome message is an assistant message
    expect(screen.getByText('K')).toBeInTheDocument(); // Avatar
    // "Kiki" appears in both the sender label and the message body; check the sender element specifically
    const senderLabel = document.querySelector('.chat-message-sender');
    expect(senderLabel).toBeTruthy();
    expect(senderLabel!.textContent).toContain('Kiki');
  });

  it('persists messages to sessionStorage', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse('Stored response'));

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Test persist');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Stored response')).toBeInTheDocument();
    });

    // Check sessionStorage has the conversation
    const convId = sessionStorage.getItem('adtraffic-conv-id');
    expect(convId).toBeTruthy();
    const messages = sessionStorage.getItem(`adtraffic-messages-${convId}`);
    expect(messages).toBeTruthy();
    expect(messages).toContain('Stored response');
  });

  it('restores messages from sessionStorage on mount', () => {
    const convId = 'test-conv-123';
    const savedMessages = JSON.stringify([
      { id: 'welcome', role: 'assistant', content: 'Welcome!', timestamp: 1 },
      { id: 'msg-1', role: 'user', content: 'Saved message', timestamp: 2 },
      { id: 'msg-2', role: 'assistant', content: 'Saved response', timestamp: 3 },
    ]);

    sessionStorage.setItem('adtraffic-conv-id', convId);
    sessionStorage.setItem(`adtraffic-messages-${convId}`, savedMessages);

    renderChat();

    expect(screen.getByText('Saved message')).toBeInTheDocument();
    expect(screen.getByText('Saved response')).toBeInTheDocument();
  });

  it('New Chat clears messages and shows welcome', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createSSEResponse('First response'))
      .mockResolvedValueOnce({ ok: true }); // DELETE conversation call

    const user = userEvent.setup();
    renderChat();

    // Send a message first
    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Test');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('First response')).toBeInTheDocument();
    });

    // Click New Chat
    await user.click(screen.getByTitle('Start new conversation'));

    // Welcome message should be back
    expect(screen.getByText(/an AI assistant/i)).toBeInTheDocument();
    // The sent message should be gone
    expect(screen.queryByText('First response')).not.toBeInTheDocument();
  });

  it('New Chat attempts to delete conversation on server', async () => {
    mockAuthFetch.mockResolvedValue({ ok: true });

    const user = userEvent.setup();
    renderChat();

    await user.click(screen.getByTitle('Start new conversation'));

    // Should have called DELETE on the conversation
    expect(mockAuthFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/conversations\/.+/),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('shows user name in header', () => {
    renderChat();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('has Settings link in header', () => {
    renderChat();
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
  });

  it('has Sign Out button in header', () => {
    renderChat();
    expect(screen.getByTitle('Sign out')).toBeInTheDocument();
  });

  it('calls logout when Sign Out clicked', async () => {
    const user = userEvent.setup();
    renderChat();

    await user.click(screen.getByTitle('Sign out'));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('shows upload button', () => {
    renderChat();
    expect(screen.getByLabelText('Upload file')).toBeInTheDocument();
  });
});

describe('Chat extension context params', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    sessionStorage.clear();
  });

  it('auto-sends context message when advertiserId is in URL', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse('Got the context'));

    renderChat(['/?advertiserId=12345']);

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/chat/stream'),
        expect.objectContaining({
          body: expect.stringContaining('advertiser 12345'),
        })
      );
    });
  });

  it('auto-sends context message when campaignId is in URL', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse('Got the context'));

    renderChat(['/?campaignId=67890']);

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/chat/stream'),
        expect.objectContaining({
          body: expect.stringContaining('campaign 67890'),
        })
      );
    });
  });

  it('auto-sends context with both advertiser and campaign IDs', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse('Got the context'));

    renderChat(['/?advertiserId=12345&campaignId=67890']);

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/chat/stream'),
        expect.objectContaining({
          body: expect.stringContaining('advertiser 12345'),
        })
      );
    });

    // Should contain both in the same message
    const body = JSON.parse(mockAuthFetch.mock.calls[0]![1]!.body as string);
    expect(body.message).toContain('campaign 67890');
  });

  it('does nothing when no extension params are present', () => {
    renderChat(['/']);

    // Should not auto-send any message
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });
});
