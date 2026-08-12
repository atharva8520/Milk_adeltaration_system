import React, { useState, useEffect } from 'react';
import { getChain } from '../api';
import { Search, AlertTriangle, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Pipeline() {
  const [batchId, setBatchId] = useState('');
  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // We want to fetch the chain if batchId is in the URL hash or something, but standard is fine too.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const bId = urlParams.get('batchId');
    if (bId) {
      setBatchId(bId);
      fetchPipeline(bId);
    }
  }, []);

  useEffect(() => {
    if (!batchId) return;
    const interval = setInterval(() => {
      fetchPipeline(batchId, true);
    }, 10000);
    return () => clearInterval(interval);
  }, [batchId]);

  const fetchPipeline = async (id, isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
      setError(null);
      setChain(null);
    }
    
    try {
      const data = await getChain(id);
      if (data.error) {
        if (!isBackground) setError(data.error);
      } else {
        setChain(data);
        if (data.red_alert !== undefined) {
           setError(null);
        }
      }
    } catch (err) {
      if (!isBackground) setError(err.message || "Failed to fetch pipeline data");
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!batchId.trim()) return;
    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set('batchId', batchId.trim());
    window.history.pushState({}, '', url);
    fetchPipeline(batchId.trim());
  };

  // Prepare chart data
  let chartData = [];
  if (chain && chain.stages) {
    chartData = chain.stages.map(stage => {
      return {
        name: stage.role.toUpperCase(),
        Fat: stage.quality?.fat_pct?.value || 0,
        SNF: stage.quality?.snf_pct?.value || 0,
        pH: stage.quality?.ph?.value || 0,
        Density: stage.quality?.density?.value || 0
      };
    });
  }

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>Traceability Pipeline</h1>
          <div className="sub">End-to-End Batch Journey & FSSAI Compliance</div>
        </div>
      </div>
      
      <div className="panel" style={{marginBottom: '20px'}}>
        <form onSubmit={handleSearch} style={{display:'flex', gap:'10px'}}>
          <input 
            type="text" 
            placeholder="Enter Batch ID (e.g. 1234-abcd)"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            style={{flex: 1, padding: '10px 15px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '6px', fontSize:'16px'}}
          />
          <button type="submit" disabled={loading} style={{padding: '10px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold'}}>
            <Search size={18} />
            {loading ? 'Searching...' : 'Trace'}
          </button>
        </form>
        {error && <div style={{marginTop:'15px', color:'#EF4444'}}>{error}</div>}
      </div>

      {chain && (
        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
          
          {/* Violations Banner */}
          {chain.red_alert && chain.violations && chain.violations.length > 0 && (
            <div style={{background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '8px', padding: '15px'}}>
              <h3 style={{color: '#EF4444', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 10px 0'}}>
                <AlertTriangle size={24} /> CRITICAL ADULTERATION ALERTS
              </h3>
              <ul style={{color: '#EF4444', margin: 0, paddingLeft: '20px'}}>
                {chain.violations.map((v, i) => (
                  <li key={i} style={{marginBottom: '5px'}}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          <div className={`panel ${chain.red_alert ? 'border-red' : 'border-green'}`} style={{borderLeft: `4px solid ${chain.red_alert ? '#EF4444' : '#10B981'}`}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <h3 style={{margin:0}}>Batch: {chain.unique_id}</h3>
                <div style={{color:'#94a3b8', fontSize:'13px', marginTop:'4px'}}>
                  Reference: <a href={chain.fssai_reference} target="_blank" rel="noreferrer" style={{color:'#3B82F6'}}>FSSAI Standards</a>
                </div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'18px', fontWeight:'bold', color: chain.red_alert ? '#EF4444' : '#10B981'}}>
                {chain.red_alert ? <><AlertTriangle size={24}/> FLAGGED / ADULTERATED</> : <><CheckCircle size={24}/> SAFE / VERIFIED</>}
              </div>
            </div>
          </div>
          
          {/* Recharts Chart */}
          <div className="panel">
             <h3>Parameter Degradation (Fat, SNF, pH, Density)</h3>
             <div style={{width: '100%', height: 300, marginTop: '20px'}}>
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis yAxisId="left" stroke="#94a3b8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
                    <Tooltip contentStyle={{backgroundColor: '#0F172A', borderColor: '#1E293B', color: '#fff'}} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="Fat" stroke="#3B82F6" activeDot={{ r: 8 }} />
                    <Line yAxisId="left" type="monotone" dataKey="SNF" stroke="#10B981" />
                    <Line yAxisId="left" type="monotone" dataKey="pH" stroke="#F59E0B" />
                    <Line yAxisId="right" type="monotone" dataKey="Density" stroke="#8B5CF6" />
                  </LineChart>
               </ResponsiveContainer>
             </div>
          </div>

          {/* 3-Column Layout */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px'}}>
            {['farmer', 'middleman', 'manufacturer'].map(role => {
               // Find stage matching this role
               const stage = chain.stages.find(s => s.role === role);
               if (!stage) {
                 return (
                   <div key={role} className="panel" style={{opacity: 0.5}}>
                      <h3 style={{textTransform:'uppercase', margin:'0 0 10px 0', fontSize:'16px', color:'#94a3b8'}}>{role === 'middleman' ? 'Dairyman/Center' : role}</h3>
                      <div style={{fontStyle:'italic', color:'#64748b'}}>No data for this stage.</div>
                   </div>
                 );
               }

               return (
                  <div key={role} className="panel" style={{border: stage.is_flagged ? '1px solid #7f1d1d' : '1px solid #1E293B', background: stage.is_flagged ? 'rgba(239, 68, 68, 0.05)' : '#111827', display: 'flex', flexDirection: 'column'}}>
                      <div style={{borderBottom: '1px solid #1E293B', paddingBottom: '10px', marginBottom: '15px'}}>
                        <h3 style={{textTransform:'uppercase', margin:'0 0 5px 0', fontSize:'16px', color:'#3B82F6', display:'flex', alignItems:'center', gap:'8px'}}>
                          {role === 'middleman' ? 'Center' : role}
                          {stage.is_flagged && <AlertTriangle size={16} color="#EF4444" />}
                        </h3>
                        <div style={{fontSize: '14px', fontWeight: 'bold'}}>{stage.entity_name}</div>
                        <div style={{color:'#94a3b8', fontSize:'12px', marginTop: '4px'}}>Volume: {stage.volume_liters} L &bull; {new Date(stage.timestamp).toLocaleString()}</div>
                      </div>

                      {Object.keys(stage.quality).length > 0 ? (
                        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '10px'}}>
                          {Object.entries(stage.quality).map(([param, data]) => {
                             // Only display some key ones to avoid clutter if there's too many
                             return (
                               <div key={param} style={{background:'#1E293B', padding:'10px', borderRadius:'4px', borderLeft: `3px solid ${data.status === 'Suspicious' ? '#EF4444' : (data.status === 'Borderline' ? '#F59E0B' : '#10B981')}`}}>
                                 <div style={{fontSize:'12px', color:'#94a3b8', textTransform:'capitalize', display: 'flex', justifyContent: 'space-between'}}>
                                    <span>{param.replace(/_/g, ' ')}</span>
                                    <span style={{color: data.status === 'Suspicious' ? '#EF4444' : (data.status === 'Borderline' ? '#F59E0B' : '#10B981'), fontSize: '11px', fontWeight: 'bold'}}>{data.status}</span>
                                 </div>
                                 <div style={{fontSize:'16px', fontWeight:'bold', margin:'4px 0'}}>
                                   {data.value}
                                 </div>
                                 <div style={{fontSize:'10px', color:'#64748b'}}>Ref: {data.range}</div>
                               </div>
                             );
                          })}
                        </div>
                      ) : (
                        <div style={{color:'#64748b', fontSize:'13px', fontStyle:'italic', flex: 1}}>No quality report submitted at this stage.</div>
                      )}
                  </div>
               );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
