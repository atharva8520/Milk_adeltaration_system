import React, { useState } from 'react';
import { getChain } from '../api';
import { Search, AlertTriangle, CheckCircle, ArrowDown } from 'lucide-react';

export default function Pipeline() {
  const [batchId, setBatchId] = useState('');
  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!batchId.trim()) return;
    
    setLoading(true);
    setError(null);
    setChain(null);
    
    try {
      const data = await getChain(batchId.trim());
      if (data.error) {
        setError(data.error);
      } else {
        setChain(data);
      }
    } catch (err) {
      setError(err.message || "Failed to fetch pipeline data");
    } finally {
      setLoading(false);
    }
  };

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
          
          <div className="pipeline-stages" style={{display:'flex', flexDirection:'column', gap:'0'}}>
            {chain.stages.map((stage, i) => (
              <React.Fragment key={i}>
                <div className="panel" style={{margin:'0', border: stage.is_flagged ? '1px solid #7f1d1d' : '1px solid #1E293B', background: stage.is_flagged ? 'rgba(239, 68, 68, 0.05)' : '#111827'}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                    <div>
                      <span style={{textTransform:'uppercase', fontSize:'11px', fontWeight:'bold', color:'#3B82F6', letterSpacing:'1px'}}>{stage.role}</span>
                      <h3 style={{margin:'5px 0', fontSize:'18px', display:'flex', alignItems:'center', gap:'8px'}}>
                        {stage.entity_name}
                        {stage.is_flagged && <AlertTriangle size={16} color="#EF4444" />}
                      </h3>
                      <div style={{color:'#94a3b8', fontSize:'13px'}}>Volume: {stage.volume_liters} L &bull; {new Date(stage.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                  
                  {Object.keys(stage.quality).length > 0 ? (
                    <div style={{background:'#0F172A', borderRadius:'6px', padding:'15px'}}>
                      <h4 style={{margin:'0 0 10px 0', fontSize:'12px', color:'#94a3b8', textTransform:'uppercase'}}>Quality Inspection</h4>
                      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'15px'}}>
                        {Object.entries(stage.quality).map(([param, data]) => (
                          <div key={param} style={{background:'#1E293B', padding:'10px', borderRadius:'4px', borderLeft: `3px solid ${data.status === 'Suspicious' ? '#EF4444' : (data.status === 'Borderline' ? '#F59E0B' : '#10B981')}`}}>
                            <div style={{fontSize:'12px', color:'#94a3b8', textTransform:'capitalize'}}>{param.replace(/_/g, ' ')}</div>
                            <div style={{fontSize:'16px', fontWeight:'bold', margin:'4px 0', display:'flex', justifyContent:'space-between'}}>
                              <span>{data.value}</span>
                              <span style={{fontSize:'12px', color: data.status === 'Suspicious' ? '#EF4444' : (data.status === 'Borderline' ? '#F59E0B' : '#10B981')}}>{data.status}</span>
                            </div>
                            <div style={{fontSize:'10px', color:'#64748b'}}>Ref: {data.range}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{color:'#64748b', fontSize:'13px', fontStyle:'italic'}}>No quality report submitted at this stage.</div>
                  )}
                </div>
                {i < chain.stages.length - 1 && (
                  <div style={{display:'flex', justifyContent:'center', padding:'10px 0', color:'#3B82F6'}}>
                    <ArrowDown size={24} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
