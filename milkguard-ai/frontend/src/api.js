const API_BASE = 'http://localhost:8000';

export function getToken() {
  return sessionStorage.getItem('milkguard_token');
}

export function logout() {
  sessionStorage.removeItem('milkguard_token');
}

async function fetchWithAuth(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });
  
  if (response.status === 401) {
    logout();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export async function login(username, password) {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);

  const response = await fetch(`${API_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });

  if (!response.ok) throw new Error('Login failed');
  const data = await response.json();
  sessionStorage.setItem('milkguard_token', data.access_token);
  return data.access_token;
}

export async function fetchUser() {
  const token = getToken();
  if (!token) return null;
  
  try {
    return await fetchWithAuth('/users/me');
  } catch (err) {
    return null;
  }
}

export async function getUsers(role = null) {
  const query = role ? `?role=${role}` : '';
  return fetchWithAuth(`/users${query}`);
}

export async function getFlags() {
  return fetchWithAuth('/flags');
}

export async function getTraceability(batchId, direction = 'backward') {
  // Public endpoint or depends on auth? Traceability is public according to main.py
  // Wait, backward/forward trace doesn't explicitly have Depends(auth), but let's just use fetch
  const response = await fetch(`${API_BASE}/traceability/${direction}/${batchId}`);
  if (!response.ok) throw new Error(`Traceability ${direction} failed`);
  return response.json();
}

export async function getGovernmentReport(batchId) {
  return fetchWithAuth(`/government/report/${batchId}`);
}

export async function submitQualityReport(report) {
  return fetchWithAuth('/quality-reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report)
  });
}

export async function submitCollectionEvent(event) {
  // Wait, engine-a endpoints don't have Depends(auth) in main.py, but they might in the future.
  // It's safer to just use fetchWithAuth for all of them so headers are attached if needed.
  return fetchWithAuth('/engine-a/collection-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
}

export async function submitCenterEvent(event) {
  return fetchWithAuth('/engine-a/center-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
}

export async function submitFactoryEvent(event) {
  return fetchWithAuth('/engine-a/factory-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
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

export async function getChain(batchId) {
  const response = await fetch(`${API_BASE}/chain/${batchId}`);
  if (!response.ok) throw new Error('Chain fetch failed');
  return response.json();
}

export async function getDashboardSummary() {
  return fetchWithAuth('/dashboard/summary');
}

export async function getCollectionTrends(days = 7) {
  return fetchWithAuth(`/dashboard/collection-trends?days=${days}`);
}

export async function getRecentBatches(limit = 10) {
  return fetchWithAuth(`/batches/recent?limit=${limit}`);
}

export async function getLiveLocations() {
  return fetchWithAuth('/operations/live-locations');
}
