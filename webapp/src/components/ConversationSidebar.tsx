import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import './ConversationSidebar.css';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
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
  const { token } = useAuth();

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
      }
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, refreshKey]);

  const handleSelect = async (convId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/conversations/${convId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        onSelectConversation(convId, data.messages);
        setIsOpen(false);
      }
    } catch { /* ignore */ }
  };

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Conversation history"
      >
        {isOpen ? '\u2715' : '\u2630'}
      </button>

      {isOpen && (
        <aside className="conversation-sidebar">
          <div className="sidebar-header">
            <h2>Conversations</h2>
            <button className="sidebar-new-btn" onClick={() => { onNewChat(); setIsOpen(false); }}>
              + New
            </button>
          </div>

          <div className="sidebar-list">
            {conversations.length === 0 && (
              <p className="sidebar-empty">No conversations yet</p>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.id}
                className={`sidebar-item ${conv.id === currentConversationId ? 'sidebar-item-active' : ''}`}
                onClick={() => handleSelect(conv.id)}
              >
                <span className="sidebar-item-title">{conv.title ?? 'New conversation'}</span>
                <span className="sidebar-item-date">
                  {new Date(conv.updatedAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </aside>
      )}
    </>
  );
}

export default ConversationSidebar;
