import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, ShieldAlert, Search, MapPin, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchWithAuth } from '../api';

// Fix Leaflet's default icon path issues
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function ConsumerDashboard({ user }) {
  const navigate = useNavigate();
  const [uuid, setUuid] = useState('');
  const [chainData, setChainData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Example coordinates fallback if DB is missing them
  const fallbackCoords = {
    farmer: [28.6139, 77.2090], // Delhi
    middleman: [28.4595, 77.0266], // Gurgaon
    manufacturer: [28.3949, 77.3114], // Faridabad
    unknown: [28.5355, 77.3910] // Noida
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!uuid.trim()) return;

    setLoading(true);
    setError('');
    setChainData(null);

    try {
      const data = await fetchWithAuth(`/chain/${uuid.trim()}`);
      if (data.error) {
        setError(data.error);
      } else {
        setChainData(data);
      }
    } catch (err) {
      setError('Failed to fetch traceability data. Please verify the UUID.');
    } finally {
      setLoading(false);
    }
  };

  const mapCenter = chainData && chainData.stages.length > 0 
    ? [chainData.stages[0].latitude || fallbackCoords[chainData.stages[0].role][0], chainData.stages[0].longitude || fallbackCoords[chainData.stages[0].role][1]] 
    : [28.6139, 77.2090]; // Default Delhi

  const polylinePositions = chainData ? chainData.stages.map(s => [
    s.latitude || fallbackCoords[s.role]?.[0] || fallbackCoords['unknown'][0],
    s.longitude || fallbackCoords[s.role]?.[1] || fallbackCoords['unknown'][1]
  ]) : [];

  return (
    <div className="dashboard" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '28px', color: '#f8fafc' }}>Consumer Dashboard</h2>
          <p className="text-secondary" style={{ margin: '5px 0 0 0' }}>Verify the safety and origin of your milk.</p>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={() => navigate('/scan')} style={{ padding: '8px 16px', background: '#334155', border: 'none', borderRadius: '6px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#475569'} onMouseOut={e => e.currentTarget.style.background = '#334155'}>
            <QrCode size={18} /> Scan QR
          </button>
          <button onClick={() => navigate('/quick-check')} style={{ padding: '8px 16px', background: '#2563EB', border: 'none', borderRadius: '6px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#3B82F6'} onMouseOut={e => e.currentTarget.style.background = '#2563EB'}>
            <ShieldAlert size={18} /> Manual Check
          </button>
        </div>
      </div>
      
      <div className="panel" style={{ marginBottom: '30px', background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid #334155' }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={20} className="text-brand" /> Trace Milk Batch
        </h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="Enter Batch UUID (e.g., 0ba3eee6-...)" 
            value={uuid} 
            onChange={(e) => setUuid(e.target.value)} 
            style={{ flex: 1, padding: '12px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '6px', fontSize: '15px' }}
          />
          <button type="submit" disabled={loading} style={{ padding: '0 24px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {loading ? 'Searching...' : 'Trace'}
          </button>
        </form>
        {error && <div style={{ marginTop: '15px', color: '#EF4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '4px' }}>{error}</div>}
      </div>

      {chainData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
          {/* Map Column */}
          <div className="panel" style={{ height: '500px', padding: 0, overflow: 'hidden', border: '1px solid #334155' }}>
            <MapContainer center={mapCenter} zoom={10} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {chainData.stages.map((stage, index) => {
                const lat = stage.latitude || fallbackCoords[stage.role]?.[0] || fallbackCoords['unknown'][0];
                const lng = stage.longitude || fallbackCoords[stage.role]?.[1] || fallbackCoords['unknown'][1];
                return (
                  <Marker key={index} position={[lat, lng]}>
                    <Popup>
                      <strong>{stage.entity_name}</strong> ({stage.role})<br/>
                      Date: {new Date(stage.timestamp).toLocaleDateString()}
                    </Popup>
                  </Marker>
                );
              })}
              <Polyline positions={polylinePositions} color="#2563EB" weight={3} dashArray="5, 10" />
            </MapContainer>
          </div>

          {/* Timeline Column */}
          <div className="panel" style={{ maxHeight: '500px', overflowY: 'auto', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid #334155' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={20} className="text-brand" /> Traceability Journey
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {chainData.stages.map((stage, index) => (
                <div key={index} style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: stage.is_flagged ? '#EF4444' : '#10B981', zIndex: 2 }}></div>
                    {index < chainData.stages.length - 1 && <div style={{ width: '2px', flex: 1, background: '#334155', margin: '4px 0' }}></div>}
                  </div>
                  <div style={{ flex: 1, paddingBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '16px' }}>{stage.entity_name}</h4>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(stage.timestamp).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '8px', textTransform: 'capitalize' }}>Role: {stage.role} • Volume: {stage.volume_liters}L</div>
                    
                    {stage.is_flagged ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#EF4444', fontSize: '13px', background: 'rgba(239, 68, 68, 0.1)', padding: '5px 10px', borderRadius: '4px', display: 'inline-flex' }}>
                        <AlertTriangle size={14} /> Suspicious Activity Detected
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10B981', fontSize: '13px', background: 'rgba(16, 185, 129, 0.1)', padding: '5px 10px', borderRadius: '4px', display: 'inline-flex' }}>
                        <CheckCircle size={14} /> Quality Normal
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {chainData.violations && chainData.violations.length > 0 && (
              <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #EF4444', borderRadius: '4px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#EF4444' }}>Violations Found</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#f8fafc', fontSize: '13px' }}>
                  {chainData.violations.map((v, i) => <li key={i} style={{ marginBottom: '5px' }}>{v}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
