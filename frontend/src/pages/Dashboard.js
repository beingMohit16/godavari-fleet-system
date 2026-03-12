import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard, downloadTripReport, downloadAnalyticsReport } from '../utils/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const STATUS_COLORS = {
  Pending: '#64748b', Accepted: '#f97316', Dispatched: '#f59e0b',
  'In Transit': '#3b82f6', Delivered: '#10b981', Returned: '#8b5cf6'
};

const PIE_COLORS = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#f97316'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getDashboard().then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /> Loading dashboard...</div>;
  if (!data) return <div className="loading">Failed to load dashboard</div>;

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const handleDownload = async (fn) => {
    setDownloading(true);
    try { await fn(); } catch(e) { alert('Download failed'); }
    setDownloading(false);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">OVERVIEW / DASHBOARD</div>
          <h2>Operations Dashboard</h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(downloadTripReport)} disabled={downloading}>
            {downloading ? 'Downloading...' : 'Download Trip Report'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(downloadAnalyticsReport)} disabled={downloading}>
            {downloading ? '...' : 'Download Analytics'}
          </button>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
            {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>
      </div>
      <div className="page-body">
        {/* KPI row */}
        <div className="stat-grid">
          <div className="stat-card amber">
            <div className="stat-label">Total Trips</div>
            <div className="stat-value">{data.totalTrips}</div>
            <div className="stat-sub">{data.activeTrips} currently active</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value green" style={{ fontSize: 20 }}>{fmt(data.totalRevenue)}</div>
            <div className="stat-sub">From invoices</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Total Expenses</div>
            <div className="stat-value red" style={{ fontSize: 20 }}>{fmt(data.totalExpenses)}</div>
            <div className="stat-sub">Fuel, toll, repairs</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-label">Net Profit</div>
            <div className={`stat-value ${data.netProfit >= 0 ? 'green' : 'red'}`} style={{ fontSize: 20 }}>
              {fmt(data.netProfit)}
            </div>
            <div className="stat-sub">Revenue - Expenses</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-label">Fleet Size</div>
            <div className="stat-value">{data.vehicleCount}</div>
            <div className="stat-sub">{data.activeTrips} on active trips</div>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid-2 mb-6">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Trip Status Distribution</div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.tripsByStatus || []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ status, count }) => `${status}: ${count}`} labelLine={false}>
                  {(data.tripsByStatus || []).map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] || PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Expense Breakdown</div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.expenseByType || []} barCategoryGap="30%">
                <XAxis dataKey="expense_type" />
                <YAxis />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="total" fill="#f59e0b" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Route profitability */}
        <div className="card mb-6">
          <div className="card-header">
            <div className="card-title">Route Profitability</div>
            <span className="badge badge-available">Revenue - Expenses</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Trips</th>
                <th>Revenue</th>
                <th>Expenses</th>
                <th>Profit</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {(data.routeStats || []).map((r, i) => {
                const profit = r.revenue - r.expenses;
                const margin = r.revenue > 0 ? ((profit / r.revenue) * 100).toFixed(1) : 0;
                return (
                  <tr key={i}>
                    <td className="text-mono" style={{ color: 'var(--text)' }}>{r.route}</td>
                    <td>{r.trip_count}</td>
                    <td className="text-green">{fmt(r.revenue)}</td>
                    <td className="text-red">{fmt(r.expenses)}</td>
                    <td className={profit >= 0 ? 'text-green' : 'text-red'}>{fmt(profit)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 2, height: 4 }}>
                          <div style={{ width: `${Math.min(100, Math.max(0, margin))}%`, background: profit >= 0 ? 'var(--green)' : 'var(--red)', height: '100%', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: profit >= 0 ? 'var(--green)' : 'var(--red)', minWidth: 40 }}>{margin}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom row */}
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Cargo Type Frequency</div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.cargoStats || []} layout="vertical" barCategoryGap="20%">
                <XAxis type="number" />
                <YAxis dataKey="cargo_type" type="category" width={130} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent Trips</div>
              <button className="btn btn-sm btn-secondary" onClick={() => navigate('/trips')}>View All</button>
            </div>
            <table className="data-table">
              <thead><tr><th>Route</th><th>Driver</th><th>Status</th></tr></thead>
              <tbody>
                {(data.recentTrips || []).map(t => (
                  <tr key={t.id} onClick={() => navigate(`/trips/${t.id}`)} style={{ cursor: 'pointer' }}>
                    <td style={{ color: 'var(--text)' }}>{t.pickup} → {t.destination}</td>
                    <td>{t.driver_name || <span style={{color:'var(--text3)'}}>Unassigned</span>}</td>
                    <td><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vehicle utilization */}
        {(data.vehicleUtil || []).length > 0 && (
          <div className="card mt-6">
            <div className="card-header">
              <div className="card-title">Vehicle Utilization (Top 6)</div>
            </div>
            <table className="data-table">
              <thead><tr><th>Registration</th><th>Driver</th><th>Status</th><th>Total Trips</th><th>Utilization</th></tr></thead>
              <tbody>
                {data.vehicleUtil.map(v => (
                  <tr key={v.registration}>
                    <td className="text-mono" style={{ color: 'var(--accent)' }}>{v.registration}</td>
                    <td>{v.driver_name || '—'}</td>
                    <td><VehicleBadge status={v.status} /></td>
                    <td className="text-mono">{v.trips}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 2, height: 6 }}>
                          <div style={{ width: `${Math.min(100, v.trips * 15)}%`, background: 'var(--blue)', height: '100%', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>{v.trips}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function StatusBadge({ status }) {
  const map = { Pending: 'created', Accepted: 'dispatched', Dispatched: 'dispatched', 'In Transit': 'in-transit', Delivered: 'delivered', Returned: 'returned' };
  return <span className={`badge badge-${map[status] || 'created'}`}>{status}</span>;
}

function VehicleBadge({ status }) {
  const map = { Available: 'available', 'On Trip': 'on-trip', Maintenance: 'maintenance' };
  return <span className={`badge badge-${map[status] || 'available'}`}>{status}</span>;
}
