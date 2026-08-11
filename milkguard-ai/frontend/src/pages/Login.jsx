import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { login } from '../api';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('center@e2e.com');
  const [password, setPassword] = useState('pw');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="login-container">
      <div className="login-panel panel">
        <div className="login-header">
          <ShieldAlert size={48} className="brand-icon" />
          <h1>MilkGuard AI</h1>
          <p>Compliance & Fraud Detection Command Center</p>
        </div>
        
        {error && <div className="error-banner">{error}</div>}
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>Operator Email</label>
            <input 
              type="email" 
              className="form-control"
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              className="form-control"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{width: '100%'}}>
            Secure Login
          </button>
        </form>
      </div>
    </div>
  );
}
