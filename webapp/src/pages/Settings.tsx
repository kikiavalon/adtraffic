import { useAuth } from '../auth/AuthContext.js';
import { Link } from 'react-router-dom';
import './Settings.css';

function Settings() {
  const { user, logout } = useAuth();

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
