import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConversationSidebar from '../components/ConversationSidebar.js';

const mockAuthFetch = vi.fn();

vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    authFetch: mockAuthFetch,
  }),
}));

const mockConversations = [
  { id: 'conv-1', title: 'Campaign setup', updatedAt: '2026-02-18T10:00:00Z' },
  { id: 'conv-2', title: 'Tag generation', updatedAt: '2026-02-17T10:00:00Z' },
];

function mockListResponse() {
  return {
    ok: true,
    json: () => Promise.resolve({ conversations: mockConversations }),
  };
}

describe('ConversationSidebar delete action', () => {
  const defaultProps = {
    currentConversationId: 'conv-current',
    onSelectConversation: vi.fn(),
    onNewChat: vi.fn(),
    refreshKey: 0,
  };

  beforeEach(() => {
    mockAuthFetch.mockReset();
    defaultProps.onSelectConversation.mockReset();
    defaultProps.onNewChat.mockReset();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(min-width: 1024px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a delete button for each conversation', async () => {
    mockAuthFetch.mockResolvedValue(mockListResponse());
    render(<ConversationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Campaign setup')).toBeInTheDocument();
    });
    expect(screen.getAllByLabelText(/delete conversation/i)).toHaveLength(2);
  });

  it('does not delete when the confirmation is declined', async () => {
    mockAuthFetch.mockResolvedValue(mockListResponse());
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<ConversationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Campaign setup')).toBeInTheDocument();
    });
    await user.click(screen.getAllByLabelText(/delete conversation/i)[0]!);

    expect(mockAuthFetch).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('deletes on confirm and refreshes the list', async () => {
    mockAuthFetch.mockResolvedValue(mockListResponse());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<ConversationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Campaign setup')).toBeInTheDocument();
    });
    await user.click(screen.getAllByLabelText(/delete conversation/i)[0]!);

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/conversations/conv-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  it('starts a new chat when the current conversation is deleted', async () => {
    mockAuthFetch.mockResolvedValue(mockListResponse());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<ConversationSidebar {...defaultProps} currentConversationId="conv-1" />);

    await waitFor(() => {
      expect(screen.getByText('Campaign setup')).toBeInTheDocument();
    });
    await user.click(screen.getAllByLabelText(/delete conversation/i)[0]!);

    await waitFor(() => {
      expect(defaultProps.onNewChat).toHaveBeenCalled();
    });
  });
});
