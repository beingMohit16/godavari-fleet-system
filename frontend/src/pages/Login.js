import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const DEMO_ACCOUNTS = [
  { role: 'company',  label: 'Company Admin', email: 'admin@govfleet.in',  password: 'admin123',    color: '#f59e0b', icon: '🏢' },
  { role: 'customer', label: 'Customer',      email: 'health@gov.in',      password: 'customer123', color: '#3b82f6', icon: '📦' },
  { role: 'driver',   label: 'Driver',        email: 'ramesh@driver.in',   password: 'driver123',   color: '#10b981', icon: '🚛' },
];

export default function Login({ onSwitchRegister }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try { await login(form.email, form.password); }
    catch (err) { setError(err.response?.data?.error || 'Login failed'); }
    setLoading(false);
  };

  const quickLogin = async (email, password) => {
    setForm({ email, password });
    setLoading(true); setError('');
    try { await login(email, password); }
    catch (err) { setError(err.response?.data?.error || 'Login failed'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ background: 'var(--accent)', color: '#000', display: 'inline-block', padding: '4px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: 3, marginBottom: 12 }}>GOV-TMS</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>GovFleet</h1>
          <p style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>State Transport Management</p>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 20 }}>Sign In to Your Account</div>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="you@example.com" required />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="••••••••" required />
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading} style={{ justifyContent: 'center' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
            New user?{' '}
            <button onClick={onSwitchRegister} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Register here
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Demo Accounts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEMO_ACCOUNTS.map(acc => (
              <button key={acc.role} onClick={() => quickLogin(acc.email, acc.password)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg3)', border: `1px solid ${acc.color}30`, borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = `${acc.color}10`}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg3)'}
              >
                <span style={{ fontSize: 20 }}>{acc.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: acc.color }}>{acc.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>{acc.email}</div>
                </div>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)', padding: '2px 6px', background: 'var(--bg)', borderRadius: 3 }}>CLICK TO LOGIN</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
