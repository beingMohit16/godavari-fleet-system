import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getVehicleLocations, updateGPS } from '../utils/api';

// Fix leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createVehicleIcon(status) {
  const colors = {
    'Available': '#10b981',
    'On Trip': '#f59e0b',
    'Maintenance': '#ef4444'
  };
  const color = colors[status] || '#64748b';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;
      background:${color};
      border:3px solid rgba(255,255,255,0.9);
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
    "><div style="
      width:10px;height:10px;
      background:rgba(255,255,255,0.9);
      border-radius:50%;
      position:absolute;
      top:50%;left:50%;
      transform:translate(-50%,-50%) rotate(45deg);
    "></div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34]
  });
}

function MapController({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, 6); }, [center, map]);
  return null;
}

export default function MapView() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simRunning, setSimRunning] = useState(false);
  const [selected, setSelected] = useState(null);
  const simRef = useRef(null);

  const load = () => getVehicleLocations().then(r => { setVehicles(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  // GPS simulation: move "On Trip" vehicles toward destination
  const runSim = () => {
    simRef.current = setInterval(async () => {
      const res = await getVehicleLocations();
      const updated = res.data;
      for (const v of updated) {
        if (v.trip_status === 'In Transit' && v.dest_lat && v.dest_lng) {
          const speed = 0.008 + Math.random() * 0.005;
          const dlat = v.dest_lat - v.lat;
          const dlng = v.dest_lng - v.lng;
          const dist = Math.sqrt(dlat * dlat + dlng * dlng);
          if (dist > 0.05) {
            const newLat = v.lat + (dlat / dist) * speed;
            const newLng = v.lng + (dlng / dist) * speed;
            await updateGPS(v.id, newLat, newLng);
          }
        } else if (!v.trip_status) {
          // Idle drift
          const newLat = v.lat + (Math.random() - 0.5) * 0.002;
          const newLng = v.lng + (Math.random() - 0.5) * 0.002;
          await updateGPS(v.id, newLat, newLng);
        }
      }
      setVehicles(updated);
    }, 3000);
  };

  const toggleSim = () => {
    if (simRunning) {
      clearInterval(simRef.current);
      setSimRunning(false);
    } else {
      runSim();
      setSimRunning(true);
    }
  };

  useEffect(() => () => clearInterval(simRef.current), []);

  const statusCounts = {
    Available: vehicles.filter(v => v.status === 'Available').length,
    'On Trip': vehicles.filter(v => v.status === 'On Trip').length,
    Maintenance: vehicles.filter(v => v.status === 'Maintenance').length,
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">OVERVIEW / LIVE MAP</div>
          <h2>Vehicle Tracking</h2>
        </div>
        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
            GPS SIM:
          </span>
          <button
            className={`btn ${simRunning ? 'btn-danger' : 'btn-primary'}`}
            onClick={toggleSim}
          >
            {simRunning ? '⏹ Stop Simulation' : '▶ Start GPS Sim'}
          </button>
          {simRunning && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>
              <span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
              LIVE
            </span>
          )}
        </div>
      </div>
      <div className="page-body">
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
          <div className="stat-card green"><div className="stat-label">Available</div><div className="stat-value green">{statusCounts['Available']}</div></div>
          <div className="stat-card amber"><div className="stat-label">On Trip</div><div className="stat-value amber">{statusCounts['On Trip']}</div></div>
          <div className="stat-card red"><div className="stat-label">Maintenance</div><div className="stat-value red">{statusCounts['Maintenance']}</div></div>
        </div>

        <div className="grid-2" style={{ gridTemplateColumns: '300px 1fr', alignItems: 'start' }}>
          {/* Vehicle list */}
          <div className="card" style={{ maxHeight: 500, overflowY: 'auto' }}>
            <div className="card-title mb-3">Fleet ({vehicles.length})</div>
            {vehicles.map(v => (
              <div
                key={v.id}
                onClick={() => setSelected(selected?.id === v.id ? null : v)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: selected?.id === v.id ? 'rgba(245,158,11,0.1)' : 'transparent',
                  border: `1px solid ${selected?.id === v.id ? 'var(--accent)' : 'transparent'}`,
                  marginBottom: 4,
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{v.registration}</span>
                  <span className={`badge badge-${v.status === 'Available' ? 'available' : v.status === 'On Trip' ? 'on-trip' : 'maintenance'}`} style={{ fontSize: 9 }}>{v.status}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{v.driver_name}</div>
                {v.trip_status && (
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                    → {v.destination} [{v.trip_status}]
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {v.lat?.toFixed(4)}, {v.lng?.toFixed(4)}
                </div>
              </div>
            ))}
          </div>

          {/* Map */}
          <div className="map-container" style={{ height: 500 }}>
            {!loading && (
              <MapContainer
                center={[20.5937, 78.9629]}
                zoom={5}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                {selected && <MapController center={[selected.lat, selected.lng]} />}
                {vehicles.map(v => v.lat && v.lng && (
                  <React.Fragment key={v.id}>
                    <Marker
                      position={[v.lat, v.lng]}
                      icon={createVehicleIcon(v.status)}
                      eventHandlers={{ click: () => setSelected(v) }}
                    >
                      <Popup>
                        <div style={{ fontFamily: 'var(--font-sans)', minWidth: 160 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{v.registration}</div>
                          <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>Driver: {v.driver_name}</div>
                          <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>Type: {v.type}</div>
                          {v.destination && <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>→ {v.destination}</div>}
                          <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, marginTop: 4,
                            background: v.status === 'Available' ? '#d1fae5' : v.status === 'On Trip' ? '#fef3c7' : '#fee2e2',
                            color: v.status === 'Available' ? '#065f46' : v.status === 'On Trip' ? '#92400e' : '#991b1b'
                          }}>
                            {v.status}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                    {v.trip_status === 'In Transit' && v.pickup_lat && v.dest_lat && (
                      <Polyline
                        positions={[[v.pickup_lat, v.pickup_lng], [v.lat, v.lng], [v.dest_lat, v.dest_lng]]}
                        color="#f59e0b"
                        weight={2}
                        dashArray="6,6"
                        opacity={0.6}
                      />
                    )}
                  </React.Fragment>
                ))}
              </MapContainer>
            )}
          </div>
        </div>

        <div className="card mt-6">
          <div className="card-title mb-2">Map Legend</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[['#10b981', 'Available'], ['#f59e0b', 'On Trip'], ['#ef4444', 'Maintenance']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>{l}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 20, height: 2, background: '#f59e0b', borderTop: '2px dashed #f59e0b' }} />
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>Active Route</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
