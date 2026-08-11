import React, { useState } from 'react';
import { Home, Users, CheckSquare, Settings, Bell, Map as MapIcon, ShieldCheck, Factory, Archive } from 'lucide-react';
import FarmerDashboard from '../pages/FarmerDashboard';

export default function FarmerShell({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const navItems = [
    { id: 'dashboard', icon: <Home size={20} />, label: 'Home' },
    { id: 'livestock', icon: <Archive size={20} />, label: 'Livestock' },
    { id: 'batches', icon: <CheckSquare size={20} />, label: 'Batches' },
    { id: 'alerts', icon: <Bell size={20} />, label: 'Alerts' },
    { id: 'settings', icon: <Settings size={20} />, label: 'Settings' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <FarmerDashboard user={user} />;
      default: return <div style={{padding:'20px'}}><h3>{activeTab.toUpperCase()} Module</h3><p>Interactive mock module coming soon.</p></div>;
    }
  };

  return (
    <div className="farmer-shell mobile-wrapper">
      <main className="content-area" style={{ paddingBottom: '70px', overflowY: 'auto', height: '100vh' }}>
        {renderContent()}
      </main>
      <nav className="bottom-bar">
        {navItems.map(item => (
          <button 
            key={item.id} 
            className={`bottom-tab ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
