import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, StreamEvent } from '@adtraffic/shared';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { PluggableList } from 'unified';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import ConversationSidebar from '../components/ConversationSidebar.js';
import { parseQuickReplies, generateConversationId } from '../utils/chat-utils.js';
import type { QuickReplyOption } from '../utils/chat-utils.js';
import './Chat.css';

function QuickReplyButtons({
  options,
  onSelect,
  disabled,
}: {
  options: QuickReplyOption[];
  onSelect: (text: string) => void;
  disabled: boolean;
}) {
  const [openEndedActive, setOpenEndedActive] = useState(false);
  const [openEndedText, setOpenEndedText] = useState('');
  const openEndedRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (openEndedActive && openEndedRef.current) {
      openEndedRef.current.focus();
    }
  }, [openEndedActive]);

  const handleOpenEndedSubmit = () => {
    if (openEndedText.trim()) {
      onSelect(openEndedText.trim());
    }
  };

  return (
    <div className="quick-reply-container">
      {options.map((opt) =>
        opt.isOpenEnded && openEndedActive ? (
          <div key={opt.label} className="quick-reply-input-row">
            <input
              ref={openEndedRef}
              className="quick-reply-input"
              type="text"
              value={openEndedText}
              onChange={(e) => setOpenEndedText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleOpenEndedSubmit();
                }
              }}
              placeholder="Type your answer..."
              disabled={disabled}
            />
            <button
              className="quick-reply-send"
              onClick={handleOpenEndedSubmit}
              disabled={disabled || !openEndedText.trim()}
            >
              Send
            </button>
          </div>
        ) : (
          <button
            key={opt.label}
            className={`quick-reply-btn${opt.isOpenEnded ? ' quick-reply-btn-open' : ''}`}
            onClick={() => {
              if (opt.isOpenEnded) {
                setOpenEndedActive(true);
              } else {
                onSelect(opt.label);
              }
            }}
            disabled={disabled}
          >
            {opt.label}
          </button>
        ),
      )}
    </div>
  );
}

function CodeBlock({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Extract text content from the <code> child inside <pre>
    const text =
      typeof children === 'string'
        ? children
        : (() => {
            // children is the <code> element rendered by ReactMarkdown
            const codeEl = Array.isArray(children) ? children[0] : children;
            if (codeEl && typeof codeEl === 'object' && 'props' in codeEl) {
              const codeChildren = (codeEl as React.ReactElement<{ children?: React.ReactNode }>).props.children;
              return typeof codeChildren === 'string' ? codeChildren : String(codeChildren ?? '');
            }
            return String(children ?? '');
          })();

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="code-block-wrapper">
      <button className="code-copy-btn" onClick={handleCopy} aria-label="Copy code">
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre {...props}>{children}</pre>
    </div>
  );
}

function TableWrapper({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const check = () => {
      setCanScrollRight(el.scrollWidth > el.clientWidth + el.scrollLeft + 1);
    };
    check();
    el.addEventListener('scroll', check);
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={`table-wrapper${canScrollRight ? ' table-wrapper--has-overflow' : ''}`} ref={wrapperRef}>
      <table {...props}>{children}</table>
    </div>
  );
}

const remarkPlugins: PluggableList = [remarkGfm];

const markdownComponents = {
  pre: CodeBlock,
  table: TableWrapper,
};

/** Parse SSE events from a raw text buffer. Returns parsed events and any remaining incomplete data. */
function parseSSEBuffer(buffer: string): { parsed: StreamEvent[]; remaining: string } {
  const events: StreamEvent[] = [];
  const parts = buffer.split('\n\n');
  const remaining = parts.pop() ?? ''; // Last part may be incomplete

  for (const part of parts) {
    const dataLine = part.split('\n').find((line) => line.startsWith('data: '));
    if (dataLine) {
      try {
        events.push(JSON.parse(dataLine.slice(6)) as StreamEvent);
      } catch { /* skip malformed events */ }
    }
  }

  return { parsed: events, remaining };
}

