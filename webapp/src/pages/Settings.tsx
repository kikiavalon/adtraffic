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

function Settings() {
  const { user, logout, authFetch } = useAuth();
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
