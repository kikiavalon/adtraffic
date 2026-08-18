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

function makeSSEResponse(content = 'Got it!') {
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              `event: message_end\ndata: {"type":"message_end","message":{"id":"1","role":"assistant","content":"${content}","timestamp":1}}\n\n`
            ),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: done\ndata: {"type":"done"}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }),
    },
  };
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

    // Mock authFetch to handle both upload and chat/stream endpoints
    mockAuthFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/upload')) {
        // Upload endpoint returns JSON with extracted text
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ filename: 'campaign-io.pdf', extractedText: 'Extracted IO placement data' }),
        });
      }
      // Chat/stream endpoint returns SSE ReadableStream
      return Promise.resolve(makeSSEResponse());
    });
  });

  it('renders the upload button', () => {
    renderChat();
    const uploadBtn = screen.getByLabelText('Upload file');
    expect(uploadBtn).toBeInTheDocument();
  });

  it('uploads file to backend on selection and sends extracted text as message', async () => {
    renderChat();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(['fake-pdf-content'], 'campaign-io.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Should call the upload endpoint
    await waitFor(() => {
      const uploadCall = mockAuthFetch.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/upload'),
      );
      expect(uploadCall).toBeDefined();
    });
  });

  it('sends extracted text as chat message after successful upload', async () => {
    renderChat();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // After upload, should send extracted text via chat/stream
    await waitFor(() => {
      const chatCall = mockAuthFetch.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/chat/stream'),
      );
      expect(chatCall).toBeDefined();
      const body = JSON.parse((chatCall![1] as { body: string }).body);
      expect(body.message).toContain('[IO Upload:');
      expect(body.message).toContain('Extracted IO placement data');
    });
  });

  it('shows error message when upload fails', async () => {
    // Override mock to return upload failure
    mockAuthFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/upload')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'File too large' }),
        });
      }
      return Promise.resolve(makeSSEResponse());
    });

    renderChat();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['content'], 'bad-file.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/couldn't process the file/)).toBeInTheDocument();
    });
  });

  it('rejects files over 10MB', async () => {
    renderChat();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Create a file object that reports > 10MB
    const bigFile = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    // Should NOT call the upload endpoint (rejected client-side)
    await waitFor(() => {
      const uploadCall = mockAuthFetch.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/upload'),
      );
      expect(uploadCall).toBeUndefined();
    });
  });

  it('disables upload button while uploading', async () => {
    // Make upload take time by returning a never-resolving promise initially
    let resolveUpload: (value: unknown) => void;
    mockAuthFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/upload')) {
        return new Promise((resolve) => { resolveUpload = resolve; });
      }
      return Promise.resolve(makeSSEResponse());
    });

    renderChat();
    const uploadBtn = screen.getByLabelText('Upload file');
    expect(uploadBtn).not.toBeDisabled();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'io.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Button should be disabled while uploading
    await waitFor(() => {
      expect(screen.getByLabelText('Upload file')).toBeDisabled();
    });

    // Resolve the upload
    resolveUpload!({
      ok: true,
      json: () => Promise.resolve({ filename: 'io.pdf', extractedText: 'data' }),
    });

    // Button should be re-enabled after upload completes
    await waitFor(() => {
      expect(screen.getByLabelText('Upload file')).not.toBeDisabled();
    });
  });

  it('accepts only PDF, Excel, and CSV files', () => {
    renderChat();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe('.pdf,.xlsx,.xls,.csv');
  });
});