/** Maps internal tool names to human-readable status labels */
const TOOL_LABELS: Record<string, string> = {
  // Core read operations
  cm360_list_profiles: 'Checking your CM360 access',
  cm360_list_advertisers: 'Looking up advertisers',
  cm360_get_advertiser: 'Getting advertiser details',
  cm360_list_campaigns: 'Searching campaigns',
  cm360_get_campaign: 'Getting campaign details',
  cm360_list_sites: 'Looking up sites',
  cm360_get_site: 'Getting site details',
  cm360_list_landing_pages: 'Loading landing pages',
  cm360_get_landing_page: 'Getting landing page details',
  cm360_list_placements: 'Searching placements',
  cm360_get_placement: 'Getting placement details',
  cm360_list_ads: 'Searching ads',
  cm360_get_ad: 'Getting ad details',
  cm360_list_creatives: 'Searching creatives',
  cm360_get_creative: 'Getting creative details',
  cm360_list_sizes: 'Loading available ad sizes',

  // Create operations
  cm360_create_campaign: 'Creating campaign',
  cm360_create_placement: 'Creating placement',
  cm360_create_landing_page: 'Creating landing page',
  cm360_create_ad: 'Creating ad',
  cm360_create_creative: 'Registering creative',

  // Update operations
  cm360_update_campaign: 'Updating campaign',
  cm360_update_placement: 'Updating placement',
  cm360_update_ad: 'Updating ad',
  cm360_update_creative: 'Updating creative',
  cm360_update_landing_page: 'Updating landing page',

  // Tag operations
  cm360_generate_tags: 'Generating ad tags',

  // Creative lifecycle
  cm360_associate_creative_campaign: 'Associating creative with campaign',
  cm360_list_campaign_creative_associations: 'Loading creative associations',
  cm360_upload_creative_asset: 'Uploading creative asset',

  // Event tags
  cm360_list_event_tags: 'Loading event tags',
  cm360_get_event_tag: 'Getting event tag details',
  cm360_create_event_tag: 'Creating event tag',
  cm360_update_event_tag: 'Updating event tag',
  cm360_delete_event_tag: 'Deleting event tag',

  // Placement groups
  cm360_list_placement_groups: 'Loading placement groups',
  cm360_get_placement_group: 'Getting placement group details',
  cm360_create_placement_group: 'Creating placement group',
  cm360_update_placement_group: 'Updating placement group',

  // Change logs
  cm360_list_change_logs: 'Loading change history',
  cm360_get_change_log: 'Getting change log entry',

  // Directory sites
  cm360_list_directory_sites: 'Browsing publisher directory',
  cm360_get_directory_site: 'Getting directory site details',
  cm360_insert_directory_site: 'Adding directory site',

  // Reporting
  cm360_list_reports: 'Loading saved reports',
  cm360_get_report: 'Getting report details',
  cm360_create_report: 'Creating report',
  cm360_run_report: 'Running report',
  cm360_get_report_file: 'Downloading report results',
  cm360_query_compatible_fields: 'Checking compatible report fields',

  // Floodlight / Conversion tracking
  cm360_list_floodlight_activities: 'Loading floodlight activities',
  cm360_get_floodlight_activity: 'Getting floodlight activity details',
  cm360_create_floodlight_activity: 'Creating floodlight activity',
  cm360_list_floodlight_activity_groups: 'Loading floodlight groups',
  cm360_get_floodlight_activity_group: 'Getting floodlight group details',
  cm360_create_floodlight_activity_group: 'Creating floodlight group',
  cm360_list_floodlight_configurations: 'Loading floodlight configuration',
  cm360_generate_floodlight_tag: 'Generating floodlight tag',
};

function formatToolName(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName.replace(/^cm360_/, '').replace(/_/g, ' ');
}

const API_URL = import.meta.env.VITE_API_URL ?? '';

const WELCOME_MESSAGE = `Hey! I'm **Kiki**, your CM360 trafficking assistant. I'm connected to the Demo Agency account and ready to help.

Here are some things you can try:

**Browse & Search**
- **"What advertisers do we have?"** — browse the account
- **"Show me campaigns for Apex Motors"** — drill into an advertiser
- **"What placements are running for Luminance Beauty?"** — check active placements

**Create & Manage**
- **"Create a new campaign for Luminance Beauty"** — I'll walk you through it
- **"Set up a 300x250 placement on CNN.com"** — create placements with details
- **"Update the end date on that campaign to March 31"** — modify existing entities

**Tags & Tracking**
- **"Generate tags for all placements in that campaign"** — get ad serving tags
- **"Set up a click event tag for our DoubleVerify pixel"** — create tracking pixels

**Reporting & Audit**
- **"Show me our saved reports"** — browse report definitions
- **"Who made changes to the Apex Motors campaign?"** — check the audit trail

**Upload an IO** — attach a PDF or Excel file and I'll extract the placement details

What would you like to do?`;

