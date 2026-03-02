import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock the auth context
const mockAuthFetch = vi.fn();
vi.mock('../auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: { name: 'Test User', email: 'test@test.com' },
    logout: vi.fn(),
    authFetch: mockAuthFetch,
  }),
}));

import Chat from '../pages/Chat.js';

function renderChat() {
  return render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>,
  );
}

describe('Chat file upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // Re-establish matchMedia mock (vi.restoreAllMocks clears the setup file's mock)
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
    // Mock successful SSE response
    mockAuthFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'event: message_end\ndata: {"type":"message_end","message":{"id":"1","role":"assistant","content":"Got it!","timestamp":1}}\n\n'
              ),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('event: done\ndata: {"type":"done"}\n\n'),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    });
  });

  it('renders the upload button', () => {
    renderChat();
    const uploadBtn = screen.getByLabelText('Upload file');
    expect(uploadBtn).toBeInTheDocument();
  });

  it('shows attachment chip after file selection', async () => {
    renderChat();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    // Create a fake PDF file
    const file = new File(['fake-pdf-content'], 'campaign-io.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Should show the file chip
    await waitFor(() => {
      expect(screen.getByText(/campaign-io\.pdf/)).toBeInTheDocument();
    });
  });

  it('shows remove button on attachment chip', async () => {
    renderChat();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByLabelText('Remove attachment')).toBeInTheDocument();
    });
  });

  it('clears attachment when remove button clicked', async () => {
    renderChat();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/test\.pdf/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Remove attachment'));

    await waitFor(() => {
      expect(screen.queryByText(/test\.pdf/)).not.toBeInTheDocument();
    });
  });

  it('rejects files over 10MB', async () => {
    renderChat();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Create a file object that reports > 10MB
    const bigFile = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    // Should NOT show attachment chip (file rejected)
    await waitFor(() => {
      expect(screen.queryByText(/big\.pdf/)).not.toBeInTheDocument();
    });
  });

  it('sends attachment in request body when message sent with file', async () => {
    renderChat();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Attach a small file
    const file = new File(['test-content'], 'io.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/io\.csv/)).toBeInTheDocument();
    });

    // Type a message and send
    const input = screen.getByPlaceholderText('Message Kiki...');
    fireEvent.change(input, { target: { value: "Here's the IO" } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      // Find the chat/stream call (not the sidebar's conversation list fetch)
      const chatCall = mockAuthFetch.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/chat/stream'),
      );
      expect(chatCall).toBeDefined();
      const callBody = JSON.parse((chatCall![1] as { body: string }).body);
      expect(callBody.attachment).toBeDefined();
      expect(callBody.attachment.name).toBe('io.csv');
      expect(callBody.attachment.type).toBe('text/csv');
      expect(callBody.attachment.data).toBeDefined(); // base64
      expect(callBody.attachment.sizeBytes).toBe(file.size);
    });
  });

  it('clears attachment after sending', async () => {
    renderChat();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['content'], 'io.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/io\.pdf/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Message Kiki...');
    fireEvent.change(input, { target: { value: 'Parse this' } });
    fireEvent.click(screen.getByText('Send'));

    // After send, attachment chip should disappear
    await waitFor(() => {
      expect(screen.queryByText(/io\.pdf/)).not.toBeInTheDocument();
    });
  });
});
