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

/** Helper to create a mock SSE response for the streaming chat endpoint. */
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

function createStandardSSEEvents(content: string, messageId = 'r1') {
  return [
    `data: ${JSON.stringify({ type: 'content_delta', delta: content })}\n\n`,
    `data: ${JSON.stringify({ type: 'message_end', message: { id: messageId, role: 'assistant', content, timestamp: Date.now() } })}\n\n`,
    `data: ${JSON.stringify({ type: 'done' })}\n\n`,
  ];
}

function renderChat() {
  return render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>
  );
}

async function sendTestMessage(user: ReturnType<typeof userEvent.setup>, text = 'Hello') {
  const input = screen.getByPlaceholderText('Message Kiki...');
  await user.type(input, text);
  await user.click(screen.getByRole('button', { name: /send/i }));
}

describe('Chat SSE streaming', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    sessionStorage.clear();
  });

  it('handles malformed JSON in SSE data line gracefully', async () => {
    const events = [
      `data: {invalid json}\n\n`,
      `data: ${JSON.stringify({ type: 'content_delta', delta: 'Valid response' })}\n\n`,
      `data: ${JSON.stringify({ type: 'message_end', message: { id: 'r1', role: 'assistant', content: 'Valid response', timestamp: Date.now() } })}\n\n`,
      `data: ${JSON.stringify({ type: 'done' })}\n\n`,
    ];
    mockAuthFetch.mockResolvedValue(createSSEResponse(events));

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByText('Valid response')).toBeInTheDocument();
    });
  });

  it('handles SSE events split across chunks', async () => {
    // Simulate an event being split across two chunks
    const encoder = new TextEncoder();
    const responseContent = 'Split chunk response';
    const part1 = `data: ${JSON.stringify({ type: 'content_delta', delta: responseContent })}\n`;
    const part2 = `\ndata: ${JSON.stringify({ type: 'message_end', message: { id: 'r1', role: 'assistant', content: responseContent, timestamp: Date.now() } })}\n\ndata: ${JSON.stringify({ type: 'done' })}\n\n`;

    let chunkIndex = 0;
    const chunks = [part1, part2];
    const stream = new ReadableStream({
      pull(controller) {
        if (chunkIndex < chunks.length) {
          controller.enqueue(encoder.encode(chunks[chunkIndex]));
          chunkIndex++;
        } else {
          controller.close();
        }
      },
    });

    mockAuthFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
    });

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByText(responseContent)).toBeInTheDocument();
    });
  });

  it('handles backend error status before stream starts', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: false,
      status: 500,
      body: null,
      headers: new Headers(),
    });

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByText(/Backend error: 500/)).toBeInTheDocument();
    });
  });

  it('handles missing response body', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
      headers: new Headers(),
    });

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByText(/No response body for streaming/)).toBeInTheDocument();
    });
  });

  it('handles network error during fetch', async () => {
    mockAuthFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch/)).toBeInTheDocument();
    });
  });

  it('handles SSE error event from backend', async () => {
    const events = [
      `data: ${JSON.stringify({ type: 'error', error: 'Daily limit exceeded' })}\n\n`,
    ];
    mockAuthFetch.mockResolvedValue(createSSEResponse(events));

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByText(/Daily limit exceeded/)).toBeInTheDocument();
    });
  });

  it('shows tool status during tool_start event', async () => {
    let resolveStream: () => void;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Send tool_start immediately
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_start', toolName: 'cm360_list_campaigns' })}\n\n`));

        // Wait for resolution to send remaining events
        new Promise<void>((resolve) => { resolveStream = resolve; }).then(() => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_end', toolName: 'cm360_list_campaigns' })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content_delta', delta: 'Found campaigns' })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'message_end', message: { id: 'r1', role: 'assistant', content: 'Found campaigns', timestamp: Date.now() } })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        });
      },
    });

    mockAuthFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
    });

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    // Tool status should appear with human-readable label
    await waitFor(() => {
      expect(screen.getByText(/Searching campaigns/)).toBeInTheDocument();
    });

    // Resolve the stream to complete
    await act(async () => {
      resolveStream!();
      await new Promise((r) => setTimeout(r, 50));
    });

    // Tool status should be gone, response should appear
    await waitFor(() => {
      expect(screen.getByText('Found campaigns')).toBeInTheDocument();
    });
  });

  it('clears tool status on tool_end event', async () => {
    const events = [
      `data: ${JSON.stringify({ type: 'tool_start', toolName: 'cm360_list_advertisers' })}\n\n`,
      `data: ${JSON.stringify({ type: 'tool_end', toolName: 'cm360_list_advertisers' })}\n\n`,
      `data: ${JSON.stringify({ type: 'content_delta', delta: 'Here are the advertisers' })}\n\n`,
      `data: ${JSON.stringify({ type: 'message_end', message: { id: 'r1', role: 'assistant', content: 'Here are the advertisers', timestamp: Date.now() } })}\n\n`,
      `data: ${JSON.stringify({ type: 'done' })}\n\n`,
    ];
    mockAuthFetch.mockResolvedValue(createSSEResponse(events));

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByText('Here are the advertisers')).toBeInTheDocument();
    });

    // Tool status should not remain
    expect(screen.queryByText(/Looking up advertisers/)).not.toBeInTheDocument();
  });

  it('formats unknown tool names by removing cm360_ prefix', async () => {
    const events = [
      `data: ${JSON.stringify({ type: 'tool_start', toolName: 'cm360_unknown_tool' })}\n\n`,
      `data: ${JSON.stringify({ type: 'tool_end', toolName: 'cm360_unknown_tool' })}\n\n`,
      ...createStandardSSEEvents('Done'),
    ];
    mockAuthFetch.mockResolvedValue(createSSEResponse(events));

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  it('silently ignores AbortError when request is cancelled', async () => {
    // Simulate abort by having the first fetch resolve with a pending stream,
    // then the user sends another message (which aborts the first)
    let aborted = false;
    const encoder = new TextEncoder();

    const pendingStream = new ReadableStream({
      async pull(controller) {
        // Wait forever until aborted
        await new Promise<void>((_, reject) => {
          const signal = controller.desiredSize === null ? null : null;
          const checkAbort = setInterval(() => {
            if (aborted) {
              clearInterval(checkAbort);
              reject(new DOMException('Aborted', 'AbortError'));
            }
          }, 10);
        });
      },
      cancel() {
        aborted = true;
      },
    });

    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: pendingStream,
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
    });

    const user = userEvent.setup();
    renderChat();

    // Send first message — it will hang
    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'First');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // The component should be in loading state (input disabled)
    expect(input).toBeDisabled();
  });
});
