import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { PendingAction } from '@adtraffic/shared';
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

function makePendingAction(overrides: Partial<PendingAction> = {}): PendingAction {
  return {
    actionId: 'act-001',
    toolName: 'cm360_create_campaign',
    description: 'Create a new campaign for Apex Motors',
    riskLevel: 'standard',
    proposedAt: Date.now(),
    expiresAt: Date.now() + 300_000,
    preview: {
      entityType: 'Campaign',
      entityName: 'Apex Motors Q1 Display',
      operation: 'create',
      fields: [
        { field: 'Advertiser', value: 'Apex Motors' },
        { field: 'Name', value: 'Apex Motors Q1 Display' },
      ],
    },
    ...overrides,
  };
}

/** Helper to create a mock SSE response with specific events */
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

async function sendTestMessage(user: ReturnType<typeof userEvent.setup>, text = 'Create a campaign') {
  const input = screen.getByPlaceholderText('Message Kiki...');
  await user.type(input, text);
  await user.click(screen.getByRole('button', { name: /send/i }));
}

describe('Chat confirmation flow', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    sessionStorage.clear();
  });

  it('renders ConfirmationCard when confirmation_required SSE event is received', async () => {
    const action = makePendingAction();
    const events = [
      `data: ${JSON.stringify({ type: 'content_delta', delta: 'I will create that campaign for you.' })}\n\n`,
      `data: ${JSON.stringify({ type: 'confirmation_required', action })}\n\n`,
      `data: ${JSON.stringify({ type: 'done' })}\n\n`,
    ];
    mockAuthFetch.mockResolvedValue(createSSEResponse(events));

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    // Confirmation card should appear with the action details
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /confirmation/i })).toBeInTheDocument();
    });

    // Approve and Reject buttons should be present
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('calls approve API endpoint when Approve is clicked', async () => {
    const action = makePendingAction();
    const events = [
      `data: ${JSON.stringify({ type: 'confirmation_required', action })}\n\n`,
      `data: ${JSON.stringify({ type: 'done' })}\n\n`,
    ];

    // First call: SSE stream. Second call: approve API.
    mockAuthFetch
      .mockResolvedValueOnce(createSSEResponse(events))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          actionId: 'act-001',
          result: { id: 'camp-123', name: 'Apex Motors Q1 Display' },
          isError: false,
        }),
      });

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    // Wait for confirmation card to appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    });

    // Click approve
    await user.click(screen.getByRole('button', { name: /approve/i }));

    // Verify the approve API was called with the correct URL
    await waitFor(() => {
      const approveCalls = mockAuthFetch.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('/confirmations/act-001/approve')
      );
      expect(approveCalls).toHaveLength(1);
      expect(approveCalls[0]![1]).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  it('calls reject API endpoint when Reject is clicked', async () => {
    const action = makePendingAction();
    const events = [
      `data: ${JSON.stringify({ type: 'confirmation_required', action })}\n\n`,
      `data: ${JSON.stringify({ type: 'done' })}\n\n`,
    ];

    mockAuthFetch
      .mockResolvedValueOnce(createSSEResponse(events))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ actionId: 'act-001', rejected: true }),
      });

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    // Wait for confirmation card
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    });

    // Click reject
    await user.click(screen.getByRole('button', { name: /reject/i }));

    // Verify the reject API was called
    await waitFor(() => {
      const rejectCalls = mockAuthFetch.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('/confirmations/act-001/reject')
      );
      expect(rejectCalls).toHaveLength(1);
      expect(rejectCalls[0]![1]).toMatchObject({
        method: 'POST',
      });
    });
  });

  it('removes confirmation card and shows result message after successful approve', async () => {
    const action = makePendingAction();
    const events = [
      `data: ${JSON.stringify({ type: 'confirmation_required', action })}\n\n`,
      `data: ${JSON.stringify({ type: 'done' })}\n\n`,
    ];

    mockAuthFetch
      .mockResolvedValueOnce(createSSEResponse(events))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          actionId: 'act-001',
          result: 'Campaign "Apex Motors Q1 Display" created successfully (ID: camp-123)',
          isError: false,
        }),
      });

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /approve/i }));

    // Confirmation card should be removed and result message should appear
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /confirmation/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Apex Motors Q1 Display.*created successfully/)).toBeInTheDocument();
    });
  });

  it('removes confirmation card and shows cancellation message after successful reject', async () => {
    const action = makePendingAction();
    const events = [
      `data: ${JSON.stringify({ type: 'confirmation_required', action })}\n\n`,
      `data: ${JSON.stringify({ type: 'done' })}\n\n`,
    ];

    mockAuthFetch
      .mockResolvedValueOnce(createSSEResponse(events))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ actionId: 'act-001', rejected: true }),
      });

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /reject/i }));

    // Confirmation card should be removed and cancellation message shown
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /confirmation/i })).not.toBeInTheDocument();
      expect(screen.getByText(/cancelled that action/)).toBeInTheDocument();
    });
  });

  it('shows error message when approve API fails with isError', async () => {
    const action = makePendingAction();
    const events = [
      `data: ${JSON.stringify({ type: 'confirmation_required', action })}\n\n`,
      `data: ${JSON.stringify({ type: 'done' })}\n\n`,
    ];

    mockAuthFetch
      .mockResolvedValueOnce(createSSEResponse(events))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          actionId: 'act-001',
          result: null,
          isError: true,
          errorMessage: 'CM360 API returned 403: Insufficient permissions',
        }),
      });

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /approve/i }));

    // Should show error message, not success
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /confirmation/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Insufficient permissions/)).toBeInTheDocument();
    });
  });

  it('shows error message when approve API returns HTTP error', async () => {
    const action = makePendingAction();
    const events = [
      `data: ${JSON.stringify({ type: 'confirmation_required', action })}\n\n`,
      `data: ${JSON.stringify({ type: 'done' })}\n\n`,
    ];

    mockAuthFetch
      .mockResolvedValueOnce(createSSEResponse(events))
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Action not found or expired' }),
      });

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /confirmation/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Action not found or expired/)).toBeInTheDocument();
    });
  });

  it('shows error message when approve API throws network error', async () => {
    const action = makePendingAction();
    const events = [
      `data: ${JSON.stringify({ type: 'confirmation_required', action })}\n\n`,
      `data: ${JSON.stringify({ type: 'done' })}\n\n`,
    ];

    mockAuthFetch
      .mockResolvedValueOnce(createSSEResponse(events))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /confirmation/i })).not.toBeInTheDocument();
      expect(screen.getByText(/trouble completing that action/)).toBeInTheDocument();
    });
  });

  it('renders approve result as JSON when result is an object', async () => {
    const action = makePendingAction();
    const events = [
      `data: ${JSON.stringify({ type: 'confirmation_required', action })}\n\n`,
      `data: ${JSON.stringify({ type: 'done' })}\n\n`,
    ];

    mockAuthFetch
      .mockResolvedValueOnce(createSSEResponse(events))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          actionId: 'act-001',
          result: { id: 'camp-123', name: 'Apex Motors Q1 Display', status: 'ACTIVE' },
          isError: false,
        }),
      });

    const user = userEvent.setup();
    renderChat();
    await sendTestMessage(user);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /approve/i }));

    // Object result should be rendered as JSON
    await waitFor(() => {
      expect(screen.getByText(/camp-123/)).toBeInTheDocument();
    });
  });
});
