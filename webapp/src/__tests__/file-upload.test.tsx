import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  }),
}));

vi.mock('../components/ConversationSidebar.js', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

function createSSEResponse(content: string, messageId = 'r1') {
  const events = [
    `data: ${JSON.stringify({ type: 'content_delta', delta: content })}\n\n`,
    `data: ${JSON.stringify({ type: 'message_end', message: { id: messageId, role: 'assistant', content, timestamp: Date.now() } })}\n\n`,
    `data: ${JSON.stringify({ type: 'done' })}\n\n`,
  ];

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

function createUploadResponse(filename: string, extractedText: string) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ filename, mimeType: 'application/pdf', sizeBytes: 1024, extractedText }),
    headers: new Headers({ 'Content-Type': 'application/json' }),
  };
}

function createErrorResponse(status: number, error: string) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
    headers: new Headers({ 'Content-Type': 'application/json' }),
  };
}

function renderChat() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Chat />
    </MemoryRouter>,
  );
}

function createTestFile(name: string, type: string, content = 'file-content') {
  return new File([content], name, { type });
}

describe('File upload', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
    mockLogout.mockReset();
    sessionStorage.clear();
  });

  it('upload button triggers file input click', async () => {
    const user = userEvent.setup();
    renderChat();

    const uploadBtn = screen.getByRole('button', { name: /upload file/i });
    expect(uploadBtn).toBeInTheDocument();

    // The hidden file input should exist
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    // Mock the click method on the file input
    const clickSpy = vi.spyOn(fileInput, 'click');
    await user.click(uploadBtn);
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('selecting a file calls the upload API', async () => {
    const user = userEvent.setup();
    renderChat();

    // Mock upload response + SSE for the subsequent sendMessage
    mockAuthFetch
      .mockResolvedValueOnce(createUploadResponse('test.pdf', 'Extracted text from PDF'))
      .mockResolvedValueOnce(createSSEResponse('I found placement data in that IO.'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createTestFile('test.pdf', 'application/pdf');

    await user.upload(fileInput, file);

    // Wait for the upload API call
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/upload'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        }),
      );
    });
  });

  it('successful upload sends extracted text as message to Kiki', async () => {
    const user = userEvent.setup();
    renderChat();

    const extractedText = 'Campaign: Summer 2026\nPlacement: Homepage Banner 300x250';

    // Mock upload response + SSE for the subsequent sendMessage
    mockAuthFetch
      .mockResolvedValueOnce(createUploadResponse('media-plan.pdf', extractedText))
      .mockResolvedValueOnce(createSSEResponse('I see a campaign and placement in that IO.'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createTestFile('media-plan.pdf', 'application/pdf');

    await user.upload(fileInput, file);

    // Wait for the SSE call (second authFetch call) to be made with the IO Upload message
    await waitFor(() => {
      const calls = mockAuthFetch.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      // Second call should be the SSE chat/stream with the IO Upload message
      const streamCall = calls[1]!;
      expect(streamCall[0]).toContain('/api/v1/chat/stream');
      const body = JSON.parse((streamCall[1] as RequestInit).body as string) as { message: string };
      expect(body.message).toContain('[IO Upload: media-plan.pdf]');
      expect(body.message).toContain(extractedText);
    });

    // The user message should appear in the chat
    await waitFor(() => {
      const messageElements = document.querySelectorAll('.chat-message-user .chat-message-content');
      const texts = Array.from(messageElements).map((el) => el.textContent ?? '');
      expect(texts.some((t) => t.includes('[IO Upload: media-plan.pdf]'))).toBe(true);
    });
  });

  it('upload error shows error message in chat', async () => {
    const user = userEvent.setup();
    renderChat();

    // Mock a 400 error response (backend rejects the file content)
    mockAuthFetch.mockResolvedValueOnce(createErrorResponse(400, 'Unsupported file type'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    // Use a .pdf extension so the accept filter doesn't block it — the backend returns the error
    const file = createTestFile('corrupt.pdf', 'application/pdf');

    await user.upload(fileInput, file);

    // Wait for the error message to appear
    await waitFor(() => {
      const assistantMessages = document.querySelectorAll('.chat-message-assistant .chat-message-content');
      const texts = Array.from(assistantMessages).map((el) => el.textContent ?? '');
      expect(texts.some((t) => t.includes('Unsupported file type'))).toBe(true);
    });

    // The SSE chat/stream endpoint should NOT have been called
    const streamCalls = mockAuthFetch.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('/chat/stream'),
    );
    expect(streamCalls).toHaveLength(0);
  });

  it('upload button is disabled while uploading', async () => {
    renderChat();

    // Create a never-resolving promise to keep the upload "in progress"
    let resolveUpload!: (value: unknown) => void;
    mockAuthFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createTestFile('test.pdf', 'application/pdf');

    // Manually trigger the change event
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for isUploading to take effect
    await waitFor(() => {
      const uploadBtn = screen.getByRole('button', { name: /upload file/i });
      expect(uploadBtn).toBeDisabled();
      expect(uploadBtn.classList.contains('uploading')).toBe(true);
    });

    // Textarea and send button should also be disabled
    const textarea = screen.getByPlaceholderText('Message Kiki...');
    expect(textarea).toBeDisabled();

    // Resolve to clean up
    resolveUpload(createUploadResponse('test.pdf', 'text'));
  });

  it('handles network failure gracefully', async () => {
    const user = userEvent.setup();
    renderChat();

    // Mock a network error
    mockAuthFetch.mockRejectedValueOnce(new Error('Network request failed'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createTestFile('report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await user.upload(fileInput, file);

    // Error message should appear in chat
    await waitFor(() => {
      const assistantMessages = document.querySelectorAll('.chat-message-assistant .chat-message-content');
      const texts = Array.from(assistantMessages).map((el) => el.textContent ?? '');
      expect(texts.some((t) => t.includes('Network request failed'))).toBe(true);
      expect(texts.some((t) => t.includes('report.xlsx'))).toBe(true);
    });
  });
});
