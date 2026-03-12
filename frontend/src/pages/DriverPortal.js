import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getDashboard, getTrip, updateTripStatus, postDriverUpdate, createExpense, uploadDocument, getAnalytics, downloadAnalyticsReport } from '../utils/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid
} from 'recharts';

const UPDATE_TYPES = ['Departed', 'Checkpoint', 'Fuel Stop', 'Toll Paid', 'Delay', 'Delivered', 'Other'];
const EXP_TYPES = ['Fuel', 'Toll', 'Repair', 'Other'];
const DOC_TYPES = ['Delivery Receipt', 'Fuel Bill', 'Toll Receipt', 'Vehicle Photo', 'Other'];
const COLORS = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#f97316'];

export default function DriverPortal() {
  const { user } = useAuth();
  const [dash, setDash] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [tab, setTab] = useState('trip');
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [updateForm, setUpdateForm] = useState({ update_type: 'Checkpoint', message: '', lat: '', lng: '' });
  const [photo, setPhoto] = useState(null);
  const [expForm, setExpForm] = useState({ expense_type: 'Fuel', amount: '', date: new Date().toISOString().slice(0,10), notes: '' });
  const [receipt, setReceipt] = useState(null);
  const [docForm, setDocForm] = useState({ doc_type: 'Delivery Receipt' });
  const [docFile, setDocFile] = useState(null);

  const load = async () => {
    const [d, an] = await Promise.all([getDashboard(), getAnalytics(period)]);
    setDash(d.data);
    setAnalytics(an.data);
    if (d.data.activeTrip) {
      const t = await getTrip(d.data.activeTrip.id);
      setActiveTrip(t.data);
    } else {
      setActiveTrip(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (!loading) getAnalytics(period).then(r => setAnalytics(r.data)); }, [period]);

  const getGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setUpdateForm(f => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
      });
    }
  };

  const handleUpdate = async () => {
    if (!activeTrip) return;
    setSaving(true);
    await postDriverUpdate(activeTrip.id, updateForm, photo);
    await load();
    setUpdateForm({ update_type: 'Checkpoint', message: '', lat: '', lng: '' });
    setPhoto(null);
    setSaving(false);
  };

  const handleStatusUpdate = async (status) => {
    if (!activeTrip) return;
    setSaving(true);
    await updateTripStatus(activeTrip.id, status);
    await load();
    setSaving(false);
  };

  const handleExpense = async () => {
    if (!activeTrip) return;
    setSaving(true);
    await createExpense({ trip_id: activeTrip.id, ...expForm }, receipt);
    await load();
    setExpForm({ expense_type: 'Fuel', amount: '', date: new Date().toISOString().slice(0,10), notes: '' });
    setReceipt(null);
    setSaving(false);
  };

  const handleDoc = async () => {
    if (!activeTrip || !docFile) return;
    setSaving(true);
    await uploadDocument(activeTrip.id, docForm.doc_type, docFile);
    await load();
    setDocFile(null);
    setSaving(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try { await downloadAnalyticsReport(); } catch(e) { alert('Download failed'); }
    setDownloading(false);
  };

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>;

  const STATUS_FLOW = ['Accepted', 'Dispatched', 'In Transit', 'Delivered'];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">DRIVER PORTAL</div>
          <h2>Welcome, {user.name}</h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? '...' : 'Download Report (Excel)'}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Enhanced KPIs */}
        <div className="stat-grid" style={{marginBottom:24}}>
          <div className="stat-card blue">
            <div className="stat-label">Total Trips</div>
            <div className="stat-value">{dash?.totalTrips || 0}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">Completed</div>
            <div className="stat-value green">{dash?.completedTrips || 0}</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-label">Total Distance</div>
            <div className="stat-value amber">{dash?.totalDistance || 0} km</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">Approved Expenses</div>
            <div className="stat-value green" style={{fontSize:16}}>{fmt(dash?.approvedExpenses || 0)}</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-label">Pending Expenses</div>
            <div className="stat-value amber">{dash?.pendingExpenses || 0}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Rejected</div>
            <div className="stat-value red" style={{fontSize:16}}>{fmt(dash?.rejectedExpenses || 0)}</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-label">Total Claimed</div>
            <div className="stat-value" style={{color:'var(--purple)', fontSize:16}}>{fmt(dash?.totalExpensesClaimed || 0)}</div>
          </div>
        </div>

        {/* Active trip or no trip */}
        {!activeTrip ? (
          <div className="card mb-6" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>TRUCK</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No Active Trip</div>
            <p style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              You will see your trip details here once the company assigns and dispatches a trip to you.
            </p>
          </div>
        ) : (
          <>
            {/* Active trip header */}
            <div className="card mb-6" style={{ borderColor: 'var(--accent)', borderWidth: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: 2, marginBottom: 6 }}>ACTIVE TRIP</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{activeTrip.pickup} → {activeTrip.destination}</div>
                  <div style={{ color: 'var(--text2)', marginTop: 4 }}>
                    {activeTrip.cargo_type} | {activeTrip.distance} km | {activeTrip.registration || 'Vehicle TBD'}
                  </div>
                  {activeTrip.customer_name && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Customer: {activeTrip.customer_name} ({activeTrip.customer_company || ''})</div>}
                </div>
                <div>
                  <span className={`badge badge-${activeTrip.status.toLowerCase().replace(' ','-')}`} style={{ fontSize: 12, padding: '6px 12px' }}>{activeTrip.status}</span>
                </div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STATUS_FLOW.filter(s => s !== activeTrip.status).map(s => (
                  <button key={s} className="btn btn-secondary btn-sm" onClick={() => handleStatusUpdate(s)} disabled={saving}>
                    Mark as {s}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Tabs */}
        <div className="tabs">
          {[...(activeTrip ? ['trip', 'update', 'expense', 'documents'] : []), 'analytics', 'all-expenses'].map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'trip' ? 'Trip Info' : t === 'update' ? 'Post Update' : t === 'expense' ? 'Log Expense' : t === 'documents' ? 'Documents' : t === 'analytics' ? 'Analytics' : 'All Expenses'}
              {t === 'expense' && activeTrip?.expenses?.filter(e => e.status === 'Pending').length > 0 &&
                <span style={{ marginLeft: 4, background: 'var(--accent)', color: '#000', borderRadius: 10, padding: '1px 5px', fontSize: 9, fontWeight: 700 }}>{activeTrip.expenses.filter(e => e.status === 'Pending').length}</span>}
            </button>
          ))}
        </div>

        {/* ── TRIP INFO TAB ── */}
        {tab === 'trip' && activeTrip && (
          <div className="grid-2">
            <div className="card">
              <div className="card-title mb-4">Trip Details</div>
              {[['Pickup', activeTrip.pickup], ['Destination', activeTrip.destination], ['Cargo', activeTrip.cargo_type], ['Distance', `${activeTrip.distance} km`], ['Vehicle', activeTrip.registration || 'TBD'], ['Customer', activeTrip.customer_name || 'N/A'], ['Notes', activeTrip.notes || '--']].map(([k,v]) => (
                <div key={k} style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: 120, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>{k}</span>
                  <span style={{ color: 'var(--text)' }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title mb-4">Journey Updates</div>
              {activeTrip.driver_updates?.length > 0 ? (
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {[...activeTrip.driver_updates].reverse().map(u => (
                    <div key={u.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.update_type}</div>
                        {u.message && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{u.message}</div>}
                        {u.lat && <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)', marginTop: 2 }}>GPS: {u.lat}, {u.lng}</div>}
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{new Date(u.created_at).toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-state"><p>No updates posted yet</p></div>}
            </div>
          </div>
        )}

        {/* ── POST UPDATE TAB ── */}
        {tab === 'update' && activeTrip && (
          <div className="grid-2">
            <div className="card">
              <div className="card-title mb-4">Post Journey Update</div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Update Type</label>
                  <select className="form-select" value={updateForm.update_type} onChange={e => setUpdateForm({...updateForm, update_type: e.target.value})}>
                    {UPDATE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Message</label>
                  <textarea className="form-textarea" value={updateForm.message} onChange={e => setUpdateForm({...updateForm, message: e.target.value})} placeholder="Describe what's happening..." style={{ minHeight: 80 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">GPS Location</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" placeholder="Latitude" value={updateForm.lat} onChange={e => setUpdateForm({...updateForm, lat: e.target.value})} style={{ flex: 1 }} />
                    <input className="form-input" placeholder="Longitude" value={updateForm.lng} onChange={e => setUpdateForm({...updateForm, lng: e.target.value})} style={{ flex: 1 }} />
                    <button className="btn btn-secondary" onClick={getGPS} title="Use my location">GPS</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Attach Photo</label>
                  <input className="form-input" type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])} />
                </div>
                <button className="btn btn-primary" onClick={handleUpdate} disabled={saving}>
                  {saving ? 'Posting...' : 'Post Update'}
                </button>
              </div>
            </div>
            <div className="card">
              <div className="card-title mb-4">Recent Updates</div>
              {activeTrip.driver_updates?.length > 0 ? (
                [...activeTrip.driver_updates].reverse().slice(0, 8).map(u => (
                  <div key={u.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                      {u.update_type === 'Fuel Stop' ? 'F' : u.update_type === 'Toll Paid' ? 'T' : u.update_type === 'Delivered' ? 'D' : u.update_type === 'Delay' ? '!' : 'C'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{u.update_type}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{u.message}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{new Date(u.created_at).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ))
              ) : <div className="empty-state"><p>No updates yet</p></div>}
            </div>
          </div>
        )}

        {/* ── LOG EXPENSE TAB ── */}
        {tab === 'expense' && activeTrip && (
          <div className="grid-2">
            <div className="card">
              <div className="card-title mb-4">Log Trip Expense</div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Expense Type</label>
                  <select className="form-select" value={expForm.expense_type} onChange={e => setExpForm({...expForm, expense_type: e.target.value})}>
                    {EXP_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (INR) *</label>
                  <input className="form-input" type="number" placeholder="0.00" value={expForm.amount} onChange={e => setExpForm({...expForm, amount: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={expForm.date} onChange={e => setExpForm({...expForm, date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" placeholder="Details (e.g. litres of fuel)" value={expForm.notes} onChange={e => setExpForm({...expForm, notes: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Attach Receipt</label>
                  <input className="form-input" type="file" accept="image/*,.pdf" onChange={e => setReceipt(e.target.files[0])} />
                </div>
                <button className="btn btn-primary" onClick={handleExpense} disabled={saving || !expForm.amount}>
                  {saving ? 'Submitting...' : 'Submit Expense'}
                </button>
              </div>
              <div style={{ marginTop: 12, padding: 10, background: 'rgba(245,158,11,0.05)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.2)', fontSize: 11, color: 'var(--text3)' }}>
                Expenses are submitted for company approval. Approved amounts will be included in final reporting.
              </div>
            </div>
            <div className="card">
              <div className="card-title mb-4">Expenses for This Trip</div>
              {activeTrip.expenses?.length > 0 ? (
                <>
                  <table className="data-table">
                    <thead><tr><th>Type</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
                    <tbody>
                      {activeTrip.expenses.map(e => (
                        <tr key={e.id}>
                          <td><span className="badge badge-dispatched">{e.expense_type}</span></td>
                          <td className="text-mono">{fmt(e.amount)}</td>
                          <td style={{ fontSize: 11, color: 'var(--text3)' }}>{e.date}</td>
                          <td><span className={`badge ${e.status === 'Approved' ? 'badge-delivered' : e.status === 'Rejected' ? 'badge-maintenance' : 'badge-created'}`}>{e.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-mono" style={{ fontSize: 11, color: 'var(--text3)' }}>TOTAL CLAIMED</span>
                    <span className="text-mono text-amber font-bold">{fmt(activeTrip.expenses.reduce((s,e) => s + e.amount, 0))}</span>
                  </div>
                </>
              ) : <div className="empty-state"><p>No expenses logged yet</p></div>}
            </div>
          </div>
        )}

        {/* ── DOCUMENTS TAB ── */}
        {tab === 'documents' && activeTrip && (
          <div className="grid-2">
            <div className="card">
              <div className="card-title mb-4">Upload Document</div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Document Type</label>
                  <select className="form-select" value={docForm.doc_type} onChange={e => setDocForm({...docForm, doc_type: e.target.value})}>
                    {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Select File</label>
                  <input className="form-input" type="file" onChange={e => setDocFile(e.target.files[0])} />
                </div>
                <button className="btn btn-primary" onClick={handleDoc} disabled={saving || !docFile}>
                  {saving ? 'Uploading...' : 'Upload Document'}
                </button>
              </div>
            </div>
            <div className="card">
              <div className="card-title mb-4">Uploaded Documents</div>
              {activeTrip.documents?.length > 0 ? (
                <table className="data-table">
                  <thead><tr><th>Type</th><th>File</th><th>Uploaded</th></tr></thead>
                  <tbody>
                    {activeTrip.documents.map(d => (
                      <tr key={d.id}>
                        <td><span className="badge badge-on-trip">{d.doc_type}</span></td>
                        <td style={{ fontSize: 11 }}>{d.original_name}</td>
                        <td style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(d.uploaded_at).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="empty-state"><p>No documents uploaded</p></div>}
            </div>
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && (
          <div>
            {/* Period selector */}
            <div className="card mb-4" style={{padding:'12px 16px', display:'flex', alignItems:'center', gap:12}}>
              <span style={{fontSize:11, fontFamily:'var(--font-mono)', color:'var(--text3)', textTransform:'uppercase'}}>Time Period:</span>
              {['daily','weekly','monthly'].map(p => (
                <button key={p} className={`btn btn-sm ${period===p?'btn-primary':'btn-secondary'}`} onClick={()=>setPeriod(p)}>
                  {p.charAt(0).toUpperCase()+p.slice(1)}
                </button>
              ))}
            </div>

            <div className="grid-2 mb-6">
              {/* Trip trends */}
              <div className="card">
                <div className="card-title mb-4">Trip Trends ({period})</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={analytics?.tripTrends || []}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="period" tick={{fontSize:10}} />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="trips" stroke="#3b82f6" fill="rgba(59,130,246,0.15)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Expense trends */}
              <div className="card">
                <div className="card-title mb-4">Expense Trends ({period})</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics?.expenseTrends || []}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="period" tick={{fontSize:10}} />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Bar dataKey="total_expenses" name="Expenses" fill="#ef4444" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid-2 mb-6">
              {/* Expense by type */}
              <div className="card">
                <div className="card-title mb-4">Expense Breakdown</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={dash?.expenseByType || []} dataKey="total" nameKey="expense_type" cx="50%" cy="50%" outerRadius={85} label={({expense_type,total})=>`${expense_type}: ${fmt(total)}`}>
                      {(dash?.expenseByType || []).map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Route frequency */}
              <div className="card">
                <div className="card-title mb-4">Route Frequency</div>
                <table className="data-table">
                  <thead><tr><th>Route</th><th>Trips</th></tr></thead>
                  <tbody>
                    {(dash?.routeFrequency || []).map((r,i) => (
                      <tr key={i}>
                        <td style={{color:'var(--text)',fontWeight:600}}>{r.route}</td>
                        <td className="text-mono">{r.count}</td>
                      </tr>
                    ))}
                    {(dash?.routeFrequency||[]).length === 0 && <tr><td colSpan={2} style={{color:'var(--text3)',textAlign:'center'}}>No data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent trips table */}
            <div className="card">
              <div className="card-title mb-4">Recent Trips</div>
              <table className="data-table">
                <thead><tr><th>Route</th><th>Cargo</th><th>Customer</th><th>Distance</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {(dash?.recentTrips || []).map(t => (
                    <tr key={t.id}>
                      <td style={{color:'var(--text)',fontWeight:600}}>{t.pickup} → {t.destination}</td>
                      <td>{t.cargo_type}</td>
                      <td style={{fontSize:11}}>{t.customer_name || '--'}</td>
                      <td className="text-mono">{t.distance} km</td>
                      <td><span className={`badge badge-${t.status.toLowerCase().replace(' ','-')}`}>{t.status}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ALL EXPENSES TAB ── */}
        {tab === 'all-expenses' && (
          <div>
            <div className="grid-2 mb-6">
              <div className="card">
                <div className="card-title mb-4">Expense by Type</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dash?.expenseByType || []}>
                    <XAxis dataKey="expense_type" />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Bar dataKey="total" fill="#f59e0b" radius={[3,3,0,0]}>
                      {(dash?.expenseByType || []).map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:16}}>
                  <div>
                    <div className="stat-label">Approved</div>
                    <div className="text-mono text-green" style={{fontSize:20, fontWeight:700}}>{fmt(dash?.approvedExpenses || 0)}</div>
                  </div>
                  <div>
                    <div className="stat-label">Pending</div>
                    <div className="text-mono text-amber" style={{fontSize:20, fontWeight:700}}>{dash?.pendingExpenses || 0} items</div>
                  </div>
                  <div>
                    <div className="stat-label">Rejected</div>
                    <div className="text-mono text-red" style={{fontSize:20, fontWeight:700}}>{fmt(dash?.rejectedExpenses || 0)}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-title mb-4">All My Expenses</div>
              <table className="data-table">
                <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Notes</th><th>Status</th></tr></thead>
                <tbody>
                  {(dash?.allExpenses || []).map(e => (
                    <tr key={e.id}>
                      <td style={{fontSize:11, color:'var(--text3)'}}>{e.date}</td>
                      <td><span className="badge badge-dispatched">{e.expense_type}</span></td>
                      <td className="text-mono text-red">{fmt(e.amount)}</td>
                      <td style={{fontSize:11}}>{e.notes || '--'}</td>
                      <td><span className={`badge ${e.status==='Approved'?'badge-delivered':e.status==='Rejected'?'badge-maintenance':'badge-created'}`}>{e.status}</span></td>
                    </tr>
                  ))}
                  {(dash?.allExpenses||[]).length === 0 && <tr><td colSpan={5} style={{color:'var(--text3)',textAlign:'center'}}>No expenses yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
