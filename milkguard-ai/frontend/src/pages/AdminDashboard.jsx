import React, { useState, useEffect } from 'react';
import VolumeChart from '../components/VolumeChart';
import { getDashboardSummary, getCollectionTrends, getRecentBatches, getLiveLocations } from '../api';
// Exact backend thresholds:
// pH: 6.5 - 6.8
// Fat: >= 3.2
// SNF: >= 8.3
function chemFlag(ph, fat, snf) {
  const isPure = ph >= 6.5 && ph <= 6.8 && fat >= 3.2 && snf >= 8.3;
  return isPure ? 'pure' : 'alert';
}

function FlagPill({ flag }) {
  return flag === 'pure'
    ? <span className="flag-pill pure"><span className="dot"></span>Pure</span>
    : <span className="flag-pill alert"><span className="dot"></span>Flagged</span>;
}

export default function AdminDashboard({ user }) {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [batches, setBatches] = useState([]);
  const [locations, setLocations] = useState([]);

    useEffect(() => {
    async function loadData() {
      try {
        const sumData = await getDashboardSummary();
        setSummary(sumData);
        
        const trendsData = await getCollectionTrends(7);
        setTrends(trendsData);
        
        const batchesData = await getRecentBatches(10);
        setBatches(batchesData);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      }
    }
    loadData();
    const intervalId = setInterval(loadData, 15000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    async function fetchLocs() {
      try {
        const locs = await getLiveLocations();
        setLocations(locs);
      } catch (err) {
        console.error("Failed to load live locations", err);
      }
    }
    fetchLocs();
    const intervalId = setInterval(fetchLocs, 30000); // Poll every 30 seconds
    return () => clearInterval(intervalId);
  }, []);

  if (!summary) return <div style={{padding: '20px'}}>Loading dashboard...</div>;

  const stats = [
    ['Total Users', summary.total_users, summary.total_users_delta > 0 ? 'up' : ''],
    ['Active Batches', summary.active_batches, ''],
    ['Shipments in Transit', summary.shipments_in_transit, ''],
    ['Fraud Alerts', summary.fraud_alerts_count, summary.fraud_alerts_count > 0 ? 'warn' : ''],
  ];

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>Admin Command Center</h1>
          <div className="sub">Live overview of all network activity and flags.</div>
        </div>
        <div className="user-chip">
          <div className="avatar">A</div>
          <div><div className="name">Admin</div><div className="role">Platform Admin</div></div>
        </div>
      </div>
      
      <div className="stats-row">
        {stats.map(([lbl, val, delta], i) => (
          <div key={i} className="stat-card">
            <div className="lbl">{lbl}</div>
            <div className="val">{val}</div>
            {delta && <div className={`delta ${delta}`}>{
              delta === 'warn' ? 'Requires Attention' : 
              delta === 'up' ? 'Growing network' : 'On track'
            }</div>}
          </div>
        ))}
      </div>
      
      <div className="grid-2">
        <div className="panel">
          <h3>Collection Volume Trend (7 Days)</h3>
          <div className="sub">System-wide daily milk volume collected (Liters)</div>
          <div className="chart-wrap" style={{height:'200px'}}>
             <VolumeChart 
                values={trends.map(t => t.volume)} 
                labels={trends.map(t => {
                   const d = new Date(t.date);
                   return `${d.getMonth()+1}/${d.getDate()}`;
                })} 
             />
          </div>
        </div>
        
        <div className="panel">
          <h3>Live Operations Map</h3>
          <div className="sub">Active collection centers and factories (Updates every 30s)</div>
          <div style={{ height: '220px', width: '100%', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B1220', border: '1px dashed var(--line)' }}>
             [Live Map temporarily disabled for preview]
          </div>
        </div>
      </div>

      <div className="panel" style={{marginTop: '20px'}}>
        <h3>Recent Batches</h3>
        <div className="sub">Latest processed batches across the network</div>
        <table>
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Date</th>
              <th>Volume (L)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {batches.map(b => (
              <tr key={b.id}>
                <td>{b.id.substring(0, 8)}...</td>
                <td>{new Date(b.timestamp).toLocaleDateString()}</td>
                <td>{b.volume_liters.toFixed(1)}</td>
                <td>
                  <span className={`flag-pill ${b.status === 'processed' ? 'pure' : 'alert'}`}>
                    <span className="dot"></span>{b.status}
                  </span>
                </td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr><td colSpan="4" style={{textAlign: 'center', padding: '20px'}}>No recent batches</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
