import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    featureFlags: null,
  }),
}));

vi.mock('../components/ConversationSidebar.js', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock('../utils/interaction-tracker.js', () => ({
  trackInteraction: vi.fn(),
  setAuthFetch: vi.fn(),
  startAutoFlush: () => vi.fn(),
  flushInteractions: vi.fn(),
}));

function renderChat() {
  return render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>
  );
}

describe('EU AI Act Article 50 Compliance', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    sessionStorage.clear();
  });

  describe('Chat header AI badge', () => {
    it('renders AI Assistant badge in the chat header', () => {
      renderChat();
      const badge = screen.getByText('AI Assistant');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('ai-badge');
    });

    it('AI badge has correct aria-label for screen readers', () => {
      renderChat();
      const badge = screen.getByText('AI Assistant');
      expect(badge).toHaveAttribute('aria-label', 'AI-powered assistant');
    });
  });

  describe('Message sender AI indicator', () => {
    it('renders AI indicator next to Kiki on assistant messages', () => {
      renderChat();
      // Welcome message is always rendered as assistant
      const aiIndicators = screen.getAllByText('AI');
      expect(aiIndicators.length).toBeGreaterThanOrEqual(1);
      // Each should have the small badge class
      aiIndicators.forEach((el) => {
        expect(el).toHaveClass('ai-badge-small');
      });
    });
  });

  describe('Welcome message AI disclosure', () => {
    it('welcome message identifies Kiki as an AI assistant', () => {
      renderChat();
      expect(screen.getByText(/an AI assistant/i)).toBeInTheDocument();
    });

    it('welcome message mentions being powered by Claude', () => {
      renderChat();
      expect(screen.getByText(/powered by Claude/i)).toBeInTheDocument();
    });
  });
});
