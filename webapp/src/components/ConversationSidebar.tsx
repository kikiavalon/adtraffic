import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import './ConversationSidebar.css';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
}

type ConversationMessage = { id: string; role: string; content: string; timestamp: number };

interface ConversationListResponse {
  conversations: Conversation[];
}

interface ConversationMessagesResponse {
  messages: ConversationMessage[];
}

interface ConversationSidebarProps {
  currentConversationId: string;
  onSelectConversation: (id: string, messages: Array<{ id: string; role: string; content: string; timestamp: number }>) => void;
  onNewChat: () => void;
  refreshKey: number;
}

function ConversationSidebar({ currentConversationId, onSelectConversation, onNewChat, refreshKey }: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isWide, setIsWide] = useState(() => window.innerWidth >= 1024);
  const { authFetch } = useAuth();

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/v1/conversations`);
      if (res.ok) {
        const data = await res.json() as ConversationListResponse;
        setConversations(data.conversations);
      }
    } catch { /* ignore */ }
  }, [authFetch]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations, refreshKey]);

  const handleSelect = async (convId: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/v1/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json() as ConversationMessagesResponse;
        onSelectConversation(convId, data.messages);
        if (!isWide) setIsOpen(false);
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async (convId: string, title: string | null) => {
    const name = title ?? 'this conversation';
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    try {
      const res = await authFetch(`${API_URL}/api/v1/conversations/${convId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        sessionStorage.removeItem(`adtraffic-messages-${convId}`);
        if (convId === currentConversationId) onNewChat();
        void loadConversations();
      }
    } catch { /* ignore */ }
  };

  const showSidebar = isWide || isOpen;

  // Escape closes the mobile overlay sidebar
  useEffect(() => {
    if (isWide || !isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isWide, isOpen]);

  return (
    <>
      {!isWide && (
        <button
          className="sidebar-toggle"
          onClick={() => setIsOpen(!isOpen)}
          title="Conversation history"
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={isOpen}
        >
          {isOpen ? '\u2715' : '\u2630'}
        </button>
      )}

      {!isWide && isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {showSidebar && (
        <aside className={`conversation-sidebar ${isWide ? 'sidebar-persistent' : ''}`}>
          <div className={`sidebar-header ${isWide ? 'sidebar-header-persistent' : ''}`}>
            <h2>Conversations</h2>
            <button className="sidebar-new-btn" onClick={() => { onNewChat(); if (!isWide) setIsOpen(false); }}>
              + New
            </button>
          </div>

          <div className="sidebar-list">
            {conversations.length === 0 && (
              <p className="sidebar-empty">No conversations yet</p>
            )}
            {conversations.map((conv) => (
              <div key={conv.id} className="sidebar-item-row">
                <button
                  className={`sidebar-item ${conv.id === currentConversationId ? 'sidebar-item-active' : ''}`}
                  onClick={() => void handleSelect(conv.id)}
                >
                  <span className="sidebar-item-title">{conv.title ?? 'New conversation'}</span>
                  <span className="sidebar-item-date">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </span>
                </button>
                <button
                  className="sidebar-item-delete"
                  onClick={() => void handleDelete(conv.id, conv.title)}
                  aria-label={`Delete conversation ${conv.title ?? 'New conversation'}`}
                  title="Delete conversation"
                >
                  {'✕'}
                </button>
              </div>
            ))}
          </div>
        </aside>
      )}
    </>
  );
}

export default ConversationSidebar;
