import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { Link } from 'react-router-dom';
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

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

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

        <section className="settings-section">
          <h2>CM360 Connection</h2>
          <div className="settings-field">
            <label>Status</label>
            <span className="settings-connected">Connected</span>
          </div>
          <div className="settings-field">
            <label>Account</label>
            <span>Demo Agency (account 67890)</span>
          </div>
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
