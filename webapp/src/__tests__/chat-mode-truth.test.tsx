import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Chat from '../pages/Chat.js';

const mockAuthFetch = vi.fn();
const mockLogout = vi.fn();
const mockUser = { id: 'u1', email: 'test@agency.com', name: 'Test User' };
let mockCM360Connected: boolean | null = null;

vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    authFetch: mockAuthFetch,
    cm360Connected: mockCM360Connected,
  }),
}));

vi.mock('../components/ConversationSidebar.js', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

function renderChat() {
  return render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>
  );
}

describe('Chat mode truth', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    sessionStorage.clear();
    mockCM360Connected = null;
  });

  it('shows the demo-data chip when CM360 is not connected', () => {
    mockCM360Connected = false;
    renderChat();
    expect(screen.getByText('Demo data')).toBeInTheDocument();
  });

  it('shows the demo-data chip while connection status is unknown', () => {
    mockCM360Connected = null;
    renderChat();
    expect(screen.getByText('Demo data')).toBeInTheDocument();
  });

  it('shows the live chip when CM360 is connected', () => {
    mockCM360Connected = true;
    renderChat();
    expect(screen.getByText(/Live · CM360/)).toBeInTheDocument();
    expect(screen.queryByText('Demo data')).not.toBeInTheDocument();
  });

  it('does not render the decorative status dot', () => {
    renderChat();
    expect(document.querySelector('.status-dot')).toBeNull();
  });

  it('welcome message does not claim a hardcoded Demo Agency connection', () => {
    renderChat();
    expect(screen.queryByText(/connected to the Demo Agency account/)).not.toBeInTheDocument();
  });
});
