import React, { useState, useEffect } from 'react';
import { quickCheckEstimate } from '../api';
import './ConsumerQuickCheck.css';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export default function ConsumerQuickCheck() {
  const [params, setParams] = useState({
    ph: '',
    density: '',
    fat_pct: '',
    snf_pct: '',
    formaldehyde_ppm: '',
    peroxidase_activity: '1' // Default positive
  });

  const [result, setResult] = useState(null);

  useEffect(() => {
    // Only run if at least one numeric value exists
    const hasValue = Object.values(params).some(v => v !== '');
    if (!hasValue) {
      setResult(null);
      return;
    }

    const timer = setTimeout(() => {
      runCheck();
    }, 500);
    return () => clearTimeout(timer);
  }, [params]);

  const runCheck = async () => {
    const payload = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== '') {
        payload[k] = k === 'peroxidase_activity' ? parseInt(v) : parseFloat(v);
      }
    }
    
    if (Object.keys(payload).length === 0) return;

    try {
      const res = await quickCheckEstimate(payload);
      setResult(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    setParams({ ...params, [e.target.name]: e.target.value });
  };

  return (
    <div className="quickcheck-page">
      <div className="disclaimer-banner">
        <AlertTriangle size={18} />
        <strong>Quick Check (Estimate)</strong> — not a certified lab result. This uses FSSAI/BIS rule-of-thumb ranges, NOT the AI model prediction.
      </div>

      <div className="quickcheck-grid">
        <div className="panel form-panel">
          <h3>Input Parameters</h3>
          <p className="text-secondary" style={{marginBottom: '1.5rem'}}>Enter any known values to estimate adulteration likelihood.</p>
          
          <div className="form-group">
            <label>pH Level</label>
            <input type="number" step="0.1" name="ph" value={params.ph} onChange={handleChange} className="form-control" placeholder="e.g. 6.6" />
          </div>
          
          <div className="form-group">
            <label>Density (g/cm³)</label>
            <input type="number" step="0.001" name="density" value={params.density} onChange={handleChange} className="form-control" placeholder="e.g. 1.030" />
          </div>
          
          <div className="form-group">
            <label>Fat (%)</label>
            <input type="number" step="0.1" name="fat_pct" value={params.fat_pct} onChange={handleChange} className="form-control" placeholder="e.g. 3.5" />
          </div>

          <div className="form-group">
            <label>SNF (%)</label>
            <input type="number" step="0.1" name="snf_pct" value={params.snf_pct} onChange={handleChange} className="form-control" placeholder="e.g. 8.5" />
          </div>
          
          <div className="form-group">
            <label>Formaldehyde (ppm)</label>
            <input type="number" step="0.01" name="formaldehyde_ppm" value={params.formaldehyde_ppm} onChange={handleChange} className="form-control" placeholder="0.0" />
          </div>
          
          <div className="form-group">
            <label>Peroxidase Test (Storch's)</label>
            <select name="peroxidase_activity" value={params.peroxidase_activity} onChange={handleChange} className="form-control">
              <option value="1">Positive (Normal/Raw/Pasteurized)</option>
              <option value="0">Negative (Suspicious/Synthetic/Over-boiled)</option>
            </select>
          </div>
        </div>

        <div className="panel results-panel">
          <h3>Live Estimate</h3>
          
          {!result ? (
            <p className="text-secondary text-center" style={{marginTop: '2rem'}}>Awaiting input...</p>
          ) : (
            <div className="results-content">
              <div className="overall-score">
                <div className="score-label">Adulteration Likelihood</div>
                <div className={`score-value ${result.is_suspicious ? 'text-critical' : 'text-safe'}`}>
                  {result.adulteration_likelihood_pct}%
                </div>
                <div className="score-status">
                  {result.is_suspicious ? 'Suspicious Profile' : 'Normal Profile'}
                </div>
              </div>

              <div className="parameter-breakdown">
                <h4>Parameter Breakdown</h4>
                {result.parameters.map((p, i) => (
                  <div key={i} className={`param-row status-${p.status.toLowerCase()}`}>
                    <div className="param-header">
                      <strong>{p.parameter}</strong>: {p.value_entered}
                    </div>
                    <div className="param-details">
                      <span className="ref-range">Ref: {p.reference_range}</span>
                      {p.deviation_pct > 0 && <span className="dev-pct">{p.deviation_pct}% Deviation</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
