import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const mockMessages = [
  { id: 'msg-1', role: 'user', content: 'Hello', timestamp: 1 },
  { id: 'msg-2', role: 'assistant', content: 'Hi!', timestamp: 2 },
];

describe('ConversationSidebar', () => {
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

    // Default: wide screen so sidebar is always visible
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

  it('shows "No conversations yet" when empty', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ conversations: [] }),
    });

    render(<ConversationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    });
  });

  it('renders conversation list from API', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ conversations: mockConversations }),
    });

    render(<ConversationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Campaign setup')).toBeInTheDocument();
      expect(screen.getByText('Tag generation')).toBeInTheDocument();
    });
  });

  it('calls onSelectConversation with messages when conversation clicked', async () => {
    // First call: list conversations. Second call: get messages.
    mockAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversations: mockConversations }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: mockMessages }),
      });

    const user = userEvent.setup();
    render(<ConversationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Campaign setup')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Campaign setup'));

    await waitFor(() => {
      expect(defaultProps.onSelectConversation).toHaveBeenCalledWith('conv-1', mockMessages);
    });
  });

  it('calls onNewChat when + New button clicked', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ conversations: [] }),
    });

    const user = userEvent.setup();
    render(<ConversationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('+ New')).toBeInTheDocument();
    });

    await user.click(screen.getByText('+ New'));
    expect(defaultProps.onNewChat).toHaveBeenCalled();
  });

  it('shows toggle button on narrow screens', () => {
    // Override matchMedia AND innerWidth to simulate narrow screen
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });

    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ conversations: [] }),
    });

    render(<ConversationSidebar {...defaultProps} />);

    expect(screen.getByLabelText('Open sidebar')).toBeInTheDocument();

    // Restore
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  it('highlights the active conversation', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ conversations: mockConversations }),
    });

    render(<ConversationSidebar {...defaultProps} currentConversationId="conv-1" />);

    await waitFor(() => {
      const activeBtn = screen.getByText('Campaign setup').closest('button');
      expect(activeBtn).toHaveClass('sidebar-item-active');
    });
  });
});
