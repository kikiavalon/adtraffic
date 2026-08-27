import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, StreamEvent, PendingAction, QARunReport } from '@adtraffic/shared';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { safeMarkdownUrl } from '../utils/markdown-url';
import type { PluggableList } from 'unified';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import ConversationSidebar from '../components/ConversationSidebar.js';
import ConfirmationCard from '../components/ConfirmationCard.js';
import QAReportCard from '../components/QAReportCard.js';
import { parseQuickReplies, generateConversationId } from '../utils/chat-utils.js';
import type { QuickReplyOption } from '../utils/chat-utils.js';
import { trackInteraction, setAuthFetch, startAutoFlush, flushInteractions } from '../utils/interaction-tracker.js';
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
      {options.map((opt, idx) =>
        opt.isOpenEnded && openEndedActive ? (
          <div key={`quick-reply-${idx}-${opt.label}`} className="quick-reply-input-row">
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
            key={`quick-reply-${idx}-${opt.label}`}
            className={`quick-reply-btn${opt.isOpenEnded ? ' quick-reply-btn-open' : ''}`}
            onClick={() => {
              trackInteraction('button_clicked', { buttonLabel: opt.label, isOpenEnded: opt.isOpenEnded });
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
            const codeEl = Array.isArray(children) ? (children as React.ReactNode[])[0] : children;
            if (codeEl && typeof codeEl === 'object' && 'props' in codeEl) {
              const codeChildren = (codeEl as React.ReactElement<{ children?: React.ReactNode }>).props.children;
              if (typeof codeChildren === 'string') return codeChildren;
              return typeof codeChildren === 'number' ? String(codeChildren) : '';
            }
            return typeof children === 'number' ? String(children) : '';
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

  // Retry / reconnection
  reconnecting: 'Reconnecting...',
};

function formatToolName(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName.replace(/^cm360_/, '').replace(/_/g, ' ');
}

const API_URL = import.meta.env.VITE_API_URL ?? '';

const WELCOME_MESSAGE = `Hey! I'm **Kiki**, an AI assistant for CM360 ad trafficking, powered by Claude. I can help you create campaigns, manage placements, generate tags, and more — just ask in plain English.

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

/** Clickable conversation starters shown on a fresh chat. */
const STARTER_PROMPTS = [
  'What advertisers do we have?',
  'Show me campaigns for Apex Motors',
  'Create a new campaign for Luminance Beauty',
];

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [failedSend, setFailedSend] = useState<string | null>(null);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const [toolStatus, setToolStatus] = useState<{ toolName: string; status: 'running' } | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [qaReports, setQaReports] = useState<QARunReport[]>([]);
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  const { user, logout, authFetch, cm360Connected, anthropicConnected, refreshAnthropicStatus } = useAuth();
  const dataMode: 'live' | 'demo' = cm360Connected === true ? 'live' : 'demo';
  // Gate the composer until a Claude API key is connected. Gate only on an
  // explicit `false` (or a no-key send error) — never on `null` (unknown, e.g.
  // during the initial status fetch) or `true`.
  const [noKeyError, setNoKeyError] = useState(false);
  const keyMissing = anthropicConnected === false || noKeyError;
  // When the user reconnects, the context flips to true — clear any stale
  // send-error gate so the banner and disabled state lift.
  useEffect(() => {
    if (anthropicConnected === true) setNoKeyError(false);
  }, [anthropicConnected]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Delta batching refs for ~60fps streaming renders
  const pendingDelta = useRef('');
  const rafRef = useRef<number | null>(null);

  // Rehydrate pending write confirmations after a refresh — approvals are
  // persisted server-side, so a reload must not orphan them
  const rehydratedRef = useRef(false);
  useEffect(() => {
    if (rehydratedRef.current) return;
    rehydratedRef.current = true;
    const storedConv = sessionStorage.getItem('adtraffic-conv-id');
    if (!storedConv) return; // fresh session — nothing pending
    void (async () => {
      try {
        const res = await authFetch(
          `${API_URL}/api/v1/confirmations/pending?conversationId=${encodeURIComponent(storedConv)}`,
        );
        if (res.ok) {
          const data = await res.json() as { actions?: PendingAction[] };
          if (Array.isArray(data.actions) && data.actions.length > 0) {
            setPendingActions(data.actions);
          }
        }
      } catch { /* pending list is best-effort */ }
    })();
  }, [authFetch]);

  // Persist conversation state
  useEffect(() => {
    sessionStorage.setItem('adtraffic-conv-id', conversationId);
  }, [conversationId]);

  useEffect(() => {
    sessionStorage.setItem(`adtraffic-messages-${conversationId}`, JSON.stringify(messages));
  }, [conversationId, messages]);

  // Autoscroll only when the user is already near the bottom; otherwise
  // surface a jump-to-latest affordance instead of yanking their scroll
  const messagesContainerRef = useRef<HTMLElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const isNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    if (isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setShowJumpToLatest(false);
    } else {
      setShowJumpToLatest(true);
    }
  }, [messages, pendingActions, qaReports, isNearBottom]);

  const handleMessagesScroll = useCallback(() => {
    if (isNearBottom()) setShowJumpToLatest(false);
  }, [isNearBottom]);

  const jumpToLatest = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowJumpToLatest(false);
  }, []);

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

  // Keep a ref to conversationId so the visibility handler always reads the current value
  const conversationIdRef = useRef(conversationId);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Register authFetch with the interaction tracker
  useEffect(() => {
    setAuthFetch(authFetch);
  }, [authFetch]);

  // Start auto-flush and track session lifecycle
  useEffect(() => {
    trackInteraction('session_started', { conversationId: conversationIdRef.current });
    const cleanupAutoFlush = startAutoFlush();

    // Guard: only fire session_ended once per hide/show cycle
    let sessionActive = true;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && sessionActive) {
        sessionActive = false;
        trackInteraction('session_ended', { conversationId: conversationIdRef.current });
        flushInteractions();
      } else if (document.visibilityState === 'visible') {
        sessionActive = true;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cleanupAutoFlush();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // Run once on mount — conversationIdRef ensures current ID is always read
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
    setFailedSend(null);

    trackInteraction('message_sent', { conversationId, messageLength: text.length });

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
      // Stop button aborts the controller; cancelling the reader unblocks the
      // pending read() so the stream ends cleanly with what has arrived so far
      controller.signal.addEventListener('abort', () => {
        reader.cancel().catch(() => {});
      });
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

            case 'approval_submitted':
              setMessages((prev) => {
                const infoMsg: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: `This action needs a senior approver — your request for "${event.action.preview.entityName}" has been submitted and will run once approved.`,
                  timestamp: Date.now(),
                };
                return [...prev, infoMsg];
              });
              break;

            case 'retrying':
              // Backend is retrying a transient error — keep loading animation going
              setToolStatus({ toolName: 'reconnecting', status: 'running' });
              break;

            case 'error':
              if (event.code === 'no_anthropic_key') {
                setNoKeyError(true);
                void refreshAnthropicStatus?.();
              }
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

            case 'confirmation_required':
              // Flush any pending delta before showing confirmation card
              if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
                flushDelta();
              }
              setPendingActions((prev) => [...prev, event.action]);
              break;

            case 'qa_report':
              setQaReports((prev) => [...prev, event.report]);
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
      setFailedSend(text);
      setMessages((prev) => {
        // Drop the streaming placeholder and the unsent user message — the
        // retry bar below the transcript carries the failure state, and a
        // retry re-sends the text without duplicating the bubble
        let next = prev;
        if (next[next.length - 1]?.id === 'streaming') next = next.slice(0, -1);
        if (next[next.length - 1]?.role === 'user' && next[next.length - 1]?.content === text) {
          next = next.slice(0, -1);
        }
        return next;
      });
    } finally {
      setIsLoading(false);
      setToolStatus(null);
    }
  }, [isLoading, conversationId, authFetch, appendDelta, flushDelta, pendingAttachment, refreshAnthropicStatus]);

  const startNewChat = useCallback(() => {
    // Rotate to a fresh conversation ID — the previous conversation stays
    // intact on the server and remains reachable from the sidebar
    const newId = generateConversationId();
    trackInteraction('session_started', { conversationId: newId });
    setConversationId(newId);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: WELCOME_MESSAGE,
      timestamp: Date.now(),
    }]);
    setInput('');
    setPendingActions([]);
    setQaReports([]);
    setProcessingActionId(null);
    setSidebarRefresh((n) => n + 1);
  }, []);

  const handleApprove = useCallback(async (actionId: string, typedConfirmation?: string) => {
    trackInteraction('confirmation_approved', { actionId, hasTypedConfirmation: !!typedConfirmation });
    setProcessingActionId(actionId);
    try {
      const response = await authFetch(`${API_URL}/api/v1/confirmations/${actionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typedConfirmation ? { typedConfirmation } : {}),
      });

      const data = await response.json() as {
        isError?: boolean;
        result?: unknown;
        errorMessage?: string;
        error?: string;
        qaReport?: QARunReport;
      };

      // Remove from pending actions
      setPendingActions((prev) => prev.filter((a) => a.actionId !== actionId));

      if (response.ok && !data.isError) {
        // Render a readable receipt — never raw JSON
        const approved = pendingActions.find((a) => a.actionId === actionId);
        const when = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const modeLabel = dataMode === 'live' ? 'live data' : 'demo data';
        const detail = typeof data.result === 'string' ? data.result : undefined;
        const resultContent = approved
          ? [
              `✅ **Approved — ${approved.preview.operation} ${approved.preview.entityType}**`,
              '',
              detail ?? approved.preview.entityName,
              '',
              `_${when} · ${modeLabel}_`,
            ].join('\n')
          : detail ?? `✅ Action approved and executed. (${when} · ${modeLabel})`;
        const resultMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: resultContent,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, resultMessage]);
        const approvedQaReport = data.qaReport;
        if (approvedQaReport) setQaReports((prev) => [...prev, approvedQaReport]);
      } else {
        // Add error as assistant message
        const errorText = data.errorMessage || data.error || 'Failed to execute action';
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Sorry, the action could not be completed: ${errorText}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      // Remove from pending actions even on network error
      setPendingActions((prev) => prev.filter((a) => a.actionId !== actionId));
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I had trouble completing that action. ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setProcessingActionId(null);
    }
  }, [authFetch, pendingActions, dataMode]);

  const handleReject = useCallback(async (actionId: string) => {
    trackInteraction('confirmation_rejected', { actionId });
    setProcessingActionId(actionId);
    try {
      const response = await authFetch(`${API_URL}/api/v1/confirmations/${actionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // Remove from pending actions
      setPendingActions((prev) => prev.filter((a) => a.actionId !== actionId));

      if (response.ok) {
        // Add cancellation message
        const cancelMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Got it, I cancelled that action. Let me know if you want to try something else.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, cancelMessage]);
      } else {
        const data = await response.json().catch(() => ({ error: 'Action not found or expired' })) as { error?: string };
        const errorText = data.error || 'Failed to cancel action';
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Sorry, the action could not be cancelled: ${errorText}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      // Remove from pending on error too
      setPendingActions((prev) => prev.filter((a) => a.actionId !== actionId));
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I had trouble cancelling that action. ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setProcessingActionId(null);
    }
  }, [authFetch]);

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
      void sendMessage(input);
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side size validation (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(`"${file.name}" is too large — the limit is 10MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploadError('');

    // Reset the file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';

    trackInteraction('file_upload_started', { filename: file.name, size: file.size });
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await authFetch(`${API_URL}/api/v1/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' })) as { error?: string };
        throw new Error(errorData.error ?? `Upload failed (${response.status})`);
      }

      const data = await response.json() as { filename: string; extractedText: string };
      trackInteraction('file_upload_success', { filename: data.filename });

      // Send extracted text as a message to trigger Kiki's IO parsing
      const messageText = `[IO Upload: ${data.filename}]\n\n${data.extractedText}`;
      setIsUploading(false);
      await sendMessage(messageText);
    } catch (error) {
      trackInteraction('file_upload_error', { filename: file.name, error: error instanceof Error ? error.message : 'Unknown error' });
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I couldn't process the file "${file.name}". ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsUploading(false);
    }
  }, [authFetch, sendMessage]);

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
          <span className="brand-name"><strong>AdTraffic</strong><span className="brand-ai">.ai</span></span>
          <span className="brand-separator">—</span>
          <span>Kiki</span>
          <span className="ai-badge" aria-label="AI-powered assistant">AI Assistant</span>
          <span
            className={`mode-chip mode-chip--${dataMode}`}
            role="status"
            aria-label={dataMode === 'live' ? 'Connected to live CM360 data' : 'Using demo data'}
          >
            {dataMode === 'live' ? 'Live · CM360' : 'Demo data'}
          </span>
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

      <main className="chat-messages" ref={messagesContainerRef} onScroll={handleMessagesScroll} aria-live="polite">
        {keyMissing && (
          <div className="key-missing-banner" role="alert">
            Connect your Claude API key in <Link to="/settings">Settings</Link> to start chatting.
          </div>
        )}
        {dataMode === 'demo' && (
          <div className="demo-banner">
            You're exploring demo data — <Link to="/settings">connect your CM360 account</Link> to go live.
          </div>
        )}
        {messages.map((msg, idx) => {
          // The streaming placeholder stays invisible until the first delta
          // arrives — the typing indicator covers the waiting state
          if (msg.id === 'streaming' && msg.content === '') return null;
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
                    <div className="chat-message-sender">Kiki <span className="ai-badge-small" aria-label="AI">AI</span></div>
                    <div className="chat-message-content">
                      <ReactMarkdown remarkPlugins={remarkPlugins} components={markdownComponents} urlTransform={safeMarkdownUrl}>
                        {showQuickReplies ? parsed.cleanContent : msg.content}
                      </ReactMarkdown>
                    </div>
                    {showQuickReplies && (
                      <QuickReplyButtons
                        options={parsed.options}
                        onSelect={(text) => void sendMessage(text)}
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
        {messages.length === 1 && messages[0]?.id === 'welcome' && (
          <div className="starter-chips">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="starter-chip"
                onClick={() => void sendMessage(prompt)}
                disabled={isLoading}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        {pendingActions.map((action) => (
          <div key={action.actionId} className="chat-message chat-message-assistant">
            <div className="chat-message-row">
              <div className="kiki-avatar">K</div>
              <div className="chat-message-bubble confirmation-card-container">
                <ConfirmationCard
                  action={action}
                  onApprove={(actionId, typedConfirmation) => void handleApprove(actionId, typedConfirmation)}
                  onReject={(actionId) => void handleReject(actionId)}
                  disabled={processingActionId === action.actionId}
                  mode={dataMode}
                />
              </div>
            </div>
          </div>
        ))}
        {qaReports.map((report) => (
          <div key={report.runId} className="chat-message chat-message-assistant">
            <div className="chat-message-row">
              <div className="kiki-avatar">K</div>
              <div className="chat-message-bubble qa-report-card-container">
                <QAReportCard
                  report={report}
                  authFetch={authFetch}
                  onReportUpdate={(updated) =>
                    setQaReports((prev) => prev.map((r) => (r.runId === updated.runId ? updated : r)))
                  }
                />
              </div>
            </div>
          </div>
        ))}
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
          <div className="typing-indicator" role="status" aria-label="Kiki AI is responding">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {showJumpToLatest && (
        <button className="jump-to-latest" onClick={jumpToLatest} aria-label="Jump to latest">
          ↓ Jump to latest
        </button>
      )}

      <footer className="chat-input-area">
        {failedSend && (
          <div className="send-error-bar" role="alert">
            <span>Your message didn't send — connection problem.</span>
            <button className="send-error-retry" onClick={() => void sendMessage(failedSend)}>
              Retry
            </button>
          </div>
        )}
        {uploadError && (
          <div className="send-error-bar" role="alert">
            <span>{uploadError}</span>
            <button className="send-error-retry" onClick={() => setUploadError('')} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}
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
          onChange={(e) => void handleFileChange(e)}
          hidden
        />
        <div className="chat-input-row">
        <button
          className={`chat-upload-btn${isUploading ? ' uploading' : ''}`}
          onClick={handleFileUpload}
          title="Upload IO"
          aria-label="Upload file"
          disabled={isUploading || isLoading}
        >
          +
        </button>
        <textarea
          ref={inputRef}
          className="chat-message-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            keyMissing
              ? 'Connect your Claude API key in Settings to start chatting'
              : 'Message Kiki...'
          }
          rows={1}
          disabled={isUploading || keyMissing}
        />
        {isLoading && (
          <button
            className="chat-stop-btn"
            onClick={() => abortControllerRef.current?.abort()}
            aria-label="Stop response"
          >
            ◼ Stop
          </button>
        )}
        <button
          className="chat-send-btn"
          onClick={() => void sendMessage(input)}
          disabled={!input.trim() || isLoading || isUploading || keyMissing}
        >
          Send
        </button>
        </div>
      </footer>
    </div>
  );
}

export default Chat;
