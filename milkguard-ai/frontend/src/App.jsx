import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { fetchUser } from './api';

import FarmerShell from './shells/FarmerShell';
import CenterShell from './shells/CenterShell';
import ManufacturerShell from './shells/ManufacturerShell';
import AdminShell from './shells/AdminShell';

import Login from './pages/Login';
import ConsumerDashboard from './pages/ConsumerDashboard';
import ConsumerScan from './pages/ConsumerScan';
import Pipeline from './pages/Pipeline';
import './App.css';

function MasterShell({ user }) {
  switch (user.role) {
    case 'farmer':
      return (
        <div style={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
          <FarmerShell user={user} />
        </div>
      );
    case 'middleman':
      return <CenterShell user={user} />;
    case 'manufacturer':
      return <ManufacturerShell user={user} />;
    case 'admin':
    default:
      return <AdminShell user={user} />;
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

  if (loading) return <div style={{padding:'20px'}}>Loading MilkGuard AI...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={user ? <MasterShell user={user} /> : <Navigate to="/login" />} />
        <Route path="/scan" element={<ConsumerScan />} />
        <Route path="/quick-check" element={<ConsumerDashboard />} />
        {/* Pipeline is also accessible standalone, but will be integrated into Shells as well */}
        <Route path="/pipeline" element={<Pipeline />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
