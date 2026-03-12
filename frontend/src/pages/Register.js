import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Register({ onSwitchLogin }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer', company: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try { await register(form); }
    catch (err) { setError(err.response?.data?.error || 'Registration failed'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ background: 'var(--accent)', color: '#000', display: 'inline-block', padding: '4px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: 3, marginBottom: 12 }}>GOV-TMS</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>Create Account</h1>
          <p style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>GovFleet Transport Management</p>
        </div>

        <div className="card">
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
              {['customer', 'driver'].map(r => (
                <button type="button" key={r} onClick={() => setForm({...form, role: r})}
                  style={{ flex: 1, padding: '12px', background: form.role === r ? (r === 'customer' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)') : 'var(--bg3)',
                    border: `2px solid ${form.role === r ? (r === 'customer' ? 'var(--blue)' : 'var(--green)') : 'var(--border2)'}`,
                    borderRadius: 8, cursor: 'pointer', color: form.role === r ? (r === 'customer' ? 'var(--blue2)' : 'var(--green)') : 'var(--text3)',
                    fontWeight: 700, fontSize: 13 }}>
                  {r === 'customer' ? '📦 Customer' : '🚛 Driver'}
                </button>
              ))}
            </div>
            <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Your name" required />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@example.com" required />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min 6 characters" required minLength={6} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Mobile number" />
              </div>
              {form.role === 'customer' && (
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Department / Organization</label>
                  <input className="form-input" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="e.g. Ministry of Health" />
                </div>
              )}
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading} style={{ justifyContent: 'center' }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
            Already have an account?{' '}
            <button onClick={onSwitchLogin} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Sign in</button>
          </div>
        </div>
      </div>
    </div>
  );
}
