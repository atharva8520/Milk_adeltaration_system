const API_BASE = 'http://localhost:8000';

export async function login(username, password) {
  const role = username.includes('admin') ? 'admin' : (username.includes('center') ? 'middleman' : 'farmer');
  localStorage.setItem('milkguard_token', 'mock_token_' + role);
  return 'mock_token_' + role;
}

export function getToken() {
  return localStorage.getItem('milkguard_token');
}

export function logout() {
  localStorage.removeItem('milkguard_token');
}

export async function fetchUser() {
  const token = getToken();
  if (!token) return null;
  
  let role = 'farmer';
  if (token.includes('admin')) role = 'admin';
  else if (token.includes('middleman')) role = 'middleman';
  else if (token.includes('consumer')) role = 'consumer';

  return { email: 'demo@milkguard.com', role: role, id: 1 };
}

export async function getFlags() {
  const token = getToken();
  const response = await fetch(`${API_BASE}/flags`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
  if (!response.ok) throw new Error('Failed to fetch flags');
  return response.json();
}

export async function getTraceability(batchId, direction = 'backward') {
  const response = await fetch(`${API_BASE}/traceability/${direction}/${batchId}`);
  if (!response.ok) throw new Error(`Traceability ${direction} failed`);
  return response.json();
}

export async function getGovernmentReport(batchId) {
  const response = await fetch(`${API_BASE}/government/report/${batchId}`);
  if (!response.ok) throw new Error('Failed to fetch government report');
  return response.json();
}

export async function submitQualityReport(report) {
  const token = getToken();
  const response = await fetch(`${API_BASE}/quality-reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(report)
  });
  if (!response.ok) throw new Error('Failed to submit quality report');
  return response.json();
}

export async function submitCollectionEvent(event) {
  const response = await fetch(`${API_BASE}/engine-a/collection-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
  if (!response.ok) throw new Error('Failed to submit collection event');
  return response.json();
}

export async function submitCenterEvent(event) {
  const response = await fetch(`${API_BASE}/engine-a/center-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
  if (!response.ok) throw new Error('Failed to submit center event');
  return response.json();
}

export async function quickCheckEstimate(params) {
  const response = await fetch(`${API_BASE}/quick-check/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) throw new Error('Quick Check failed');
  return response.json();
}

export async function fetchConsumerScan(batchId) {
  const response = await fetch(`${API_BASE}/consumer/scan/${batchId}`);
  if (!response.ok) throw new Error('Scan failed or batch not found');
  return response.json();
}

export async function getDashboardSummary() {
  const token = getToken();
  const response = await fetch(`${API_BASE}/dashboard/summary`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
  if (!response.ok) throw new Error('Failed to fetch dashboard summary');
  return response.json();
}

export async function getCollectionTrends(days = 7) {
  const token = getToken();
  const response = await fetch(`${API_BASE}/dashboard/collection-trends?days=${days}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
  if (!response.ok) throw new Error('Failed to fetch collection trends');
  return response.json();
}

export async function getRecentBatches(limit = 10) {
  const token = getToken();
  const response = await fetch(`${API_BASE}/batches/recent?limit=${limit}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
  if (!response.ok) throw new Error('Failed to fetch recent batches');
  return response.json();
}

export async function getLiveLocations() {
  const token = getToken();
  const response = await fetch(`${API_BASE}/operations/live-locations`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
  if (!response.ok) throw new Error('Failed to fetch live locations');
  return response.json();
}
