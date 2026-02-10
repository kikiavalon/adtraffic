import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage } from '@adtraffic/shared';
import ReactMarkdown from 'react-markdown';
import './Chat.css';

const API_URL = import.meta.env.VITE_API_URL ?? '';

function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function Chat() {
  const [conversationId, setConversationId] = useState<string>(() => {
    return sessionStorage.getItem('adtraffic-conv-id') ?? generateConversationId();
  });
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = sessionStorage.getItem(`adtraffic-messages-${conversationId}`);
    if (saved) {
      try { return JSON.parse(saved) as ChatMessage[]; } catch { /* fall through */ }
    }
    return [{
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm Kiki, your CM360 trafficking assistant. Upload an IO to get started, or just tell me what you need.",
      timestamp: Date.now(),
    }];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist conversation state
  useEffect(() => {
    sessionStorage.setItem('adtraffic-conv-id', conversationId);
  }, [conversationId]);

  useEffect(() => {
    sessionStorage.setItem(`adtraffic-messages-${conversationId}`, JSON.stringify(messages));
  }, [conversationId, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startNewChat = useCallback(async () => {
    // Clear server-side conversation
    try {
      await fetch(`${API_URL}/api/conversations/${conversationId}`, { method: 'DELETE' });
    } catch { /* best effort */ }

    // Clear client-side state
    sessionStorage.removeItem(`adtraffic-messages-${conversationId}`);
    const newId = generateConversationId();
    setConversationId(newId);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm Kiki, your CM360 trafficking assistant. Upload an IO to get started, or just tell me what you need.",
      timestamp: Date.now(),
    }]);
    setInput('');
  }, [conversationId]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      setMessages((prev) => [...prev, data.message]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I had trouble connecting. Make sure the backend is running. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `Uploaded: ${file.name}`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="chat-header-title">
          <span className="status-dot" />
          AdTraffic.ai — Kiki
        </div>
        <button className="chat-new-btn" onClick={startNewChat} title="Start new conversation">
          New Chat
        </button>
      </header>

      <main className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
            {msg.role === 'assistant' && <div className="chat-message-sender">Kiki</div>}
            {msg.role === 'assistant' ? (
              <div className="chat-message-content">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="chat-message-content">{msg.content}</div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-message-sender">Kiki</div>
            <div className="chat-message-content typing">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-input-area">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv"
          onChange={handleFileChange}
          hidden
        />
        <button className="chat-upload-btn" onClick={handleFileUpload} title="Upload IO">
          +
        </button>
        <textarea
          className="chat-message-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Kiki..."
          rows={1}
          disabled={isLoading}
        />
        <button
          className="chat-send-btn"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
        >
          Send
        </button>
      </footer>
    </div>
  );
}

export default Chat;
