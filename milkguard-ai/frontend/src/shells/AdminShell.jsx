import React, { useState } from 'react';
import { Home, Users, CheckSquare, Settings, Bell, Map as MapIcon, ShieldCheck, Factory, Archive, BarChart2, Store } from 'lucide-react';
import AdminDashboard from '../pages/AdminDashboard';

export default function AdminShell({ user, globalRoleSwitcher }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const navItems = [
    { id: 'dashboard', icon: <Home size={18} />, label: 'Dashboard' },
    { id: 'farmers', icon: <Users size={18} />, label: 'Farmers' },
    { id: 'livestock', icon: <Archive size={18} />, label: 'Livestock' },
    { id: 'batches', icon: <CheckSquare size={18} />, label: 'Batches' },
    { id: 'centers', icon: <Store size={18} />, label: 'Collection Centres' },
    { id: 'factories', icon: <Factory size={18} />, label: 'Factories' },
    { id: 'govlabs', icon: <ShieldCheck size={18} />, label: 'Govt-Labs' },
    { id: 'consumers', icon: <Users size={18} />, label: 'Consumers' },
    { id: 'alerts', icon: <Bell size={18} />, label: 'Fraud Center' },
    { id: 'maps', icon: <MapIcon size={18} />, label: 'Operations Map' },
    { id: 'analytics', icon: <BarChart2 size={18} />, label: 'Analytics' },
    { id: 'settings', icon: <Settings size={18} />, label: 'Settings' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <AdminDashboard user={user} />;
      default: return <div style={{padding:'20px'}}><h3>{activeTab.toUpperCase()} Module</h3><p>Interactive mock module coming soon.</p></div>;
    }
  };

  return (
    <div className="layout desktop-wrapper">
      <aside className="sidebar">
        <div className="sidebar-header">
          <ShieldCheck className="brand-icon" size={24} />
          <h2 className="brand-title">MilkGuard AI (Admin)</h2>
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
        </nav>
      </aside>
      <main className="main-content">
        <header className="global-header">
          <div className="header-status">
            <span className="status-indicator safe"></span>
            <span className="status-text">Enterprise Command Center</span>
          </div>
          <div className="user-profile" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {globalRoleSwitcher}
          </div>
        </header>
        <div className="content-container">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
