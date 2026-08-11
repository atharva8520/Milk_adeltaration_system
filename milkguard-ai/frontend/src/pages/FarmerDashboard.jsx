import React, { useState, useEffect } from 'react';
import { getFlags } from '../api';

const ICONS = {
  dashboard: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="8.5" y="1.5" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="8.5" y="7.5" width="6" height="7" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="1.5" y="9.5" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/></svg>,
  batches: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5L8 2l6 3-6 3-6-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M2 8l6 3 6-3M2 11l6 3 6-3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  alerts: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L14.5 13H1.5L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M8 6.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="11.2" r="0.7" fill="currentColor"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.4"/><path d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1M12.5 12.5l-1.1-1.1M4.6 4.6L3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
};

function chemFlag(ph, fat, snf){
  const isPure = ph >= 6.5 && ph <= 6.8 && fat >= 3.2 && snf >= 8.3;
  return isPure ? 'pure' : 'alert';
}

function FlagPill({ flag }) {
  return flag === 'pure'
    ? <span className="flag-pill pure"><span className="dot"></span>Pure</span>
    : <span className="flag-pill alert"><span className="dot"></span>Flagged</span>;
}

import VolumeChart from '../components/VolumeChart';

export default function FarmerDashboard({ user }) {
  const [view, setView] = useState('dashboard');
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState([
    { date: '2026-08-05', volume: 42, ph: 6.6, fat: 4.0, snf: 8.7 },
    { date: '2026-08-06', volume: 40, ph: 6.6, fat: 3.9, snf: 8.6 },
    { date: '2026-08-07', volume: 38, ph: 6.1, fat: 3.2, snf: 7.9 },
    { date: '2026-08-08', volume: 44, ph: 6.6, fat: 4.1, snf: 8.8 },
    { date: '2026-08-09', volume: 41, ph: 6.5, fat: 3.8, snf: 8.5 },
  ]);

  const cfg = {
    title: 'Farmer Dashboard', sub: "Track your deliveries and test results.",
    stats: (rows) => [
      ['Total Deliveries', rows.length, ''],
      ['Avg. Volume', (rows.reduce((a,r)=>a+r.volume,0)/(rows.length||1)).toFixed(1) + ' L', ''],
      ['Last Result', rows.length ? (chemFlag(rows[rows.length-1].ph, rows[rows.length-1].fat, rows[rows.length-1].snf)==='pure'?'Pure':'Flagged') : '—', ''],
      ['Active Alerts', rows.filter(r=>chemFlag(r.ph,r.fat,r.snf)==='alert').length, 'warn'],
    ]
  };

  const renderDashboard = () => (
    <>
      <div className="stats-row">
        {cfg.stats(rows).map(([lbl, val, delta], i) => (
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
          <div className="sub">Recent activity</div>
          <div className="chart-wrap" style={{height:'200px'}}>
             <VolumeChart values={rows.map(r=>r.volume)} labels={rows.map(r=>r.date.slice(5))} />
          </div>
        </div>
        <div className="panel">
          <h3>Recent Entries</h3>
          <div className="sub">Latest records</div>
          <div className="side-list">
            {rows.slice(-4).reverse().map((r, i) => (
              <div key={i} className="side-row">
                <span className="id">{r.date}</span>
                <span className="meta"><FlagPill flag={chemFlag(r.ph, r.fat, r.snf)} /></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>{cfg.title}</h1>
          <div className="sub">{cfg.sub}</div>
        </div>
        <div className="user-chip">
          <div className="avatar">F</div>
          <div><div className="name">Demo Farmer</div><div className="role">Farmer</div></div>
        </div>
      </div>
      {renderDashboard()}
    </div>
  );
}
