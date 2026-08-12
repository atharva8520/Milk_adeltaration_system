import React, { useState, useEffect } from 'react';
import { getRecentBatches, submitFactoryEvent, submitQualityReport } from '../api';
import VolumeChart from '../components/VolumeChart';

function FlagPill({ isSafe }) {
  return isSafe
    ? <span className="flag-pill pure"><span className="dot"></span>Pure</span>
    : <span className="flag-pill alert"><span className="dot"></span>Flagged</span>;
}

export default function ManufacturerDashboard({ user }) {
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [parentBatchId, setParentBatchId] = useState('');
  const [volume, setVolume] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Quality State
  const [quality, setQuality] = useState({
    fat_percentage: '',
    snf_percentage: '',
    ph_level: '',
    density_g_cm3: '',
    temperature_c: '',
    peroxidase_activity: '1',
    enose_sensor_s02: '0',
    formalin_test: '0',
    enose_sensor_s01: '0',
    formaldehyde_ppm: '0',
    ffa_linoleic_c18_2_pct: '0',
    urea_mg: '0',
    water_addition_pct: '0',
    starch_test: '0',
    detergent_test: '0'
  });
  
  const [submitResult, setSubmitResult] = useState(null);

  const fetchData = async () => {
    try {
      const batches = await getRecentBatches(30);
      const inc = batches.filter(b => b.destination_id === user.id);
      const out = batches.filter(b => b.source_id === user.id);
      setIncoming(inc);
      setOutgoing(out);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleQualityChange = (e) => {
    setQuality({...quality, [e.target.name]: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!parentBatchId) {
       setSubmitResult({ success: false, message: 'Please select an incoming batch.' });
       return;
    }

    setSubmitResult(null);
    try {
      // 1. Submit Factory Event
      const res = await submitFactoryEvent({
        factory_id: user.id,
        volume_out_liters: parseFloat(volume),
        collection_date: date,
        parent_batch_ids: [parentBatchId] // Single batch flow
      });
      
      const batchId = res.batch_id;
      
      // 2. Submit Quality
      await submitQualityReport({
        batch_id: batchId,
        fat_percentage: parseFloat(quality.fat_percentage),
        snf_percentage: parseFloat(quality.snf_percentage),
        ph_level: parseFloat(quality.ph_level),
        density_g_cm3: parseFloat(quality.density_g_cm3),
        temperature_c: parseFloat(quality.temperature_c),
        peroxidase_activity: parseFloat(quality.peroxidase_activity),
        enose_sensor_s02: parseFloat(quality.enose_sensor_s02),
        formalin_test: parseInt(quality.formalin_test),
        enose_sensor_s01: parseFloat(quality.enose_sensor_s01),
        formaldehyde_ppm: parseFloat(quality.formaldehyde_ppm),
        ffa_linoleic_c18_2_pct: parseFloat(quality.ffa_linoleic_c18_2_pct),
        urea_mg: parseFloat(quality.urea_mg),
        water_addition_pct: parseFloat(quality.water_addition_pct),
        starch_test: parseInt(quality.starch_test),
        detergent_test: parseInt(quality.detergent_test)
      });
      
      setSubmitResult({ success: true, batchId: batchId });
      setVolume('');
      setParentBatchId('');
      setQuality(prev => ({
        ...prev,
        fat_percentage: '', snf_percentage: '', ph_level: '', density_g_cm3: '', temperature_c: ''
      }));
      fetchData();
    } catch (err) {
      setSubmitResult({ success: false, message: err.message });
    }
  };

  if (loading && incoming.length === 0 && outgoing.length === 0) return <div style={{padding:'20px'}}>Loading...</div>;

  const totalIn = incoming.reduce((a,r) => a + r.volume_liters, 0);
  const totalOut = outgoing.reduce((a,r) => a + r.volume_liters, 0);
  const variance = totalIn > 0 ? Math.abs(totalIn - totalOut) / totalIn * 100 : 0;

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>Manufacturer Dashboard</h1>
          <div className="sub">Process incoming batches and certify output quality.</div>
        </div>
        <div className="user-chip">
          <div className="avatar">{user.name ? user.name.charAt(0) : 'M'}</div>
          <div><div className="name">{user.name || `Factory #${user.id}`}</div><div className="role">Manufacturer</div></div>
        </div>
      </div>
      
      <div className="stats-row">
        <div className="stat-card">
          <div className="lbl">Batches In</div>
          <div className="val">{incoming.length}</div>
        </div>
        <div className="stat-card">
          <div className="lbl">Total Vol In</div>
          <div className="val">{totalIn.toFixed(1)} L</div>
        </div>
        <div className="stat-card">
          <div className="lbl">Total Vol Out</div>
          <div className="val">{totalOut.toFixed(1)} L</div>
        </div>
        <div className="stat-card">
          <div className="lbl">Loss / Yield</div>
          <div className="val">{variance.toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Process & Output Batch</h3>
          <div className="sub">Process a single batch and certify output</div>
          <form onSubmit={handleSubmit} style={{marginTop: '15px'}}>
            <div style={{marginBottom: '10px'}}>
              <label style={{display:'block', marginBottom:'5px', color:'#94a3b8', fontSize:'12px'}}>Select Incoming Batch to Process</label>
              <select value={parentBatchId} onChange={e => setParentBatchId(e.target.value)} required style={{width: '100%', padding: '8px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px'}}>
                <option value="">-- Select Batch --</option>
                {incoming.filter(b => b.status !== 'processed').map(b => (
                  <option key={b.id} value={b.id}>{b.id.substring(0,8)} ({b.volume_liters}L)</option>
                ))}
              </select>
            </div>
            
            <div style={{display:'flex', gap:'10px', marginBottom: '10px'}}>
              <div style={{flex:1}}>
                <label style={{display:'block', marginBottom:'5px', color:'#94a3b8', fontSize:'12px'}}>Output Volume (Liters)</label>
                <input type="number" step="0.1" value={volume} onChange={e => setVolume(e.target.value)} required style={{width: '100%', padding: '8px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px'}} />
              </div>
              <div style={{flex:1}}>
                <label style={{display:'block', marginBottom:'5px', color:'#94a3b8', fontSize:'12px'}}>Processing Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{width: '100%', padding: '8px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px'}} />
              </div>
            </div>
            
            <div style={{marginTop: '20px', marginBottom: '10px', paddingBottom:'5px', borderBottom:'1px solid #1E293B'}}>
              <h4 style={{margin:0}}>Final Quality Certification</h4>
            </div>
            
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom: '15px'}}>
              <div>
                <label style={{display:'block', marginBottom:'2px', color:'#94a3b8', fontSize:'11px'}}>Fat %</label>
                <input type="number" step="0.1" name="fat_percentage" value={quality.fat_percentage} onChange={handleQualityChange} required style={{width: '100%', padding: '6px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px', fontSize:'12px'}} />
              </div>
              <div>
                <label style={{display:'block', marginBottom:'2px', color:'#94a3b8', fontSize:'11px'}}>SNF %</label>
                <input type="number" step="0.1" name="snf_percentage" value={quality.snf_percentage} onChange={handleQualityChange} required style={{width: '100%', padding: '6px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px', fontSize:'12px'}} />
              </div>
              <div>
                <label style={{display:'block', marginBottom:'2px', color:'#94a3b8', fontSize:'11px'}}>pH Level</label>
                <input type="number" step="0.1" name="ph_level" value={quality.ph_level} onChange={handleQualityChange} required style={{width: '100%', padding: '6px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px', fontSize:'12px'}} />
              </div>
              <div>
                <label style={{display:'block', marginBottom:'2px', color:'#94a3b8', fontSize:'11px'}}>Density (g/cm3)</label>
                <input type="number" step="0.001" name="density_g_cm3" value={quality.density_g_cm3} onChange={handleQualityChange} required style={{width: '100%', padding: '6px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px', fontSize:'12px'}} />
              </div>
              <div>
                <label style={{display:'block', marginBottom:'2px', color:'#94a3b8', fontSize:'11px'}}>Urea (mg/100ml)</label>
                <input type="number" step="0.1" name="urea_mg" value={quality.urea_mg} onChange={handleQualityChange} required style={{width: '100%', padding: '6px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px', fontSize:'12px'}} />
              </div>
              <div>
                <label style={{display:'block', marginBottom:'2px', color:'#94a3b8', fontSize:'11px'}}>Water Addition %</label>
                <input type="number" step="0.1" name="water_addition_pct" value={quality.water_addition_pct} onChange={handleQualityChange} required style={{width: '100%', padding: '6px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px', fontSize:'12px'}} />
              </div>
              <div>
                <label style={{display:'block', marginBottom:'2px', color:'#94a3b8', fontSize:'11px'}}>Formalin Test (0/1)</label>
                <input type="number" min="0" max="1" name="formalin_test" value={quality.formalin_test} onChange={handleQualityChange} required style={{width: '100%', padding: '6px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px', fontSize:'12px'}} />
              </div>
              <div>
                <label style={{display:'block', marginBottom:'2px', color:'#94a3b8', fontSize:'11px'}}>Formaldehyde (ppm)</label>
                <input type="number" step="0.01" name="formaldehyde_ppm" value={quality.formaldehyde_ppm} onChange={handleQualityChange} required style={{width: '100%', padding: '6px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px', fontSize:'12px'}} />
              </div>
              <div>
                <label style={{display:'block', marginBottom:'2px', color:'#94a3b8', fontSize:'11px'}}>Starch Test (0/1)</label>
                <input type="number" min="0" max="1" name="starch_test" value={quality.starch_test} onChange={handleQualityChange} required style={{width: '100%', padding: '6px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px', fontSize:'12px'}} />
              </div>
              <div>
                <label style={{display:'block', marginBottom:'2px', color:'#94a3b8', fontSize:'11px'}}>Detergent Test (0/1)</label>
                <input type="number" min="0" max="1" name="detergent_test" value={quality.detergent_test} onChange={handleQualityChange} required style={{width: '100%', padding: '6px', background: '#0F172A', color: '#fff', border: '1px solid #1E293B', borderRadius: '4px', fontSize:'12px'}} />
              </div>
            </div>
            
            <button type="submit" style={{width: '100%', padding: '10px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}>Generate Output Batch</button>
          </form>
          
          {submitResult && (
            <div style={{marginTop: '15px', padding: '10px', borderRadius: '4px', background: submitResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: submitResult.success ? '#10B981' : '#EF4444', fontSize: '13px'}}>
              {submitResult.success ? (
                <><strong>Success!</strong><br/>Final Batch ID: <code style={{userSelect:'all'}}>{submitResult.batchId}</code></>
              ) : (
                <><strong>Error:</strong> {submitResult.message}</>
              )}
            </div>
          )}
        </div>

        <div style={{display:'flex', flexDirection:'column', gap: '20px'}}>
          <div className="panel">
            <h3>Recent Outgoing Batches</h3>
            <div className="sub">Processed and ready for consumers</div>
            <div className="side-list">
              {outgoing.slice(0, 5).map((r, i) => (
                <div key={i} className="side-row" style={{display:'flex', justifyContent:'space-between'}}>
                  <span className="id">{r.collection_date || r.timestamp.split('T')[0]} ({r.volume_liters}L)</span>
                  <span className="meta">{r.id.substring(0,8)}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="panel">
            <h3>Incoming Volume Trend</h3>
            <div className="sub">From Centers</div>
            <div className="chart-wrap" style={{height:'200px'}}>
               <VolumeChart values={incoming.slice().reverse().map(r=>r.volume_liters)} labels={incoming.slice().reverse().map(r=>(r.collection_date||r.timestamp.split('T')[0]).slice(5))} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
