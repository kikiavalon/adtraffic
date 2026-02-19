import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { Link, useSearchParams } from 'react-router-dom';
import './Settings.css';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface UsageSummary {
  date: string;
  requests: number;
  limit: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: string;
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
};

function Settings() {
  const { user, logout, authFetch, featureFlags } = useAuth();
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
      } else {
        setCM360Error('Failed to disconnect');
      }
    } catch {
      setCM360Error('Could not connect to backend');
    } finally {
      setCM360ActionLoading(false);
    }
  }, [authFetch]);

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

  const usagePercent = usage ? Math.round((usage.requests / usage.limit) * 100) : 0;

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
                <span>{usage.totalTokens.toLocaleString()} ({usage.inputTokens.toLocaleString()} in / {usage.outputTokens.toLocaleString()} out)</span>
              </div>
              <div className="settings-field">
                <label>Estimated cost</label>
                <span>{usage.estimatedCost}</span>
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
          ) : cm360Status?.connected ? (
            <>
              <div className="settings-field">
                <label>Status</label>
                <span className="settings-connected">Connected</span>
              </div>
              {cm360Status.scopes && cm360Status.scopes.length > 0 && (
                <div className="settings-field">
                  <label>Scopes</label>
                  <span className="cm360-scopes">
                    {cm360Status.scopes.map((scope) => {
                      const shortScope = scope.split('/').pop() ?? scope;
                      return shortScope;
                    }).join(', ')}
                  </span>
                </div>
              )}
              {cm360Status.expiresAt && (
                <div className="settings-field">
                  <label>Token expires</label>
                  <span>{new Date(cm360Status.expiresAt).toLocaleString()}</span>
                </div>
              )}
              <button
                className="cm360-disconnect-btn"
                onClick={handleDisconnect}
                disabled={cm360ActionLoading}
              >
                {cm360ActionLoading ? 'Disconnecting...' : 'Disconnect CM360'}
              </button>
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
