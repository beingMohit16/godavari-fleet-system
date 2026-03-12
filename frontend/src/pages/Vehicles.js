import React, { useEffect, useState } from 'react';
import { getVehicles, createVehicle, updateVehicle } from '../utils/api';

const VEHICLE_TYPES = ['Truck', 'Mini Van', 'Heavy Truck', 'Pickup', 'Container', 'Bus'];
const STATUSES = ['Available', 'On Trip', 'Maintenance'];

function VehicleBadge({ status }) {
  const map = { Available: 'available', 'On Trip': 'on-trip', Maintenance: 'maintenance' };
  return <span className={`badge badge-${map[status] || 'available'}`}>{status}</span>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const EMPTY_FORM = { registration: '', type: 'Truck', capacity: '', driver_name: '', status: 'Available' };

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = () => getVehicles().then(r => { setVehicles(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const filtered = vehicles.filter(v =>
    v.registration.toLowerCase().includes(search.toLowerCase()) ||
    v.driver_name.toLowerCase().includes(search.toLowerCase()) ||
    v.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editVehicle) {
        await updateVehicle(editVehicle.id, form);
      } else {
        await createVehicle(form);
      }
      await load();
      setShowAdd(false);
      setEditVehicle(null);
      setForm(EMPTY_FORM);
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
    setSaving(false);
  };

  const openEdit = (v) => {
    setEditVehicle(v);
    setForm({ registration: v.registration, type: v.type, capacity: v.capacity, driver_name: v.driver_name, status: v.status });
  };

  const stats = {
    available: vehicles.filter(v => v.status === 'Available').length,
    onTrip: vehicles.filter(v => v.status === 'On Trip').length,
    maintenance: vehicles.filter(v => v.status === 'Maintenance').length,
  };

  if (loading) return <div className="loading"><div className="spinner" /> Loading vehicles...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">FLEET / VEHICLES</div>
          <h2>Vehicle Management</h2>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setEditVehicle(null); setShowAdd(true); }}>
          + Add Vehicle
        </button>
      </div>
      <div className="page-body">
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card blue">
            <div className="stat-label">Total Fleet</div>
            <div className="stat-value">{vehicles.length}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">Available</div>
            <div className="stat-value green">{stats.available}</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-label">On Trip</div>
            <div className="stat-value amber">{stats.onTrip}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Maintenance</div>
            <div className="stat-value red">{stats.maintenance}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Fleet Registry</div>
            <input
              className="form-input"
              style={{ width: 240 }}
              placeholder="Search vehicles..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Type</th>
                <th>Capacity (T)</th>
                <th>Driver</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id}>
                  <td className="text-mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>{v.registration}</td>
                  <td>{v.type}</td>
                  <td className="text-mono">{v.capacity}T</td>
                  <td>{v.driver_name}</td>
                  <td><VehicleBadge status={v.status} /></td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(v)}>Edit</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">▣</div><p>No vehicles found</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showAdd || editVehicle) && (
        <Modal title={editVehicle ? 'Edit Vehicle' : 'Add New Vehicle'} onClose={() => { setShowAdd(false); setEditVehicle(null); }}>
          <div className="modal-body">
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label">Registration Number *</label>
                <input className="form-input" placeholder="e.g. MH-12-AB-1234" value={form.registration} onChange={e => setForm({ ...form, registration: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Type *</label>
                <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Capacity (Tonnes) *</label>
                <input className="form-input" type="number" placeholder="e.g. 15" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Driver Name *</label>
                <input className="form-input" placeholder="Full name" value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { setShowAdd(false); setEditVehicle(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editVehicle ? 'Update Vehicle' : 'Add Vehicle'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
