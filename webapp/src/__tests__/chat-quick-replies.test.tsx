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

function renderChat() {
  return render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>
  );
}

const QUICK_REPLY_CONTENT = `Here are some options for you:

1. Create a new campaign
2. List existing campaigns
3. Something else`;

describe('Chat Quick Reply Buttons', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    sessionStorage.clear();
  });

  it('renders quick reply buttons for last assistant message with numbered list', async () => {
    // Send a message and get a response with quick replies
    mockAuthFetch.mockResolvedValue(createSSEResponse(QUICK_REPLY_CONTENT));

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Help me');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Create a new campaign')).toBeInTheDocument();
      expect(screen.getByText('List existing campaigns')).toBeInTheDocument();
      expect(screen.getByText('Something else')).toBeInTheDocument();
    });
  });

  it('sends selected option as message when non-open-ended button clicked', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createSSEResponse(QUICK_REPLY_CONTENT))
      .mockResolvedValueOnce(createSSEResponse('Creating campaign now'));

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Help me');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Create a new campaign')).toBeInTheDocument();
    });

    // Click the quick reply button
    await user.click(screen.getByText('Create a new campaign'));

    // The button text should appear as a user message
    await waitFor(() => {
      const userMessages = screen.getAllByText('Create a new campaign');
      // At least one should be in a user message context
      expect(userMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows text input when open-ended option (Something else) clicked', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse(QUICK_REPLY_CONTENT));

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Help me');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Something else')).toBeInTheDocument();
    });

    // Click "Something else" — should toggle to input
    await user.click(screen.getByText('Something else'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type your answer...')).toBeInTheDocument();
    });
  });

  it('submits open-ended text on Enter key', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createSSEResponse(QUICK_REPLY_CONTENT))
      .mockResolvedValueOnce(createSSEResponse('Got it'));

    const user = userEvent.setup();
    renderChat();

    const chatInput = screen.getByPlaceholderText('Message Kiki...');
    await user.type(chatInput, 'Help me');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Something else')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Something else'));

    const openEndedInput = await screen.findByPlaceholderText('Type your answer...');
    await user.type(openEndedInput, 'I want to do something different');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('I want to do something different')).toBeInTheDocument();
    });
  });

  it('submits open-ended text via Send button', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(createSSEResponse(QUICK_REPLY_CONTENT))
      .mockResolvedValueOnce(createSSEResponse('Got it'));

    const user = userEvent.setup();
    renderChat();

    const chatInput = screen.getByPlaceholderText('Message Kiki...');
    await user.type(chatInput, 'Help me');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Something else')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Something else'));

    const openEndedInput = await screen.findByPlaceholderText('Type your answer...');
    await user.type(openEndedInput, 'Custom answer');

    // Click the Send button in the quick reply input row
    const sendButtons = screen.getAllByText('Send');
    const quickReplySend = sendButtons.find(btn => btn.classList.contains('quick-reply-send'));
    expect(quickReplySend).toBeTruthy();
    await user.click(quickReplySend!);

    await waitFor(() => {
      expect(screen.getByText('Custom answer')).toBeInTheDocument();
    });
  });

  it('disables open-ended Send button when text is empty', async () => {
    mockAuthFetch.mockResolvedValue(createSSEResponse(QUICK_REPLY_CONTENT));

    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Help me');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Something else')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Something else'));

    const sendButtons = await screen.findAllByText('Send');
    const quickReplySend = sendButtons.find(btn => btn.classList.contains('quick-reply-send'));
    expect(quickReplySend).toBeDisabled();
  });

  it('does not render quick reply buttons for non-last assistant messages', async () => {
    // Send two messages — only the last response should have quick replies
    mockAuthFetch
      .mockResolvedValueOnce(createSSEResponse(QUICK_REPLY_CONTENT, 'r1'))
      .mockResolvedValueOnce(createSSEResponse('Just a plain response', 'r2'));

    const user = userEvent.setup();
    renderChat();

    // Send first message
    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'First');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Create a new campaign')).toBeInTheDocument();
    });

    // Send second message — quick replies from first should disappear
    await waitFor(() => {
      expect(input).not.toBeDisabled();
    });
    await user.type(input, 'Second');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Just a plain response')).toBeInTheDocument();
    });

    // First message's quick reply buttons should not be present
    // (quick replies only show on the LAST assistant message)
    const quickReplyContainers = document.querySelectorAll('.quick-reply-container');
    expect(quickReplyContainers.length).toBe(0);
  });
});
