import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import './Users.css';

const API_URL = import.meta.env.VITE_API_URL ?? '';

type Role = 'admin' | 'senior' | 'junior';

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'senior', label: 'Senior' },
  { value: 'admin', label: 'Admin' },
];

function Users() {
  const { authFetch, user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('junior');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/users`);
      if (res.ok) {
        const data = await res.json() as { users: ManagedUser[] };
        setUsers(data.users);
        setError('');
      } else {
        setError('Failed to load users.');
      }
    } catch {
      setError('Could not connect to the backend.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await authFetch(`${API_URL}/api/v1/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });
      if (res.ok) {
        const data = await res.json() as { user: ManagedUser };
        setUsers((prev) => [data.user, ...prev]);
        setName(''); setEmail(''); setPassword(''); setRole('junior');
      } else {
        setError(res.status === 409 ? 'That email is already registered.' : 'Failed to create the user.');
      }
    } catch {
      setError('Could not connect to the backend.');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (id: string, newRole: Role) => {
    setError('');
    try {
      const res = await authFetch(`${API_URL}/api/v1/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        const data = await res.json() as { user: ManagedUser };
        setUsers((prev) => prev.map((u) => (u.id === id ? data.user : u)));
      } else {
        setError(res.status === 409 ? "You can't remove the last admin." : 'Failed to update the role.');
        void load(); // revert the dropdown to the server's truth
      }
    } catch {
      setError('Could not connect to the backend.');
    }
  };

  // Soft-delete: DELETE deactivates, POST /reactivate restores. Backend guards
  // against removing yourself or the last active admin (409).
  const setActive = async (id: string, active: boolean) => {
    setError('');
    try {
      const res = await authFetch(`${API_URL}/api/v1/users/${id}${active ? '/reactivate' : ''}`, {
        method: active ? 'POST' : 'DELETE',
      });
      if (res.ok) {
        const data = await res.json() as { user: ManagedUser };
        setUsers((prev) => prev.map((u) => (u.id === id ? data.user : u)));
      } else {
        setError(res.status === 409
          ? "You can't deactivate the last admin or your own account."
          : 'Failed to update the user.');
      }
    } catch {
      setError('Could not connect to the backend.');
    }
  };

  return (
    <div className="users-page">
      <div className="users-header">
        <Link to="/" className="users-back">&larr; Back to Chat</Link>
        <h1>Team</h1>
        <p className="users-sub">Add teammates and set what each can do. Only admins see this page.</p>
      </div>

      {error && <div className="users-error" role="alert">{error}</div>}

      <section className="users-section">
        <h2>Add a user</h2>
        <form className="users-create-form" onSubmit={(e) => void handleCreate(e)}>
          <label>Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name" required />
          </label>
          <label>Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="them@agency.com" required />
          </label>
          <label>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" minLength={8} required />
          </label>
          <label>Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <button type="submit" disabled={creating}>{creating ? 'Adding…' : 'Add user'}</button>
        </form>
        <p className="users-hint">
          You set the initial password and share it with them; they can change it after signing in.
        </p>
      </section>

      <section className="users-section">
        <h2>Users</h2>
        {loading ? (
          <p className="users-placeholder">Loading…</p>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Added</th><th>Status</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={u.active ? undefined : 'users-inactive'}>
                    <td>{u.name}{currentUser?.id === u.id && <span className="users-you"> (you)</span>}</td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        aria-label={`Role for ${u.email}`}
                        value={u.role}
                        onChange={(e) => void handleRoleChange(u.id, e.target.value as Role)}
                      >
                        {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      {u.active ? (
                        currentUser?.id === u.id ? (
                          <span className="users-you">Active</span>
                        ) : (
                          <button
                            className="users-action-btn"
                            aria-label={`Deactivate ${u.email}`}
                            onClick={() => void setActive(u.id, false)}
                          >
                            Deactivate
                          </button>
                        )
                      ) : (
                        <button
                          className="users-action-btn users-reactivate"
                          aria-label={`Reactivate ${u.email}`}
                          onClick={() => void setActive(u.id, true)}
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Users;
