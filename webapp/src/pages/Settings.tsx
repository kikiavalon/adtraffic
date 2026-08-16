import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { Link, useSearchParams } from 'react-router-dom';
import './Settings.css';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface UsageSummary {
  date?: string;
  requests?: number;
  limit?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: string;
}

interface CM360Status {
  connected: boolean;
  scopes?: string[];
  expiresAt?: string;
}

const FLAG_LABELS: Record<string, string> = {
  'cm360.write_operations': 'CM360 Write Operations',
  'cm360.tag_generation': 'Tag Generation',
  'cm360.read_operations': 'CM360 Read Operations',
  'chat.enabled': 'Chat',
  'chat.file_upload': 'File Upload',
  'beta.advanced_trafficking': 'Advanced Trafficking (Beta)',
  'beta.video_trafficking': 'Video Trafficking (Beta)',
  'limits.daily_api_requests': 'Daily API Requests',
  'limits.max_tool_rounds': 'Max Tool Rounds',
  'limits.chat_rate_per_minute': 'Chat Rate (per minute)',
  'compliance.eu_ai_act_disclosure': 'EU AI Act Disclosure',
  'compliance.ai_attribution_in_exports': 'AI Attribution in Exports',
};

function Settings() {
  const { user, logout, authFetch, featureFlags, refreshCM360Status } = useAuth();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [usageError, setUsageError] = useState('');
  const [cm360Status, setCM360Status] = useState<CM360Status | null>(null);
  const [cm360Loading, setCM360Loading] = useState(true);
  const [cm360Error, setCM360Error] = useState('');
  const [cm360ActionLoading, setCM360ActionLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchUsage = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/v1/usage`);
      if (res.ok) {
        setUsage(await res.json());
        setUsageError('');
      } else {
        setUsageError('Failed to load usage data');
      }
    } catch {
      setUsageError('Could not connect to backend');
    }
  }, [authFetch]);

  const fetchCM360Status = useCallback(async () => {
    setCM360Loading(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/auth/google/status`);
      if (res.ok) {
        setCM360Status(await res.json());
        setCM360Error('');
      } else {
        setCM360Error('Failed to load CM360 status');
      }
    } catch {
      setCM360Error('Could not connect to backend');
    } finally {
      setCM360Loading(false);
    }
  }, [authFetch]);

  const handleConnect = useCallback(async () => {
    setCM360ActionLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/auth/google/connect`);
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
      } else {
        setCM360Error('Failed to start connection. Check that Google OAuth is configured.');
      }
    } catch {
      setCM360Error('Could not connect to backend');
    } finally {
      setCM360ActionLoading(false);
    }
  }, [authFetch]);

  const handleDisconnect = useCallback(async () => {
    setCM360ActionLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/auth/google/disconnect`, {
        method: 'POST',
      });
      if (res.ok) {
        setCM360Status({ connected: false });
        setToast('CM360 account disconnected');
        void refreshCM360Status?.();
      } else {
        setCM360Error('Failed to disconnect');
      }
    } catch {
      setCM360Error('Could not connect to backend');
    } finally {
      setCM360ActionLoading(false);
      setConfirmingDisconnect(false);
    }
  }, [authFetch, refreshCM360Status]);

  useEffect(() => {
    fetchUsage();
    fetchCM360Status();
  }, [fetchUsage, fetchCM360Status]);

  // Check for ?cm360=connected query param (set by OAuth callback redirect)
  useEffect(() => {
    if (searchParams.get('cm360') === 'connected') {
      setToast('CM360 account connected successfully!');
      fetchCM360Status();
      // Remove query param from URL without reload
      searchParams.delete('cm360');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, fetchCM360Status]);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const usagePercent = usage?.limit ? Math.round(((usage.requests ?? 0) / usage.limit) * 100) : 0;
  const tokenExpired = Boolean(
    cm360Status?.connected && cm360Status.expiresAt && new Date(cm360Status.expiresAt).getTime() < Date.now(),
  );

  return (
    <div className="settings-page">
      <header className="settings-header">
        <Link to="/" className="settings-back">&larr; Back to Chat</Link>
        <h1>Settings</h1>
      </header>

      <main className="settings-content">
        <section className="settings-section">
          <h2>Profile</h2>
          <div className="settings-field">
            <label>Name</label>
            <span>{user?.name}</span>
          </div>
          <div className="settings-field">
            <label>Email</label>
            <span>{user?.email}</span>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-header">
            <h2>API Usage</h2>
            <button className="settings-refresh-btn" onClick={fetchUsage} title="Refresh usage">
              Refresh
            </button>
          </div>
          {usageError && <p className="settings-error">{usageError}</p>}
          {usage && (
            <>
              <div className="settings-field">
                <label>Date</label>
                <span>{usage.date}</span>
              </div>
              <div className="settings-field">
                <label>Requests today</label>
                <span>{usage.requests} / {usage.limit}</span>
              </div>
              <div className="usage-bar-container">
                <div
                  className={`usage-bar-fill${usagePercent >= 90 ? ' usage-bar-danger' : usagePercent >= 70 ? ' usage-bar-warning' : ''}`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              <div className="settings-field">
                <label>Tokens used</label>
                <span>{(usage.totalTokens ?? 0).toLocaleString()} ({(usage.inputTokens ?? 0).toLocaleString()} in / {(usage.outputTokens ?? 0).toLocaleString()} out)</span>
              </div>
            </>
          )}
        </section>

        {toast && (
          <div className="settings-toast" role="status">
            {toast}
          </div>
        )}

        <section className="settings-section">
          <h2>CM360 Connection</h2>
          {cm360Error && <p className="settings-error">{cm360Error}</p>}
          {cm360Loading ? (
            <p className="settings-placeholder">Loading connection status...</p>
          ) : cm360Status?.connected && tokenExpired ? (
            <>
              <div className="settings-field">
                <label>Status</label>
                <span className="settings-error">Connection expired</span>
              </div>
              <p className="cm360-expired-note">
                Your CM360 access has expired. Kiki is using demo data until you reconnect.
              </p>
              <button
                className="cm360-connect-btn"
                onClick={handleConnect}
                disabled={cm360ActionLoading}
              >
                {cm360ActionLoading ? 'Opening Google...' : 'Reconnect CM360'}
              </button>
            </>
          ) : cm360Status?.connected ? (
            <>
              <div className="settings-field">
                <label>Status</label>
                <span className="settings-connected">Connected</span>
              </div>
              {confirmingDisconnect ? (
                <div className="cm360-disconnect-confirm">
                  <p>Disconnect CM360? Kiki returns to demo data until you reconnect.</p>
                  <div className="cm360-disconnect-confirm-actions">
                    <button
                      className="cm360-connect-btn"
                      onClick={() => setConfirmingDisconnect(false)}
                    >
                      Keep connected
                    </button>
                    <button
                      className="cm360-disconnect-btn"
                      onClick={handleDisconnect}
                      disabled={cm360ActionLoading}
                    >
                      {cm360ActionLoading ? 'Disconnecting...' : 'Disconnect CM360'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="cm360-disconnect-btn"
                  onClick={() => setConfirmingDisconnect(true)}
                >
                  Disconnect…
                </button>
              )}
            </>
          ) : (
            <>
              <div className="cm360-not-connected">
                <p>
                  Connect your Google CM360 account to work with live campaign data.
                  Without a connection, Kiki uses demo data.
                </p>
              </div>
              <button
                className="cm360-connect-btn"
                onClick={handleConnect}
                disabled={cm360ActionLoading}
              >
                {cm360ActionLoading ? 'Connecting...' : 'Connect CM360 Account'}
              </button>
            </>
          )}
        </section>

        {featureFlags && (
          <section className="settings-section">
            <h2>Features</h2>
            {Object.entries(featureFlags).map(([key, value]) => (
              <div className="settings-field" key={key}>
                <label>{FLAG_LABELS[key] ?? key}</label>
                <span className={typeof value === 'boolean' ? (value ? 'flag-enabled' : 'flag-disabled') : ''}>
                  {typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : String(value)}
                </span>
              </div>
            ))}
          </section>
        )}

        <section className="settings-section">
          <h2>About AdTraffic.ai</h2>
          <p className="settings-about-text">
            AdTraffic.ai uses artificial intelligence (Claude by Anthropic) to assist with
            Google Campaign Manager 360 ad trafficking. Kiki, your AI assistant, interprets
            natural language requests and executes CM360 operations using your authorized
            Google account.
          </p>
          <p className="settings-about-text">
            All write operations require your explicit confirmation before execution.
            Your CM360 data transits our servers but is not stored beyond the API call.
          </p>
          <p className="settings-about-text">
            <Link to="/privacy">Privacy Policy</Link>
          </p>
        </section>

        <section className="settings-section">
          <h2>Account</h2>
          <button className="settings-logout-btn" onClick={logout}>
            Sign Out
          </button>
        </section>
      </main>
    </div>
  );
}

export default Settings;
