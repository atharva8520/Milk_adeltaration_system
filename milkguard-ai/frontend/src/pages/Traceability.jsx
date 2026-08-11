import React, { useState } from 'react';
import { getGovernmentReport } from '../api';
import './Traceability.css';
import { CheckCircle, AlertOctagon } from 'lucide-react';

export default function Traceability() {
  const [batchId, setBatchId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!batchId) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const data = await getGovernmentReport(batchId);
      setReport(data);
    } catch (err) {
      setError('Traceability report not found or failed to fetch.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="traceability-page">
      <div className="panel search-panel">
        <h3 className="section-title">Traceability Schematic Lookup</h3>
        <form onSubmit={handleSearch} className="search-form">
          <input 
            type="text" 
            className="form-control" 
            placeholder="Enter Batch ID..." 
            value={batchId}
            onChange={e => setBatchId(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">Lookup Trace</button>
        </form>
      </div>

      {loading && <p>Loading schematic ledger...</p>}
      {error && <div className="error-banner">{error}</div>}

      {report && (
        <div className="trace-results">
          <div className="panel summary-panel">
            <h3>Batch Details</h3>
            <p className="mono">ID: {report.batch.id}</p>
            <p>Source ID: {report.batch.source_id}</p>
            <p>Volume: {report.batch.volume_liters} L</p>
            <p>Status: {report.batch.status}</p>
            
            <div className="report-flags">
              <h4>Associated Flags</h4>
              {report.flags && report.flags.length > 0 ? (
                report.flags.map((f, i) => (
                  <div key={i} className={`flag-alert flag-${f.severity}`}>
                    <AlertOctagon size={16} /> {f.flag_type} ({f.severity})
                  </div>
                ))
              ) : (
                <div className="flag-alert flag-safe">
                  <CheckCircle size={16} /> No flags detected
                </div>
              )}
            </div>
          </div>

          <div className="schematic-ledger panel">
            <h3>Supply Chain Ledger</h3>
            <div className="ledger-grid">
              <div className="ledger-col backward">
                <h4>Backward Trace (Origin)</h4>
                {renderNodes(report.traceability_backward.parents)}
              </div>
              <div className="ledger-col current">
                <h4>Current Node</h4>
                <div className="ledger-node active">
                  <span className="node-id mono">{report.batch.id.substring(0, 8)}...</span>
                  <span className="node-type">Node</span>
                </div>
              </div>
              <div className="ledger-col forward">
                <h4>Forward Trace (Dest)</h4>
                {renderNodes(report.traceability_forward.children)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderNodes(nodes) {
  if (!nodes || nodes.length === 0) return <p className="text-secondary">End of trace</p>;
  return (
    <ul className="node-list">
      {nodes.map((node, i) => (
        <li key={i} className="ledger-node">
          <span className="node-id mono">{node.batch_id.substring(0, 8)}...</span>
          <span className="node-src">Src: {node.source_id}</span>
          {node.parents && renderNodes(node.parents)}
          {node.children && renderNodes(node.children)}
        </li>
      ))}
    </ul>
  );
}
