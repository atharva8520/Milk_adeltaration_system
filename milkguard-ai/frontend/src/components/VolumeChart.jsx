import React from 'react';

export default function VolumeChart({ values, labels }) {
  if (!values || values.length === 0) {
    return <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--ink-faint)'}}>No data available</div>;
  }

  const w = 560;
  const h = 190;
  const pad = 24;
  
  const max = Math.max(...values, 1) * 1.15;
  const min = Math.min(...values, 0) * 0.9;
  const range = (max - min) || 1;
  const stepX = (w - pad * 2) / (values.length - 1 || 1);
  
  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / range) * (h - pad * 1.6);
    return [x, y];
  });
  
  const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = linePath + ` L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2F9E6E" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#2F9E6E" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaFill)"/>
      <path d={linePath} fill="none" stroke="#2F9E6E" strokeWidth="2"/>
      
      {pts.map((p, i) => (
        <circle key={`dot-${i}`} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r="3" fill="#0B1220" stroke="#2F9E6E" strokeWidth="1.6" />
      ))}
      
      {labels.map((l, i) => (
        <text key={`label-${i}`} x={pts[i][0].toFixed(1)} y={h - 4} fontSize="8.5" fill="#5A6C8A" textAnchor="middle" fontFamily="IBM Plex Mono, monospace">
          {l}
        </text>
      ))}
    </svg>
  );
}
