import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { DatabaseProvider } from './context/DatabaseContext';
import { fetchUser } from './api';

import FarmerShell from './shells/FarmerShell';
import CenterShell from './shells/CenterShell';
import AdminShell from './shells/AdminShell';

import Login from './pages/Login';
import './App.css';

function MasterShell({ initialUser }) {
  // Allow instantaneous role switching for demo purposes
  const [activeRole, setActiveRole] = useState(initialUser?.role || 'admin');
  
  const roleSwitcher = (
    <select 
      value={activeRole} 
      onChange={(e) => setActiveRole(e.target.value)}
      style={{ padding: '6px 12px', borderRadius: '4px', background: '#1A2333', color: '#fff', border: '1px solid #2A3649' }}
    >
      <option value="farmer">Farmer View (Mobile)</option>
      <option value="middleman">Center View (Tablet)</option>
      <option value="admin">Admin View (Desktop)</option>
    </select>
  );

  // Pass a dummy user object matching the active role
  const mockUser = { email: `demo@${activeRole}.com`, role: activeRole, id: 1 };

  switch (activeRole) {
    case 'farmer':
      // For mobile, maybe we just put the switcher at the top independently
      return (
        <div style={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
          <div style={{padding: '10px', background: '#0B1220', borderBottom: '1px solid #1A2333', display: 'flex', justifyContent: 'flex-end'}}>
             {roleSwitcher}
          </div>
          <FarmerShell user={mockUser} />
        </div>
      );
    case 'middleman':
      return <CenterShell user={mockUser} globalRoleSwitcher={roleSwitcher} />;
    default:
      return <AdminShell user={mockUser} globalRoleSwitcher={roleSwitcher} />;
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser().then(data => {
      setUser(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{padding:'20px'}}>Loading Master Shell...</div>;

  return (
    <DatabaseProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={user ? <MasterShell initialUser={user} /> : <Navigate to="/login" />} />
          {/* Legacy routes can be kept here if needed, but the main app now routes internally via the Shells */}
        </Routes>
      </BrowserRouter>
    </DatabaseProvider>
  );
}

export default App;
