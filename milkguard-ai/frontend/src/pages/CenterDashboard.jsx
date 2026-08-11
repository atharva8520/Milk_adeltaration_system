import React, { useState } from 'react';
import VolumeChart from '../components/VolumeChart';

function volumeFlag(volIn, volOut){
  const variance = volIn === 0 ? 0 : Math.abs(volIn - volOut) / volIn * 100;
  return { variance: variance.toFixed(1), flag: variance > 2 ? 'alert' : 'pure' };
}

function FlagPill({ flag }) {
  return flag === 'pure'
    ? <span className="flag-pill pure"><span className="dot"></span>Pure</span>
    : <span className="flag-pill alert"><span className="dot"></span>Flagged</span>;
}

export default function CenterDashboard({ user }) {
  const [rows, setRows] = useState([
    { batch: 'B-2291', source: 'Farmer Cluster A', volIn: 320, volOut: 314 },
    { batch: 'B-2292', source: 'Farmer Cluster B', volIn: 280, volOut: 275 },
    { batch: 'B-2293', source: 'Farmer Cluster C', volIn: 300, volOut: 252 },
    { batch: 'B-2294', source: 'Farmer Cluster A', volIn: 310, volOut: 306 },
  ]);

  const stats = [
    ['Batches In', rows.length, ''],
    ['Total Volume In', rows.reduce((a,r)=>a+r.volIn,0) + ' L', ''],
    ['Avg. Variance', (rows.reduce((a,r)=>a+parseFloat(volumeFlag(r.volIn,r.volOut).variance),0)/(rows.length||1)).toFixed(1) + '%', ''],
    ['Fraud Alerts', rows.filter(r=>volumeFlag(r.volIn,r.volOut).flag==='alert').length, 'warn'],
  ];

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>Collection Center Dashboard</h1>
          <div className="sub">Reconcile incoming vs. outgoing volume.</div>
        </div>
        <div className="user-chip">
          <div className="avatar">C</div>
          <div><div className="name">Demo Center</div><div className="role">Middleman</div></div>
        </div>
      </div>
      
      <div className="stats-row">
        {stats.map(([lbl, val, delta], i) => (
          <div key={i} className="stat-card">
            <div className="lbl">{lbl}</div>
            <div className="val">{val}</div>
            {delta && <div className={`delta ${delta}`}>{delta==='warn'?'Needs review':'On track'}</div>}
          </div>
        ))}
      </div>
      <div className="grid-2">
        <div className="panel">
          <h3>Volume Trend</h3>
          <div className="sub">Recent incoming volume</div>
          <div className="chart-wrap" style={{height:'200px'}}>
             <VolumeChart values={rows.map(r=>r.volIn)} labels={rows.map(r=>r.batch.split('-')[1])} />
          </div>
        </div>
        <div className="panel">
          <h3>Recent Entries</h3>
          <div className="sub">Latest records</div>
          <div className="side-list">
            {rows.slice(-4).reverse().map((r, i) => (
              <div key={i} className="side-row">
                <span className="id">{r.batch}</span>
                <span className="meta"><FlagPill flag={volumeFlag(r.volIn, r.volOut).flag} /></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
