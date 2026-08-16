import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Chat from '../pages/Chat.js';

const mockAuthFetch = vi.fn();
const mockLogout = vi.fn();
const mockUser = { id: 'u1', email: 'test@agency.com', name: 'Test User' };
let mockCM360Connected: boolean | null = false;

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

describe('Discovery and errors', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    sessionStorage.clear();
    mockCM360Connected = false;
  });

  it('shows a demo-data banner with a settings link when not connected', () => {
    renderChat();
    expect(screen.getByText(/exploring demo data/i)).toBeInTheDocument();
  });

  it('hides the demo banner when CM360 is connected', () => {
    mockCM360Connected = true;
    renderChat();
    expect(screen.queryByText(/exploring demo data/i)).not.toBeInTheDocument();
  });

  it('renders clickable starter chips on a fresh chat', () => {
    renderChat();
    expect(screen.getByRole('button', { name: 'What advertisers do we have?' })).toBeInTheDocument();
  });

  it('clicking a starter chip sends it as a message', async () => {
    mockAuthFetch.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    renderChat();

    await user.click(screen.getByRole('button', { name: 'What advertisers do we have?' }));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/stream'),
        expect.objectContaining({
          body: expect.stringContaining('What advertisers do we have?'),
        })
      );
    });
  });

  it('shows feedback when a file over 10MB is rejected', async () => {
    const user = userEvent.setup();
    renderChat();

    const bigFile = new File([''], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, bigFile);

    expect(await screen.findByText(/10MB/)).toBeInTheDocument();
  });

  it('shows human error copy with a retry action when a send fails', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText('Message Kiki...');
    await user.type(input, 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText(/didn't send/i)).toBeInTheDocument();
    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();

    mockAuthFetch.mockResolvedValueOnce({ ok: false });
    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      const streamCalls = mockAuthFetch.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('/chat/stream')
      );
      expect(streamCalls.length).toBe(2);
    });
  });
});
