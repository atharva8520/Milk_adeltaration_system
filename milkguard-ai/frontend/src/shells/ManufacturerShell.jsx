import React, { useState } from 'react';
import { Home, Settings, Bell, Factory, LogOut, Activity } from 'lucide-react';
import ManufacturerDashboard from '../pages/ManufacturerDashboard';
import Pipeline from '../pages/Pipeline';
import { logout } from '../api';

export default function ManufacturerShell({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const navItems = [
    { id: 'dashboard', icon: <Home size={18} />, label: 'Dashboard' },
    { id: 'pipeline', icon: <Activity size={18} />, label: 'Pipeline' },
    { id: 'inventory', icon: <Factory size={18} />, label: 'Processing' },
    { id: 'alerts', icon: <Bell size={18} />, label: 'Alerts' },
    { id: 'settings', icon: <Settings size={18} />, label: 'Settings' }
  ];

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <ManufacturerDashboard user={user} />;
      case 'pipeline': return <Pipeline />;
      default: return <div style={{padding:'20px'}}><h3>{activeTab.toUpperCase()} Module</h3><p>Interactive mock module coming soon.</p></div>;
    }
  };

  return (
    <div className="layout desktop-wrapper tablet-wrapper">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Factory className="brand-icon" size={24} />
          <h2 className="brand-title">Factory Mgr</h2>
        </div>
        <nav className="sidebar-nav" style={{ overflowY: 'auto' }}>
          {navItems.map(item => (
            <button 
              key={item.id} 
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
          <button 
            className="nav-item"
            onClick={handleLogout}
            style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', marginTop: 'auto' }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </nav>
      </aside>
      <main className="main-content">
        <header className="global-header">
          <div className="header-status">
            <span className="status-indicator safe"></span>
            <span className="status-text">Factory Active</span>
          </div>
          <div className="user-profile" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* removed globalRoleSwitcher */}
          </div>
        </header>
        <div className="content-container">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
