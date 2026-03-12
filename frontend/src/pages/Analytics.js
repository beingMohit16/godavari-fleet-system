import React, { useEffect, useState } from 'react';
import { getDashboard, getAnalytics, downloadAnalyticsReport } from '../utils/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, AreaChart, Area
} from 'recharts';

const COLORS = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#f97316'];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    Promise.all([getDashboard(), getAnalytics(period)]).then(([d, a]) => {
      setData(d.data);
      setAnalytics(a.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) getAnalytics(period).then(r => setAnalytics(r.data));
  }, [period]);

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const handleDownload = async () => {
    setDownloading(true);
    try { await downloadAnalyticsReport(); } catch(e) { alert('Download failed'); }
    setDownloading(false);
  };

  if (loading) return <div className="loading"><div className="spinner" /> Loading analytics...</div>;
  if (!data) return <div className="loading">Failed to load analytics</div>;

  const routeProfitability = (data.routeStats || []).map(r => ({
    ...r,
    profit: r.revenue - r.expenses,
    margin: r.revenue > 0 ? Math.round((r.revenue - r.expenses) / r.revenue * 100) : 0
  })).sort((a, b) => b.profit - a.profit);

  const bestRoute = routeProfitability[0];
  const bestCargo = (data.cargoStats || [])[0];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">REPORTS / ANALYTICS</div>
          <h2>Performance Analytics</h2>
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button className="btn btn-secondary btn-sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Downloading...' : 'Download Excel Report'}
          </button>
        </div>
      </div>
      <div className="page-body">
        {/* Highlights */}
        <div className="stat-grid mb-6">
          <div className="stat-card green">
            <div className="stat-label">Most Profitable Route</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: 'var(--text)' }}>{bestRoute?.route || '--'}</div>
            <div className="stat-sub">{bestRoute ? fmt(bestRoute.profit) + ' profit' : ''}</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-label">Top Cargo Type</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: 'var(--text)' }}>{bestCargo?.cargo_type || '--'}</div>
            <div className="stat-sub">{bestCargo?.count} trips</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-label">Revenue / Trip</div>
            <div className="stat-value amber" style={{ fontSize: 20 }}>
              {data.totalTrips ? fmt(data.totalRevenue / data.totalTrips) : '--'}
            </div>
          </div>
          <div className="stat-card purple">
            <div className="stat-label">Expense / Trip</div>
            <div className="stat-value" style={{ fontSize: 20, color: 'var(--purple)' }}>
              {data.totalTrips ? fmt(data.totalExpenses / data.totalTrips) : '--'}
            </div>
          </div>
        </div>

        {/* Period selector */}
        <div className="card mb-4" style={{padding:'12px 16px', display:'flex', alignItems:'center', gap:12}}>
          <span style={{fontSize:11, fontFamily:'var(--font-mono)', color:'var(--text3)', textTransform:'uppercase'}}>Time Period:</span>
          {['daily','weekly','monthly'].map(p => (
            <button key={p} className={`btn btn-sm ${period===p?'btn-primary':'btn-secondary'}`} onClick={()=>setPeriod(p)}>
              {p.charAt(0).toUpperCase()+p.slice(1)}
            </button>
          ))}
        </div>

        {/* Trend charts */}
        <div className="grid-2 mb-6">
          <div className="card">
            <div className="card-title mb-4">Trip Volume ({period})</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={analytics?.tripTrends || []}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="period" tick={{fontSize:10}} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="trips" stroke="#3b82f6" fill="rgba(59,130,246,0.15)" name="Trips" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="card-title mb-4">Revenue vs Expenses ({period})</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={(analytics?.revenueTrends || []).map((r, i) => ({
                period: r.period,
                revenue: r.revenue,
                expenses: (analytics?.expenseTrends || [])[i]?.total_expenses || 0
              }))}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="period" tick={{fontSize:10}} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Route Revenue vs Expense comparison */}
        <div className="card mb-6">
          <div className="card-header">
            <div className="card-title">Route Revenue vs Expenses</div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.routeStats || []} barCategoryGap="25%">
              <CartesianGrid vertical={false} />
              <XAxis dataKey="route" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Profitability table */}
        <div className="card mb-6">
          <div className="card-header">
            <div className="card-title">Route Profitability Ranking</div>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>Revenue - Expenses per route</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Route</th>
                <th>Trips</th>
                <th>Revenue</th>
                <th>Expenses</th>
                <th>Net Profit</th>
                <th>Margin %</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {routeProfitability.map((r, i) => (
                <tr key={r.route}>
                  <td className="text-mono" style={{ color: i === 0 ? 'var(--accent)' : 'var(--text3)', fontWeight: i === 0 ? 700 : 400 }}>
                    {i === 0 ? '#1' : `#${i+1}`}
                  </td>
                  <td style={{ color: 'var(--text)', fontWeight: 600 }}>{r.route}</td>
                  <td className="text-mono">{r.trip_count}</td>
                  <td className="text-mono text-green">{fmt(r.revenue)}</td>
                  <td className="text-mono text-red">{fmt(r.expenses)}</td>
                  <td className={`text-mono font-bold ${r.profit >= 0 ? 'text-green' : 'text-red'}`}>{fmt(r.profit)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 3 }}>
                        <div style={{ width: `${Math.min(100, Math.max(0, r.margin))}%`, height: '100%', background: r.margin >= 50 ? 'var(--green)' : r.margin >= 20 ? 'var(--accent)' : 'var(--red)', borderRadius: 3 }} />
                      </div>
                      <span className="text-mono" style={{ fontSize: 11, color: r.margin >= 50 ? 'var(--green)' : r.margin >= 20 ? 'var(--accent)' : 'var(--red)', minWidth: 36 }}>{r.margin}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${r.margin >= 50 ? 'badge-delivered' : r.margin >= 20 ? 'badge-dispatched' : 'badge-maintenance'}`}>
                      {r.margin >= 50 ? 'Excellent' : r.margin >= 20 ? 'Good' : 'Poor'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom charts */}
        <div className="grid-2">
          <div className="card">
            <div className="card-title mb-4">Cargo Type Distribution</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.cargoStats || []} dataKey="count" nameKey="cargo_type" cx="50%" cy="50%"
                  outerRadius={90} label={({ cargo_type, count }) => `${cargo_type.split(' ')[0]}: ${count}`}
                >
                  {(data.cargoStats || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-title mb-4">Vehicle Utilization</div>
            {(data.vehicleUtil || []).length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Vehicle</th><th>Driver</th><th>Trips</th><th>Utilization</th></tr></thead>
                <tbody>
                  {data.vehicleUtil.map(v => (
                    <tr key={v.registration}>
                      <td className="text-mono" style={{ color: 'var(--accent)', fontSize: 11 }}>{v.registration}</td>
                      <td style={{ fontSize: 12 }}>{v.driver_name || '--'}</td>
                      <td className="text-mono">{v.trips}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 3 }}>
                            <div style={{ width: `${Math.min(100, v.trips * 12)}%`, height: '100%', background: 'var(--blue)', borderRadius: 3 }} />
                          </div>
                          <span className="text-mono text-blue" style={{ fontSize: 11 }}>{v.trips}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="empty-state"><p>No vehicle data</p></div>}
          </div>
        </div>

        {/* Trip status overview */}
        <div className="card mt-6">
          <div className="card-title mb-4">Trip Status Overview</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.tripsByStatus || []} barCategoryGap="40%">
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {(data.tripsByStatus || []).map((entry, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
