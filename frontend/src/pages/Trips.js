import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTrips, createTrip, updateTripStatus, getVehicles } from '../utils/api';

const CARGO_TYPES = ['Medical Supplies', 'Food Grains', 'Construction Material', 'Electronics', 'Textiles', 'Machinery', 'Other'];
const STATUSES = ['Created', 'Dispatched', 'In Transit', 'Delivered', 'Returned'];

const ROUTES = [
  { from: 'Mumbai', to: 'Pune', distance: 148, plat: 19.076, plng: 72.877, dlat: 18.520, dlng: 73.856 },
  { from: 'Delhi', to: 'Agra', distance: 206, plat: 28.613, plng: 77.209, dlat: 27.176, dlng: 78.008 },
  { from: 'Bangalore', to: 'Chennai', distance: 346, plat: 12.971, plng: 77.594, dlat: 13.083, dlng: 80.270 },
  { from: 'Ahmedabad', to: 'Surat', distance: 265, plat: 23.022, plng: 72.571, dlat: 21.170, dlng: 72.831 },
  { from: 'Jaipur', to: 'Jodhpur', distance: 330, plat: 26.912, plng: 75.787, dlat: 26.295, dlng: 73.017 },
  { from: 'Hyderabad', to: 'Vijayawada', distance: 275, plat: 17.385, plng: 78.486, dlat: 16.506, dlng: 80.648 },
  { from: 'Kolkata', to: 'Bhubaneswar', distance: 480, plat: 22.572, plng: 88.363, dlat: 20.296, dlng: 85.824 },
  { from: 'Lucknow', to: 'Kanpur', distance: 84, plat: 26.846, plng: 80.946, dlat: 26.449, dlng: 80.331 },
];

function StatusBadge({ status }) {
  const map = { Created: 'created', Dispatched: 'dispatched', 'In Transit': 'in-transit', Delivered: 'delivered', Returned: 'returned' };
  return <span className={`badge badge-${map[status] || 'created'}`}>{status}</span>;
}

const EMPTY_FORM = { vehicle_id: '', driver: '', cargo_type: 'Medical Supplies', pickup: '', destination: '', distance: '', pickup_lat: '', pickup_lng: '', dest_lat: '', dest_lng: '' };

export default function Trips() {
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('All');
  const navigate = useNavigate();

  const load = () => Promise.all([getTrips(), getVehicles()]).then(([t, v]) => {
    setTrips(t.data); setVehicles(v.data); setLoading(false);
  });

  useEffect(() => { load(); }, []);

  const handleRouteSelect = (e) => {
    const r = ROUTES[parseInt(e.target.value)];
    if (r) setForm({ ...form, pickup: r.from, destination: r.to, distance: r.distance, pickup_lat: r.plat, pickup_lng: r.plng, dest_lat: r.dlat, dest_lng: r.dlng });
  };

  const handleVehicleSelect = (e) => {
    const v = vehicles.find(v => v.id === e.target.value);
    setForm({ ...form, vehicle_id: e.target.value, driver: v ? v.driver_name : '' });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await createTrip(form);
      await load();
      setShowAdd(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
    setSaving(false);
  };

  const handleStatusChange = async (id, status) => {
    await updateTripStatus(id, status);
    await load();
  };

  const filtered = filter === 'All' ? trips : trips.filter(t => t.status === filter);

  if (loading) return <div className="loading"><div className="spinner" /> Loading trips...</div>;

  const available = vehicles.filter(v => v.status === 'Available');

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">FLEET / TRIPS</div>
          <h2>Trip Management</h2>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New Trip</button>
      </div>
      <div className="page-body">
        <div className="tabs">
          {['All', ...STATUSES].map(s => (
            <button key={s} className={`tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
              {s} {s !== 'All' && <span style={{ color: 'var(--text3)' }}>({trips.filter(t => t.status === s).length})</span>}
            </button>
          ))}
        </div>

        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Trip ID</th>
                <th>Route</th>
                <th>Driver</th>
                <th>Cargo</th>
                <th>Distance</th>
                <th>Vehicle</th>
                <th>Status</th>
                <th>Update Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td className="text-mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{t.id.slice(0,8)}…</td>
                  <td style={{ color: 'var(--text)' }}>{t.pickup} → {t.destination}</td>
                  <td>{t.driver}</td>
                  <td><span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--blue2)' }}>{t.cargo_type}</span></td>
                  <td className="text-mono">{t.distance} km</td>
                  <td className="text-mono" style={{ color: 'var(--accent)', fontSize: 11 }}>{t.registration || '—'}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>
                    <select
                      className="form-select"
                      style={{ padding: '4px 8px', width: 130 }}
                      value={t.status}
                      onChange={e => handleStatusChange(t.id, e.target.value)}
                    >
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/trips/${t.id}`)}>Details</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9}><div className="empty-state"><div className="empty-icon">⟶</div><p>No trips found</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <span className="modal-title">Create New Trip</span>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group mb-4">
                <label className="form-label">Quick Route Select</label>
                <select className="form-select" onChange={handleRouteSelect} defaultValue="">
                  <option value="">-- Select predefined route --</option>
                  {ROUTES.map((r, i) => (
                    <option key={i} value={i}>{r.from} → {r.to} ({r.distance} km)</option>
                  ))}
                </select>
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Assign Vehicle</label>
                  <select className="form-select" value={form.vehicle_id} onChange={handleVehicleSelect}>
                    <option value="">-- Select vehicle --</option>
                    {available.map(v => <option key={v.id} value={v.id}>{v.registration} ({v.type})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Driver Name *</label>
                  <input className="form-input" value={form.driver} onChange={e => setForm({ ...form, driver: e.target.value })} placeholder="Driver name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Pickup Location *</label>
                  <input className="form-input" value={form.pickup} onChange={e => setForm({ ...form, pickup: e.target.value })} placeholder="City/Location" />
                </div>
                <div className="form-group">
                  <label className="form-label">Destination *</label>
                  <input className="form-input" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder="City/Location" />
                </div>
                <div className="form-group">
                  <label className="form-label">Cargo Type *</label>
                  <select className="form-select" value={form.cargo_type} onChange={e => setForm({ ...form, cargo_type: e.target.value })}>
                    {CARGO_TYPES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Distance (km) *</label>
                  <input className="form-input" type="number" value={form.distance} onChange={e => setForm({ ...form, distance: e.target.value })} placeholder="e.g. 250" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Creating...' : 'Create Trip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
