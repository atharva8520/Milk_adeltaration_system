import React, { useState } from 'react';
import { fetchConsumerScan } from '../api';
import { QrCode, ShieldCheck, AlertOctagon, Info } from 'lucide-react';
import './ConsumerScan.css';

export default function ConsumerScan() {
  const [scanId, setScanId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScan = async (e, isBackground = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!scanId.trim()) return;
    
    if (!isBackground) {
      setLoading(true);
      setError('');
      setResult(null);
    }
    
    try {
      const data = await fetchConsumerScan(scanId.trim());
      setResult(data);
      if (!isBackground) setError('');
    } catch (err) {
      if (!isBackground) setError('Invalid Batch ID or product not found.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    if (!scanId || !result) return;
    const interval = setInterval(() => {
      handleScan(null, true);
    }, 10000);
    return () => clearInterval(interval);
  }, [scanId, result]);

  return (
    <div className="consumer-scan-page">
      <div className="scan-header">
        <h2>Consumer Traceability</h2>
        <p className="text-secondary">Scan your product's QR code (or enter Batch ID) to trace its journey.</p>
      </div>

      <form className="scan-bar" onSubmit={handleScan}>
        <QrCode className="scan-icon" size={24} />
        <input 
          type="text" 
          placeholder="Enter Batch ID (e.g., e4c...)" 
          value={scanId}
          onChange={(e) => setScanId(e.target.value)}
          className="scan-input"
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Scanning...' : 'Verify Product'}
        </button>
      </form>

      {error && <div className="scan-error">{error}</div>}

      {result && (
        <div className="scan-results">
          {/* Binary Safety Banner */}
          <div className={`safety-banner ${result.is_safe ? 'banner-safe' : 'banner-critical'}`}>
            {result.is_safe ? (
              <>
                <ShieldCheck size={48} />
                <div>
                  <h3>Product Verified Safe</h3>
                  <p>This batch has passed all quality checks and is safe for consumption.</p>
                </div>
              </>
            ) : (
              <>
                <AlertOctagon size={48} />
                <div>
                  <h3>Product Recalled / Unsafe</h3>
                  <p>This batch has been flagged by our safety sensors. DO NOT CONSUME.</p>
                </div>
              </>
            )}
          </div>

          <div className="details-grid">
            {/* Timeline */}
            <div className="panel timeline-panel">
              <h3>Journey of your Milk</h3>
              <div className="timeline">
                {result.timeline.map((event, i) => (
                  <div key={i} className="timeline-item">
                    <div className="timeline-node"></div>
                    <div className="timeline-content">
                      <div className="timeline-stage">{event.stage}</div>
                      <div className="timeline-entity">{event.entity_name}</div>
                      <div className="timeline-date">{new Date(event.date).toLocaleString()}</div>
                      {event.details && (
                        <div className={`timeline-badge ${event.details.status === 'Passed' ? 'badge-safe' : 'badge-critical'}`}>
                          {event.details.status}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Composition */}
            <div className="panel composition-panel">
              <h3>Verified Composition</h3>
              {Object.keys(result.composition).length === 0 ? (
                <p className="text-secondary">No raw composition data available for this batch.</p>
              ) : (
                <ul className="comp-list">
                  {result.composition.fat_pct !== undefined && (
                    <li>
                      <span className="comp-label">Fat Content</span>
                      <span className="comp-val">{result.composition.fat_pct.toFixed(1)}%</span>
                    </li>
                  )}
                  {result.composition.snf_pct !== undefined && (
                    <li>
                      <span className="comp-label">SNF (Solid Not Fat)</span>
                      <span className="comp-val">{result.composition.snf_pct.toFixed(1)}%</span>
                    </li>
                  )}
                  {result.composition.ph !== undefined && (
                    <li>
                      <span className="comp-label">pH Level</span>
                      <span className="comp-val">{result.composition.ph.toFixed(2)}</span>
                    </li>
                  )}
                </ul>
              )}
              
              {/* Composition Breakdown (Phase 8) */}
              <div className="breakdown-section">
                <h4>Origin Breakdown</h4>
                {result.composition_breakdown && result.composition_breakdown.length > 0 ? (
                  <div className="breakdown-bars">
                    {result.composition_breakdown.map((slice, i) => (
                      <div key={i} className="breakdown-row">
                        <div className="breakdown-label">
                          <span className={slice.name === "Unknown Source" ? "text-critical" : 
                                          slice.name === "Processing Loss" ? "text-warning" : ""}>
                            {slice.name}
                          </span>
                          <span>{slice.percentage}%</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div 
                            className={`progress-bar-fill ${slice.name === 'Unknown Source' ? 'bg-critical' : slice.name === 'Processing Loss' ? 'bg-warning' : 'bg-primary'}`} 
                            style={{ width: `${slice.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-secondary">No breakdown data available.</p>
                )}
              </div>

              <div className="disclaimer-box">
                <Info size={16} />
                <p>{result.note}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
