import React, { useEffect, useState } from 'react';
import { getInvoices, createInvoice, getTrips } from '../utils/api';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ trip_id: '', customer_name: '', freight_rate: '' });
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => Promise.all([getInvoices(), getTrips()]).then(([inv, t]) => {
    setInvoices(inv.data); setTrips(t.data); setLoading(false);
  });
  useEffect(() => { load(); }, []);

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const selectedTrip = trips.find(t => t.id === form.trip_id);
  const previewTotal = selectedTrip && form.freight_rate
    ? Math.round(selectedTrip.distance * form.freight_rate)
    : null;

  const handleSave = async () => {
    if (!selectedTrip || !form.freight_rate) return;
    setSaving(true);
    await createInvoice({ trip_id: form.trip_id, customer_name: form.customer_name, freight_rate: form.freight_rate, distance: selectedTrip.distance });
    await load();
    setForm({ trip_id: '', customer_name: '', freight_rate: '' });
    setSaving(false);
  };

  const totalRevenue = invoices.reduce((s, i) => s + i.total_amount, 0);

  if (loading) return <div className="loading"><div className="spinner" /> Loading invoices...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">FINANCE / INVOICES</div>
          <h2>Invoice Management</h2>
        </div>
      </div>
      <div className="page-body">
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="stat-card green">
            <div className="stat-label">Total Invoiced</div>
            <div className="stat-value green" style={{ fontSize: 20 }}>{fmt(totalRevenue)}</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-label">Invoices Count</div>
            <div className="stat-value">{invoices.length}</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-label">Avg Invoice Value</div>
            <div className="stat-value amber" style={{ fontSize: 20 }}>{invoices.length ? fmt(totalRevenue / invoices.length) : '—'}</div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-title mb-4">Generate Invoice</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Select Trip *</label>
                <select className="form-select" value={form.trip_id} onChange={e => setForm({ ...form, trip_id: e.target.value })}>
                  <option value="">-- Choose trip --</option>
                  {trips.filter(t => !invoices.find(i => i.trip_id === t.id)).map(t => (
                    <option key={t.id} value={t.id}>{t.pickup} → {t.destination} | {t.driver} | {t.distance}km</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Customer / Department *</label>
                <input className="form-input" placeholder="e.g. Health Ministry, PWD Dept" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Freight Rate (₹/km) *</label>
                <input className="form-input" type="number" placeholder="e.g. 15.50" value={form.freight_rate} onChange={e => setForm({ ...form, freight_rate: e.target.value })} />
              </div>
              {selectedTrip && form.freight_rate && (
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: 14 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', letterSpacing: 1, marginBottom: 6 }}>INVOICE PREVIEW</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>Route</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{selectedTrip.pickup} → {selectedTrip.destination}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>Distance</span>
                    <span className="text-mono" style={{ fontSize: 12 }}>{selectedTrip.distance} km</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>Rate</span>
                    <span className="text-mono" style={{ fontSize: 12 }}>₹{form.freight_rate}/km</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border2)', paddingTop: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>TOTAL</span>
                    <span className="text-mono text-green" style={{ fontSize: 18, fontWeight: 700 }}>{fmt(previewTotal)}</span>
                  </div>
                </div>
              )}
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.trip_id || !form.customer_name || !form.freight_rate}>
                {saving ? 'Generating...' : 'Generate Invoice'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title mb-4">Invoice Register</div>
            {preview && (
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 8, padding: 20, marginBottom: 16, position: 'relative' }}>
                <button onClick={() => setPreview(null)} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>✕</button>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--accent)', marginBottom: 8 }}>INVOICE #{preview.id.slice(0,8).toUpperCase()}</div>
                <div style={{ fontSize: 12, marginBottom: 4 }}><strong>{preview.customer_name}</strong></div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{preview.pickup} → {preview.destination}</div>
                <div style={{ marginTop: 10, fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 700 }}>{fmt(preview.total_amount)}</div>
              </div>
            )}
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Invoice #</th><th>Customer</th><th>Route</th><th>Amount</th><th>Date</th></tr></thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} onClick={() => setPreview(inv)} style={{ cursor: 'pointer' }}>
                      <td className="text-mono" style={{ fontSize: 11, color: 'var(--accent)' }}>#{inv.id.slice(0,8).toUpperCase()}</td>
                      <td style={{ fontSize: 12 }}>{inv.customer_name}</td>
                      <td style={{ fontSize: 11 }}>{inv.pickup} → {inv.destination}</td>
                      <td className="text-mono text-green" style={{ fontWeight: 700 }}>{fmt(inv.total_amount)}</td>
                      <td style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(inv.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                  {invoices.length === 0 && <tr><td colSpan={5}><div className="empty-state"><p>No invoices generated</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
