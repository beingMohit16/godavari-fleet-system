import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getDashboard, createTrip, getTrips, getTrip, getInvoices, getAnalytics, downloadTripReport, downloadAnalyticsReport, downloadTripDocuments, viewInvoicePDF } from '../utils/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, AreaChart, Area
} from 'recharts';

const CARGO_TYPES = ['Medical Supplies', 'Food Grains', 'Construction Material', 'Electronics', 'Textiles', 'Machinery', 'Other'];
const ROUTES = [
  { from: 'Mumbai', to: 'Pune', distance: 148, plat: 19.076, plng: 72.877, dlat: 18.520, dlng: 73.856 },
  { from: 'Delhi', to: 'Agra', distance: 206, plat: 28.613, plng: 77.209, dlat: 27.176, dlng: 78.008 },
  { from: 'Bangalore', to: 'Chennai', distance: 346, plat: 12.971, plng: 77.594, dlat: 13.083, dlng: 80.270 },
  { from: 'Ahmedabad', to: 'Surat', distance: 265, plat: 23.022, plng: 72.571, dlat: 21.170, dlng: 72.831 },
  { from: 'Jaipur', to: 'Jodhpur', distance: 330, plat: 26.912, plng: 75.787, dlat: 26.295, dlng: 73.017 },
];
const COLORS = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#f97316'];

function StatusBadge({ status }) {
  const map = { Pending: 'created', Accepted: 'dispatched', Dispatched: 'dispatched', 'In Transit': 'in-transit', Delivered: 'delivered', Returned: 'returned' };
  return <span className={`badge badge-${map[status] || 'created'}`}>{status}</span>;
}

