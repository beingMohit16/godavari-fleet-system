import React, { useEffect, useState } from 'react';
import { getExpenses, createExpense, getTrips, downloadExpenseReport } from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const EXP_TYPES = ['Fuel', 'Toll', 'Repair', 'Other'];
const COLORS = { Fuel: '#f59e0b', Toll: '#3b82f6', Repair: '#ef4444', Other: '#8b5cf6' };

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ trip_id: '', expense_type: 'Fuel', amount: '', date: new Date().toISOString().slice(0,10), notes: '' });
  const [receiptFile, setReceiptFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = () => Promise.all([getExpenses(), getTrips()]).then(([e, t]) => {
    setExpenses(e.data); setTrips(t.data); setLoading(false);
  });
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    await createExpense(form, receiptFile);
    await load();
    setForm({ trip_id: '', expense_type: 'Fuel', amount: '', date: new Date().toISOString().slice(0,10), notes: '' });
    setReceiptFile(null);
    setSaving(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try { await downloadExpenseReport(); } catch(e) { alert('Download failed'); }
    setDownloading(false);
  };

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const byType = EXP_TYPES.map(t => ({
    name: t,
    total: expenses.filter(e => e.expense_type === t).reduce((s, e) => s + e.amount, 0)
  })).filter(x => x.total > 0);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  if (loading) return <div className="loading"><div className="spinner" /> Loading expenses...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">FINANCE / EXPENSES</div>
          <h2>Expense Tracking</h2>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleDownload} disabled={downloading}>
          {downloading ? 'Downloading...' : 'Download Excel Report'}
        </button>
      </div>
      <div className="page-body">
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div className="stat-card red">
            <div className="stat-label">Total Expenses</div>
            <div className="stat-value red" style={{ fontSize: 20 }}>{fmt(total)}</div>
          </div>
          {EXP_TYPES.map(t => {
            const amt = expenses.filter(e => e.expense_type === t).reduce((s, e) => s + e.amount, 0);
            return (
              <div key={t} className="stat-card amber">
                <div className="stat-label">{t}</div>
                <div className="stat-value" style={{ fontSize: 18, color: COLORS[t] }}>{fmt(amt)}</div>
                <div className="stat-sub">{expenses.filter(e => e.expense_type === t).length} entries</div>
              </div>
            );
          })}
        </div>

        <div className="grid-2 mb-6">
          <div className="card">
            <div className="card-title mb-4">Expense Distribution</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byType} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                  {byType.map((e) => <Cell key={e.name} fill={COLORS[e.name] || '#64748b'} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="card-title mb-4">By Type</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byType}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="total" radius={[3,3,0,0]}>
                  {byType.map((e) => <Cell key={e.name} fill={COLORS[e.name] || '#64748b'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-title mb-4">Log New Expense</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Trip *</label>
                <select className="form-select" value={form.trip_id} onChange={e => setForm({ ...form, trip_id: e.target.value })}>
                  <option value="">-- Select trip --</option>
                  {trips.map(t => <option key={t.id} value={t.id}>{t.pickup} → {t.destination} ({t.driver_name || 'No driver'})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Expense Type</label>
                <select className="form-select" value={form.expense_type} onChange={e => setForm({ ...form, expense_type: e.target.value })}>
                  {EXP_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount (INR) *</label>
                <input className="form-input" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" placeholder="Optional details" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Receipt (optional)</label>
                <input className="form-input" type="file" accept="image/*,.pdf" onChange={e => setReceiptFile(e.target.files[0])} />
              </div>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.trip_id || !form.amount}>
                {saving ? 'Saving...' : 'Log Expense'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title mb-4">Recent Expenses</div>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Type</th><th>Route</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {expenses.slice(0, 20).map(e => (
                    <tr key={e.id}>
                      <td><span className="badge" style={{ background: `${COLORS[e.expense_type]}20`, color: COLORS[e.expense_type] }}>{e.expense_type}</span></td>
                      <td style={{ fontSize: 11 }}>{e.pickup || '?'} → {e.destination || '?'}</td>
                      <td className="text-mono text-red">{fmt(e.amount)}</td>
                      <td><span className={`badge ${e.status==='Approved'?'badge-delivered':e.status==='Rejected'?'badge-maintenance':'badge-created'}`}>{e.status}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text3)' }}>{e.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
