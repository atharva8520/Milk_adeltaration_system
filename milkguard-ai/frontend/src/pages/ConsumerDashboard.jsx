import React from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, ShieldAlert } from 'lucide-react';

export default function ConsumerDashboard({ user }) {
  const navigate = useNavigate();

  return (
    <div className="dashboard">
      <h2>Consumer Dashboard</h2>
      <p className="text-secondary">Welcome to MilkGuard AI. Verify the safety and origin of your milk.</p>
      
      <div className="metric-cards" style={{ marginTop: '2rem' }}>
        <div className="panel metric-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/scan')}>
          <div className="metric-title"><QrCode size={24} style={{ marginBottom: '0.5rem' }}/></div>
          <div className="metric-title" style={{ fontSize: '1.25rem' }}>Scan Product</div>
          <p className="text-secondary" style={{ marginTop: '0.5rem', fontSize: '0.875rem', fontWeight: 'normal' }}>Trace the journey of your milk and verify its safety.</p>
        </div>

        <div className="panel metric-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/quick-check')}>
          <div className="metric-title"><ShieldAlert size={24} style={{ marginBottom: '0.5rem' }}/></div>
          <div className="metric-title" style={{ fontSize: '1.25rem' }}>Manual Quick Check</div>
          <p className="text-secondary" style={{ marginTop: '0.5rem', fontSize: '0.875rem', fontWeight: 'normal' }}>Test your milk at home and enter the results here.</p>
        </div>
      </div>
    </div>
  );
}