export default function CustomerPortal() {
  const { user } = useAuth();
  const [dash, setDash] = useState(null);
  const [trips, setTrips] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [period, setPeriod] = useState('monthly');
  const [showBook, setShowBook] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [form, setForm] = useState({ cargo_type: 'Medical Supplies', pickup: '', destination: '', distance: '', notes: '', pickup_lat: '', pickup_lng: '', dest_lat: '', dest_lng: '' });

  const load = async () => {
    const [d, t, inv, an] = await Promise.all([getDashboard(), getTrips(), getInvoices(), getAnalytics(period)]);
    setDash(d.data); setTrips(t.data); setInvoices(inv.data); setAnalytics(an.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (!loading) getAnalytics(period).then(r => setAnalytics(r.data)); }, [period]);

  const handleRouteSelect = (e) => {
    const r = ROUTES[parseInt(e.target.value)];
    if (r) setForm({ ...form, pickup: r.from, destination: r.to, distance: r.distance, pickup_lat: r.plat, pickup_lng: r.plng, dest_lat: r.dlat, dest_lng: r.dlng });
  };

  const handleBook = async () => {
    setSaving(true);
    try {
      await createTrip(form);
      await load();
      setShowBook(false);
      setForm({ cargo_type: 'Medical Supplies', pickup: '', destination: '', distance: '', notes: '' });
    } catch (e) { alert(e.response?.data?.error || 'Error booking trip'); }
    setSaving(false);
  };

  const openTrip = async (id) => {
    const t = await getTrip(id);
    setSelectedTrip(t.data);
    setTab('detail');
  };

  const handleDownload = async (fn) => {
    setDownloading(true);
    try { await fn(); } catch(e) { alert('Download failed'); }
    setDownloading(false);
  };

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  if (loading) return <div className="loading"><div className="spinner" />Loading...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">CUSTOMER PORTAL</div>
          <h2>{user.company || user.name}</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(downloadAnalyticsReport)} disabled={downloading}>
            {downloading ? '...' : 'Download Report (Excel)'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowBook(true)}>+ Book New Trip</button>
        </div>
      </div>
      <div className="page-body">
        {/* Enhanced KPIs */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card blue"><div className="stat-label">Total Bookings</div><div className="stat-value">{dash?.totalTrips || 0}</div></div>
          <div className="stat-card amber"><div className="stat-label">Pending</div><div className="stat-value amber">{dash?.pending || 0}</div></div>
          <div className="stat-card blue"><div className="stat-label">In Progress</div><div className="stat-value" style={{ color: 'var(--blue2)' }}>{dash?.active || 0}</div></div>
          <div className="stat-card green"><div className="stat-label">Delivered</div><div className="stat-value green">{dash?.delivered || 0}</div></div>
          <div className="stat-card green"><div className="stat-label">Total Invoiced</div><div className="stat-value green" style={{fontSize:18}}>{fmt(dash?.totalInvoiced || 0)}</div></div>
          <div className="stat-card red"><div className="stat-label">Total Expenses</div><div className="stat-value red" style={{fontSize:18}}>{fmt(dash?.totalExpenses || 0)}</div></div>
          <div className="stat-card purple"><div className="stat-label">Avg Distance</div><div className="stat-value" style={{color:'var(--purple)'}}>{dash?.avgTripDistance || 0} km</div></div>
        </div>

        <div className="tabs">
          {['dashboard', 'trips', 'invoices', 'expenses', ...(selectedTrip ? ['detail'] : [])].map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'dashboard' ? 'Analytics' : t === 'trips' ? 'My Bookings' : t === 'invoices' ? 'Invoices' : t === 'expenses' ? 'Expenses' : 'Trip Detail'}
            </button>
          ))}
        </div>

        {/* ── ANALYTICS DASHBOARD TAB ── */}
        {tab === 'dashboard' && (
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
              {/* Cargo distribution */}
              <div className="card">
                <div className="card-title mb-4">Cargo Type Distribution</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={dash?.cargoStats || []} dataKey="count" nameKey="cargo_type" cx="50%" cy="50%" outerRadius={85} label={({cargo_type,count})=>`${cargo_type.split(' ')[0]}: ${count}`}>
                      {(dash?.cargoStats || []).map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Route breakdown */}
              <div className="card">
                <div className="card-title mb-4">Route Breakdown</div>
                <table className="data-table">
                  <thead><tr><th>Route</th><th>Trips</th><th>Total Distance</th></tr></thead>
                  <tbody>
                    {(dash?.routeStats || []).map((r,i) => (
                      <tr key={i}>
                        <td style={{color:'var(--text)',fontWeight:600}}>{r.route}</td>
                        <td className="text-mono">{r.trips}</td>
                        <td className="text-mono">{r.distance} km</td>
                      </tr>
                    ))}
                    {(dash?.routeStats||[]).length === 0 && <tr><td colSpan={3} style={{color:'var(--text3)',textAlign:'center'}}>No data yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Status breakdown */}
            <div className="card">
              <div className="card-title mb-4">Trip Status Overview</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics?.statusBreakdown || []} barCategoryGap="40%">
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {(analytics?.statusBreakdown || []).map((entry, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── MY BOOKINGS TAB ── */}
        {tab === 'trips' && (
          <div className="card">
            <div className="flex-between mb-4">
              <div className="card-title">My Bookings</div>
              <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(downloadTripReport)} disabled={downloading}>
                {downloading ? '...' : 'Download Excel'}
              </button>
            </div>
            <table className="data-table">
              <thead><tr><th>Booking Date</th><th>Route</th><th>Cargo</th><th>Distance</th><th>Driver</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {trips.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(t.booking_date || t.created_at).toLocaleDateString('en-IN')}</td>
                    <td style={{ color: 'var(--text)', fontWeight: 600 }}>{t.pickup} → {t.destination}</td>
                    <td><span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--blue2)' }}>{t.cargo_type}</span></td>
                    <td className="text-mono">{t.distance} km</td>
                    <td>{t.driver_name || <span style={{ color: 'var(--text3)' }}>Awaiting</span>}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td><button className="btn btn-sm btn-secondary" onClick={() => openTrip(t.id)}>View</button></td>
                  </tr>
                ))}
                {trips.length === 0 && <tr><td colSpan={7}><div className="empty-state"><p>No bookings yet. Book your first trip!</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── INVOICES TAB ── */}
        {tab === 'invoices' && (
          <div className="card">
            <div className="card-title mb-4">My Invoices</div>
            <table className="data-table">
              <thead><tr><th>Invoice #</th><th>Route</th><th>Cargo</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="text-mono" style={{ color: 'var(--accent)', fontSize: 11 }}>#{inv.id.slice(0,8).toUpperCase()}</td>
                    <td>{inv.pickup} → {inv.destination}</td>
                    <td style={{ fontSize: 12 }}>{inv.cargo_type}</td>
                    <td className="text-mono text-green" style={{ fontWeight: 700 }}>{fmt(inv.total_amount)}</td>
                    <td><span className={`badge ${inv.status === 'Sent' ? 'badge-dispatched' : inv.status === 'Paid' ? 'badge-delivered' : 'badge-created'}`}>{inv.status}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(inv.created_at).toLocaleDateString('en-IN')}</td>
                    <td>
                      <a href={viewInvoicePDF(inv.id)} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary">Print</a>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan={7}><div className="empty-state"><p>No invoices yet</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── EXPENSES TAB ── */}
        {tab === 'expenses' && (
          <div>
            <div className="grid-2 mb-6">
              <div className="card">
                <div className="card-title mb-4">Expense Breakdown by Type</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={analytics?.expenseByType || []} dataKey="total" nameKey="expense_type" cx="50%" cy="50%" outerRadius={85} label={({expense_type,total})=>`${expense_type}: ${fmt(total)}`}>
                      {(analytics?.expenseByType || []).map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <div className="card-title mb-4">Expense by Type (Bar)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics?.expenseByType || []}>
                    <XAxis dataKey="expense_type" />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Bar dataKey="total" fill="#f59e0b" radius={[3,3,0,0]}>
                      {(analytics?.expenseByType || []).map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-title mb-4">All Expenses on Your Trips</div>
              <table className="data-table">
                <thead><tr><th>Date</th><th>Route</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {(dash?.expenses || []).map(e => (
                    <tr key={e.id}>
                      <td style={{fontSize:11, color:'var(--text3)'}}>{e.date}</td>
                      <td>{e.pickup || '?'} → {e.destination || '?'}</td>
                      <td><span className="badge badge-dispatched">{e.expense_type}</span></td>
                      <td className="text-mono text-red">{fmt(e.amount)}</td>
                      <td><span className={`badge ${e.status==='Approved'?'badge-delivered':'badge-created'}`}>{e.status}</span></td>
                    </tr>
                  ))}
                  {(dash?.expenses||[]).length === 0 && <tr><td colSpan={5} style={{color:'var(--text3)',textAlign:'center'}}>No expense data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TRIP DETAIL TAB ── */}
        {tab === 'detail' && selectedTrip && (
          <div>
            <button className="btn btn-secondary btn-sm mb-4" onClick={() => setTab('trips')}>Back to Trips</button>
            <div className="grid-2 mb-4">
              <div className="card">
                <div className="card-title mb-4">Trip Information</div>
                {[['Route', `${selectedTrip.pickup} → ${selectedTrip.destination}`], ['Cargo', selectedTrip.cargo_type], ['Distance', `${selectedTrip.distance} km`], ['Driver', selectedTrip.driver_name || 'Awaiting assignment'], ['Vehicle', selectedTrip.registration || 'TBD'], ['Status', selectedTrip.status], ['Notes', selectedTrip.notes || '--']].map(([k,v]) => (
                  <div key={k} style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ width: 110, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>{k}</span>
                    <span style={{ color: 'var(--text)', fontWeight: k === 'Status' ? 700 : 400 }}>{v}</span>
                  </div>
                ))}
                {/* Show expenses for this trip */}
                {selectedTrip.expenses?.length > 0 && (
                  <div style={{marginTop:16}}>
                    <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text3)', textTransform:'uppercase', marginBottom:8}}>Trip Expenses</div>
                    <table className="data-table">
                      <thead><tr><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
                      <tbody>{selectedTrip.expenses.map(e => (
                        <tr key={e.id}>
                          <td><span className="badge badge-dispatched">{e.expense_type}</span></td>
                          <td className="text-mono text-red">{fmt(e.amount)}</td>
                          <td><span className={`badge ${e.status==='Approved'?'badge-delivered':'badge-created'}`}>{e.status}</span></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                {/* Show invoice if exists */}
                {selectedTrip.invoice && (
                  <div style={{marginTop:16, padding:12, background:'rgba(16,185,129,0.05)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:6}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text3)'}}>INVOICE #{selectedTrip.invoice.id.slice(0,8).toUpperCase()}</div>
                        <div className="text-mono text-green" style={{fontSize:18, fontWeight:700}}>{fmt(selectedTrip.invoice.total_amount)}</div>
                      </div>
                      <a href={viewInvoicePDF(selectedTrip.invoice.id)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Print</a>
                    </div>
                  </div>
                )}
              </div>
              <div className="card">
                <div className="card-title mb-4">Driver Journey Updates</div>
                {selectedTrip.driver_updates?.length > 0 ? (
                  [...selectedTrip.driver_updates].reverse().map(u => (
                    <div key={u.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.update_type}</div>
                        {u.message && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{u.message}</div>}
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{new Date(u.created_at).toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  ))
                ) : <div className="empty-state"><p>No updates from driver yet</p></div>}
              </div>
            </div>
            <div className="card">
              <div className="flex-between mb-4">
                <div className="card-title">Documents</div>
                {selectedTrip.documents?.length > 0 && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(() => downloadTripDocuments(selectedTrip.id))} disabled={downloading}>
                    {downloading ? '...' : 'Download All'}
                  </button>
                )}
              </div>
              {selectedTrip.documents?.length > 0 ? (
                <table className="data-table">
                  <thead><tr><th>Type</th><th>File</th><th>Uploaded By</th><th>Date</th></tr></thead>
                  <tbody>
                    {selectedTrip.documents.map(d => (
                      <tr key={d.id}>
                        <td><span className="badge badge-on-trip">{d.doc_type}</span></td>
                        <td style={{ fontSize: 12 }}>{d.original_name}</td>
                        <td style={{ fontSize: 12 }}>{d.uploaded_by_name || '--'}</td>
                        <td style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(d.uploaded_at).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="empty-state"><p>No documents yet</p></div>}
            </div>
          </div>
        )}
      </div>

      {/* Book Trip Modal */}
      {showBook && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBook(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <span className="modal-title">Book New Transport</span>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowBook(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-group mb-4">
                <label className="form-label">Quick Route Select</label>
                <select className="form-select" onChange={handleRouteSelect} defaultValue="">
                  <option value="">-- Select a predefined route --</option>
                  {ROUTES.map((r, i) => <option key={i} value={i}>{r.from} → {r.to} ({r.distance} km)</option>)}
                </select>
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Pickup Location *</label>
                  <input className="form-input" value={form.pickup} onChange={e => setForm({...form, pickup: e.target.value})} placeholder="City/Location" />
                </div>
                <div className="form-group">
                  <label className="form-label">Destination *</label>
                  <input className="form-input" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} placeholder="City/Location" />
                </div>
                <div className="form-group">
                  <label className="form-label">Cargo Type *</label>
                  <select className="form-select" value={form.cargo_type} onChange={e => setForm({...form, cargo_type: e.target.value})}>
                    {CARGO_TYPES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Distance (km) *</label>
                  <input className="form-input" type="number" value={form.distance} onChange={e => setForm({...form, distance: e.target.value})} placeholder="e.g. 250" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Special Instructions</label>
                  <textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any special handling or delivery instructions..." />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBook(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBook} disabled={saving || !form.pickup || !form.destination || !form.distance}>
                {saving ? 'Booking...' : 'Book Trip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
