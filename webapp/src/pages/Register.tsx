import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import './Login.css';

function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agency, setAgency] = useState('');
  const [error, setError] = useState('');
  const { register, isLoading, needsBootstrap, registrationOpen } = useAuth();
  const navigate = useNavigate();
  const registrationClosed = registrationOpen === false && !needsBootstrap;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await register(email, password, name, agency.trim() || undefined);
      void navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">AdTraffic.ai</h1>
        {registrationClosed ? (
          <>
            <p className="auth-subtitle">Registration is closed</p>
            <p className="auth-closed-note">
              New accounts are added by your workspace admin. Ask them to add you, then sign in.
            </p>
            <p className="auth-footer"><Link to="/login">Back to sign in</Link></p>
          </>
        ) : (
          <>
        <p className="auth-subtitle">{needsBootstrap ? 'Set up your workspace' : 'Create your account'}</p>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form onSubmit={(e) => void handleSubmit(e)} className="auth-form">
          <label className="auth-label">
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
              placeholder="Your name"
              required
              autoFocus
            />
          </label>

          <label className="auth-label">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="you@agency.com"
              required
            />
          </label>

          {needsBootstrap && (
            <>
              <label className="auth-label">
                Agency
                <input
                  type="text"
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  className="auth-input"
                  placeholder="Your agency or company"
                />
              </label>
              <p className="auth-ai-disclosure">
                As the first account you&apos;re the workspace admin. Your email and agency
                are shared with the maintainers so they can reach out — nothing else is sent.
              </p>
            </>
          )}

          <label className="auth-label">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              placeholder="Min 8 characters"
              required
              minLength={8}
            />
          </label>

          <button type="submit" className="auth-btn" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
          </>
        )}
        <p className="auth-ai-disclosure">
          AdTraffic.ai uses AI to assist with CM360 ad trafficking. <Link to="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
