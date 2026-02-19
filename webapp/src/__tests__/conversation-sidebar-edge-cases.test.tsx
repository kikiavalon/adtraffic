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
  { id: 'conv-2', title: null, updatedAt: '2026-02-17T10:00:00Z' },
];

describe('ConversationSidebar edge cases', () => {
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

    // Default: wide screen
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

  it('renders "New conversation" for null title', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ conversations: mockConversations }),
    });

    render(<ConversationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Campaign setup')).toBeInTheDocument();
      expect(screen.getByText('New conversation')).toBeInTheDocument();
    });
  });

  it('formats dates in conversation list', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        conversations: [
          { id: 'conv-1', title: 'Test', updatedAt: '2026-02-18T10:00:00Z' },
        ],
      }),
    });

    render(<ConversationSidebar {...defaultProps} />);

    await waitFor(() => {
      // Date should be formatted by toLocaleDateString
      const dateEl = document.querySelector('.sidebar-item-date');
      expect(dateEl).toBeTruthy();
      expect(dateEl!.textContent).toBeTruthy();
    });
  });

  it('handles fetch error gracefully (shows no conversations)', async () => {
    mockAuthFetch.mockRejectedValue(new Error('Network error'));

    render(<ConversationSidebar {...defaultProps} />);

    await waitFor(() => {
      // Should show empty state, not crash
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    });
  });

  it('handles non-ok response gracefully', async () => {
    mockAuthFetch.mockResolvedValue({ ok: false });

    render(<ConversationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    });
  });

  it('handles message fetch failure when selecting conversation', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversations: mockConversations }),
      })
      .mockRejectedValueOnce(new Error('Network error')); // messages fetch fails

    const user = userEvent.setup();
    render(<ConversationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Campaign setup')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Campaign setup'));

    // onSelectConversation should NOT have been called (fetch failed)
    await new Promise((r) => setTimeout(r, 50));
    expect(defaultProps.onSelectConversation).not.toHaveBeenCalled();
  });

  it('closes sidebar on mobile after selecting a conversation', async () => {
    // Simulate narrow screen
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });

    mockAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversations: mockConversations }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: 'm1', role: 'user', content: 'Hi', timestamp: 1 }] }),
      });

    const user = userEvent.setup();
    render(<ConversationSidebar {...defaultProps} />);

    // Open sidebar
    const toggleBtn = screen.getByLabelText('Open sidebar');
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText('Campaign setup')).toBeInTheDocument();
    });

    // Select a conversation
    await user.click(screen.getByText('Campaign setup'));

    await waitFor(() => {
      expect(defaultProps.onSelectConversation).toHaveBeenCalled();
    });

    // Sidebar should be closed (toggle button should say "Open sidebar" again)
    await waitFor(() => {
      expect(screen.getByLabelText('Open sidebar')).toBeInTheDocument();
    });

    // Restore
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  it('closes sidebar on mobile after clicking New', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
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

    const user = userEvent.setup();
    render(<ConversationSidebar {...defaultProps} />);

    // Open sidebar
    await user.click(screen.getByLabelText('Open sidebar'));

    await waitFor(() => {
      expect(screen.getByText('+ New')).toBeInTheDocument();
    });

    // Click New
    await user.click(screen.getByText('+ New'));

    expect(defaultProps.onNewChat).toHaveBeenCalled();

    // Sidebar should close
    await waitFor(() => {
      expect(screen.getByLabelText('Open sidebar')).toBeInTheDocument();
    });

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  it('refetches conversations when refreshKey changes', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ conversations: mockConversations }),
    });

    const { rerender } = render(<ConversationSidebar {...defaultProps} refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('Campaign setup')).toBeInTheDocument();
    });

    // Should have fetched once
    const fetchCount = mockAuthFetch.mock.calls.length;

    // Change refreshKey
    rerender(<ConversationSidebar {...defaultProps} refreshKey={1} />);

    await waitFor(() => {
      expect(mockAuthFetch.mock.calls.length).toBeGreaterThan(fetchCount);
    });
  });

  it('toggle button shows correct aria-expanded state', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
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

    const user = userEvent.setup();
    render(<ConversationSidebar {...defaultProps} />);

    const toggleBtn = screen.getByLabelText('Open sidebar');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggleBtn);

    const closeBtn = screen.getByLabelText('Close sidebar');
    expect(closeBtn).toHaveAttribute('aria-expanded', 'true');

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });
});
