import React, { useState } from 'react';
import { submitCollectionEvent, submitCenterEvent, submitQualityReport } from '../api';
import './DataEntry.css';

export default function DataEntry() {
  const [log, setLog] = useState([]);

  const addLog = (msg) => {
    setLog(prev => [msg, ...prev]);
  };

  const handleCollection = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await submitCollectionEvent({
        farmer_id: parseInt(fd.get('farmer_id')),
        center_id: parseInt(fd.get('center_id')),
        volume_liters: parseFloat(fd.get('volume'))
      });
      addLog(`[Success] Collection Event: Batch ${res.batch_id}`);
    } catch (err) {
      addLog(`[Error] Collection Event failed.`);
    }
  };

  const handleQuality = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await submitQualityReport({
        batch_id: fd.get('batch_id'),
        fat_percentage: 4.0,
        snf_percentage: 8.5,
        ph_level: 6.7,
        peroxidase_activity: parseFloat(fd.get('perox')),
        enose_sensor_s02: 1.0,
        formalin_test: 0,
        enose_sensor_s01: 1.0,
        formaldehyde_ppm: 0.0,
        ffa_linoleic_c18_2_pct: 0.5
      });
      addLog(`[Success] Quality Report: Safe=${res.is_safe}`);
    } catch (err) {
      addLog(`[Error] Quality Report failed.`);
    }
  };

  return (
    <div className="data-entry-page">
      <div className="forms-grid">
        <div className="panel">
          <h3>Log Farmer Collection</h3>
          <form onSubmit={handleCollection}>
            <div className="form-group">
              <label>Farmer ID</label>
              <input name="farmer_id" type="number" className="form-control" defaultValue="1" required />
            </div>
            <div className="form-group">
              <label>Center ID</label>
              <input name="center_id" type="number" className="form-control" defaultValue="2" required />
            </div>
            <div className="form-group">
              <label>Volume (Liters)</label>
              <input name="volume" type="number" step="0.1" className="form-control" defaultValue="20" required />
            </div>
            <button type="submit" className="btn btn-primary">Submit Event</button>
          </form>
        </div>

        <div className="panel">
          <h3>Submit Quality Report (Test Engine B)</h3>
          <form onSubmit={handleQuality}>
            <div className="form-group">
              <label>Batch ID</label>
              <input name="batch_id" type="text" className="form-control" placeholder="UUID" required />
            </div>
            <div className="form-group">
              <label>Peroxidase Activity (Anomaly if &lt; 2)</label>
              <input name="perox" type="number" step="0.1" className="form-control" defaultValue="5.0" required />
            </div>
            <button type="submit" className="btn btn-primary">Run Quality Check</button>
          </form>
        </div>
      </div>
      
      <div className="panel log-panel">
        <h3>Action Log</h3>
        <ul className="action-log">
          {log.map((l, i) => (
            <li key={i} className="mono">{l}</li>
          ))}
          {log.length === 0 && <li className="text-secondary">No actions logged yet.</li>}
        </ul>
      </div>
    </div>
  );
}
