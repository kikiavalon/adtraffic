import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Chat from '../pages/Chat.js';
import ConversationSidebar from '../components/ConversationSidebar.js';

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

vi.mock('../components/ConversationSidebar.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../components/ConversationSidebar.js')>();
  return mod;
});

function setNarrowScreen() {
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
  Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 });
}

describe('Chat accessibility', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    sessionStorage.clear();
  });

  it('announces new messages via aria-live on the message list', () => {
    mockAuthFetch.mockResolvedValue({ ok: false });
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    );
    const main = document.querySelector('.chat-messages');
    expect(main).toHaveAttribute('aria-live', 'polite');
  });
});

describe('Sidebar overlay accessibility', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    setNarrowScreen();
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ conversations: [] }),
    });
  });

  it('closes the mobile sidebar on Escape', async () => {
    const user = userEvent.setup();
    render(
      <ConversationSidebar
        currentConversationId="c1"
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
        refreshKey={0}
      />
    );

    await user.click(screen.getByLabelText('Open sidebar'));
    expect(screen.getByText('Conversations')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByText('Conversations')).not.toBeInTheDocument();
    });
  });

  it('renders a backdrop that closes the mobile sidebar on click', async () => {
    const user = userEvent.setup();
    render(
      <ConversationSidebar
        currentConversationId="c1"
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
        refreshKey={0}
      />
    );

    await user.click(screen.getByLabelText('Open sidebar'));
    const backdrop = document.querySelector('.sidebar-backdrop');
    expect(backdrop).not.toBeNull();

    await user.click(backdrop as Element);
    await waitFor(() => {
      expect(screen.queryByText('Conversations')).not.toBeInTheDocument();
    });
  });
});
