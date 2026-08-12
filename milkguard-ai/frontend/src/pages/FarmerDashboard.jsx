import React, { useState, useEffect } from 'react';
import { getRecentBatches, getChain, getUsers, submitCollectionEvent } from '../api';
import VolumeChart from '../components/VolumeChart';

function FlagPill({ isSafe }) {
  return isSafe
    ? <span className="flag-pill pure"><span className="dot"></span>Pure</span>
    : <span className="flag-pill alert"><span className="dot"></span>Flagged</span>;
}

export default function FarmerDashboard({ user }) {
  const [rows, setRows] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [centerId, setCenterId] = useState('');
  const [volume, setVolume] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitResult, setSubmitResult] = useState(null);

  const fetchData = async () => {
    try {
      const batches = await getRecentBatches(7);
      
      // Fetch chain for each to get quality/flag status
      const enriched = await Promise.all(batches.map(async (b) => {
        try {
          const chain = await getChain(b.id);
          const farmerStage = chain.stages.find(s => s.role === 'farmer');
          // check if there's any parameter
          const isSafe = chain.overall_status === 'safe';
          return {
            date: b.collection_date || b.timestamp.split('T')[0],
            volume: b.volume_liters,
            isSafe: isSafe,
            id: b.id
          };
        } catch (e) {
          return {
            date: b.collection_date || b.timestamp.split('T')[0],
            volume: b.volume_liters,
            isSafe: true, // fallback
            id: b.id
          };
        }
      }));
      setRows(enriched);
      
      const ctrs = await getUsers('middleman');
      setCenters(ctrs);
      if (ctrs.length > 0 && !centerId) {
        setCenterId(ctrs[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitResult(null);
    try {
      const res = await submitCollectionEvent({
        farmer_id: user.id,
        center_id: parseInt(centerId),
        volume_liters: parseFloat(volume),
        collection_date: date
      });
      setSubmitResult({ success: true, batchId: res.batch_id });
      setVolume('');
      fetchData(); // refresh immediately
    } catch (err) {
      setSubmitResult({ success: false, message: err.message });
    }
  };

  if (loading && rows.length === 0) return <div style={{padding:'20px'}}>Loading...</div>;

  const totalDeliveries = rows.length;
  const avgVolume = totalDeliveries > 0 ? (rows.reduce((a,r)=>a+r.volume,0)/totalDeliveries).toFixed(1) : 0;
  const lastResult = totalDeliveries > 0 ? (rows[0].isSafe ? 'Pure' : 'Flagged') : '—';
  const activeAlerts = rows.filter(r => !r.isSafe).length;

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>Farmer Dashboard</h1>
          <div className="sub">Track your deliveries and test results.</div>
        </div>
        <div className="user-chip">
          <div className="avatar">{user.name ? user.name.charAt(0) : 'F'}</div>
          <div>
            <div className="name">{user.name || `Farmer #${user.id}`}</div>
            <div className="role">Farmer</div>
          </div>
        </div>
      </div>
      
      <div className="stats-row">
        <div className="stat-card">
          <div className="lbl">Total Deliveries</div>
          <div className="val">{totalDeliveries}</div>
        </div>
        <div className="stat-card">
          <div className="lbl">Avg. Volume</div>
          <div className="val">{avgVolume} L</div>
        </div>
        <div className="stat-card">
          <div className="lbl">Last Result</div>
          <div className="val">{lastResult}</div>
        </div>
        <div className="stat-card">
          <div className="lbl">Active Alerts</div>
          <div className="val">{activeAlerts}</div>
          {activeAlerts > 0 && <div className="delta warn">Needs review</div>}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Add Collection Entry</h3>
          <div className="sub">Record new milk collection</div>
          <form onSubmit={handleSubmit} style={{marginTop: '15px'}}>
            <div style={{marginBottom: '10px'}}>
              <label style={{display:'block', marginBottom:'5px', color:'#94a3b8', fontSize:'12px'}}>Destination Center</label>
              <select value={centerId} onChange={e => setCenterId(e.target.value)} required style={{width: '100%', padding: '8px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px'}}>
                {centers.map(c => <option key={c.id} value={c.id}>{c.name || `Center #${c.id}`}</option>)}
              </select>
            </div>
            <div style={{marginBottom: '10px'}}>
              <label style={{display:'block', marginBottom:'5px', color:'#94a3b8', fontSize:'12px'}}>Volume (Liters)</label>
              <input type="number" step="0.1" value={volume} onChange={e => setVolume(e.target.value)} required style={{width: '100%', padding: '8px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px'}} />
            </div>
            <div style={{marginBottom: '15px'}}>
              <label style={{display:'block', marginBottom:'5px', color:'#94a3b8', fontSize:'12px'}}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{width: '100%', padding: '8px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px'}} />
            </div>
            <button type="submit" style={{width: '100%', padding: '10px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}>Submit Entry</button>
          </form>
          
          {submitResult && (
            <div style={{marginTop: '15px', padding: '10px', borderRadius: '4px', background: submitResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: submitResult.success ? '#10B981' : '#EF4444', fontSize: '13px'}}>
              {submitResult.success ? (
                <><strong>Success!</strong><br/>Batch ID: <code style={{userSelect:'all'}}>{submitResult.batchId}</code></>
              ) : (
                <><strong>Error:</strong> {submitResult.message}</>
              )}
            </div>
          )}
        </div>

        <div style={{display:'flex', flexDirection:'column', gap: '20px'}}>
          <div className="panel">
            <h3>Volume Trend</h3>
            <div className="sub">Recent activity</div>
            <div className="chart-wrap" style={{height:'200px'}}>
               <VolumeChart values={rows.slice().reverse().map(r=>r.volume)} labels={rows.slice().reverse().map(r=>r.date.slice(5))} />
            </div>
          </div>
          
          <div className="panel">
            <h3>Recent Entries</h3>
            <div className="sub">Latest records</div>
            <div className="side-list">
              {rows.slice(0, 5).map((r, i) => (
                <div key={i} className="side-row" style={{display:'flex', justifyContent:'space-between'}}>
                  <span className="id">{r.date} ({r.volume}L)</span>
                  <span className="meta"><FlagPill isSafe={r.isSafe} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