function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
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
      content: WELCOME_MESSAGE,
      timestamp: Date.now(),
    }];
  });
  const [input, setInput] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<{
    name: string;
    type: string;
    data: string;  // base64
    sizeBytes: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const [toolStatus, setToolStatus] = useState<{ toolName: string; status: 'running' } | null>(null);
  const { user, logout, authFetch } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Delta batching refs for ~60fps streaming renders
  const pendingDelta = useRef('');
  const rafRef = useRef<number | null>(null);

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

  // Refocus input after loading finishes
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /** Batch delta text into the streaming message at ~60fps */
  const flushDelta = useCallback(() => {
    const batch = pendingDelta.current;
    if (!batch) return;
    pendingDelta.current = '';
    rafRef.current = null;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.id === 'streaming') {
        return [...prev.slice(0, -1), { ...last, content: last.content + batch }];
      }
      return prev;
    });
  }, []);

  const appendDelta = useCallback((delta: string) => {
    pendingDelta.current += delta;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushDelta);
    }
  }, [flushDelta]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Abort any previous in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    // Capture and clear attachment before async work
    const sentAttachment = pendingAttachment;
    setPendingAttachment(null);

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setToolStatus(null);

    // Add placeholder assistant message that will be updated incrementally
    const placeholderMsg: ChatMessage = {
      id: 'streaming',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, placeholderMsg]);

    try {
      const response = await authFetch(`${API_URL}/api/v1/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: text,
          ...(sentAttachment ? { attachment: sentAttachment } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const result = parseSSEBuffer(buffer);
        buffer = result.remaining;

        for (const event of result.parsed) {
          switch (event.type) {
            case 'content_delta':
              appendDelta(event.delta);
              break;

            case 'tool_start':
              // Flush any pending delta before showing tool status
              if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
                flushDelta();
              }
              setToolStatus({ toolName: event.toolName, status: 'running' });
              break;

            case 'tool_end':
              setToolStatus(null);
              break;

            case 'message_end':
              // Flush any remaining delta
              if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
              }
              pendingDelta.current = '';
              // Replace placeholder with final message (source of truth)
              setMessages((prev) => [...prev.slice(0, -1), event.message]);
              setSidebarRefresh((n) => n + 1);
              break;

            case 'error':
              setMessages((prev) => {
                const errMsg: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: `Sorry, something went wrong: ${event.error}`,
                  timestamp: Date.now(),
                };
                return [...prev.slice(0, -1), errMsg];
              });
              break;

            case 'done':
              // Stream complete — no action needed
              break;
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // Clean up any pending animation frame
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingDelta.current = '';
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I had trouble connecting. Make sure the backend is running. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => {
        // Replace the streaming placeholder if it exists
        const last = prev[prev.length - 1];
        if (last?.id === 'streaming') {
          return [...prev.slice(0, -1), errorMessage];
        }
        return [...prev, errorMessage];
      });
    } finally {
      setIsLoading(false);
      setToolStatus(null);
    }
  }, [isLoading, conversationId, authFetch, appendDelta, flushDelta, pendingAttachment]);

  // Accept context from companion Chrome extension (?advertiserId=X&campaignId=Y)
  const extensionContextHandled = useRef(false);
  useEffect(() => {
    if (extensionContextHandled.current) return;
    const advertiserId = searchParams.get('advertiserId');
    const campaignId = searchParams.get('campaignId');
    if (!advertiserId && !campaignId) return;

    extensionContextHandled.current = true;

    // Clear the query params from the URL
    setSearchParams({}, { replace: true });

    // Auto-send a contextual first message
    const parts: string[] = [];
    if (advertiserId) parts.push(`advertiser ${advertiserId}`);
    if (campaignId) parts.push(`campaign ${campaignId}`);
    const contextMsg = `I'm looking at ${parts.join(', ')} in CM360.`;

    // Queue the message send after a short delay to allow the component to fully mount
    setTimeout(() => {
      sendMessage(contextMsg);
    }, 300);
  }, [searchParams, setSearchParams, sendMessage]);

  const startNewChat = useCallback(async () => {
    // Clear server-side conversation
    try {
      await authFetch(`${API_URL}/api/v1/conversations/${conversationId}`, {
        method: 'DELETE',
      });
    } catch { /* best effort */ }

    // Clear client-side state
    sessionStorage.removeItem(`adtraffic-messages-${conversationId}`);
    const newId = generateConversationId();
    setConversationId(newId);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: WELCOME_MESSAGE,
      timestamp: Date.now(),
    }]);
    setInput('');
    setSidebarRefresh((n) => n + 1);
  }, [conversationId, authFetch]);

  const handleSelectConversation = useCallback((convId: string, msgs: Array<{ id: string; role: string; content: string; timestamp: number }>) => {
    setConversationId(convId);
    setMessages(msgs.length > 0 ? msgs.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp,
    })) : [{
      id: 'welcome',
      role: 'assistant' as const,
      content: WELCOME_MESSAGE,
      timestamp: Date.now(),
    }]);
    setInput('');
  }, []);

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

    // Client-side size validation (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1] ?? ''; // strip data:... prefix
      setPendingAttachment({
        name: file.name,
        type: file.type,
        data: base64,
        sizeBytes: file.size,
      });
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="chat-page">
      <ConversationSidebar
        currentConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={startNewChat}
        refreshKey={sidebarRefresh}
      />
      <header className="chat-header">
        <div className="chat-header-title">
          <span className="status-dot" />
          <span className="brand-name"><strong>AdTraffic</strong><span className="brand-ai">.ai</span></span>
          <span className="brand-separator">—</span>
          <span>Kiki</span>
        </div>
        <div className="chat-header-actions">
          <span className="chat-user-name">{user?.name}</span>
          <button className="chat-new-btn" onClick={startNewChat} title="Start new conversation">
            New Chat
          </button>
          <Link to="/settings" className="chat-new-btn" title="Settings">
            Settings
          </Link>
          <button className="chat-new-btn" onClick={logout} title="Sign out">
            Sign Out
          </button>
        </div>
      </header>

      <main className="chat-messages">
        {messages.map((msg, idx) => {
          const isLastAssistant =
            msg.role === 'assistant' &&
            !isLoading &&
            idx === messages.length - 1;
          const parsed = isLastAssistant
            ? parseQuickReplies(msg.content)
            : null;
          const showQuickReplies = parsed && parsed.options.length > 0;

          return (
            <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="chat-message-row">
                  <div className="kiki-avatar">K</div>
                  <div className="chat-message-bubble">
                    <div className="chat-message-sender">Kiki</div>
                    <div className="chat-message-content">
                      <ReactMarkdown remarkPlugins={remarkPlugins} components={markdownComponents}>
                        {showQuickReplies ? parsed.cleanContent : msg.content}
                      </ReactMarkdown>
                    </div>
                    {showQuickReplies && (
                      <QuickReplyButtons
                        options={parsed.options}
                        onSelect={sendMessage}
                        disabled={isLoading}
                      />
                    )}
                  </div>
                </div>
              )}
              {msg.role === 'user' && (
                <div className="chat-message-content">{msg.content}</div>
              )}
            </div>
          );
        })}
        {isLoading && toolStatus && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-message-row">
              <div className="kiki-avatar">K</div>
              <div className="chat-message-bubble">
                <div className="tool-status" role="status" aria-label={formatToolName(toolStatus.toolName)}>
                  <span className="tool-status-spinner" />
                  <span className="tool-status-text">
                    {formatToolName(toolStatus.toolName)}...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        {isLoading && !toolStatus && (
          <div className="typing-indicator" role="status" aria-label="Kiki is typing">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-input-area">
        {pendingAttachment && (
          <div className="attachment-chip">
            <span className="attachment-chip-name">{pendingAttachment.name}</span>
            <span className="attachment-chip-size">
              ({(pendingAttachment.sizeBytes / 1024).toFixed(0)}KB)
            </span>
            <button
              className="attachment-chip-remove"
              onClick={() => setPendingAttachment(null)}
              aria-label="Remove attachment"
            >
              ×
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv"
          onChange={handleFileChange}
          hidden
        />
        <div className="chat-input-row">
        <button className="chat-upload-btn" onClick={handleFileUpload} title="Upload IO" aria-label="Upload file">
          +
        </button>
        <textarea
          ref={inputRef}
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
        </div>
      </footer>
    </div>
  );
}

export default Chat;
