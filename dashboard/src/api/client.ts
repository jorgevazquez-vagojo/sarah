const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('agent_token');
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('agent_token');
    window.location.reload();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request('/agents/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe: () => request('/agents/me'),

  // Agent
  setStatus: (status: string) =>
    request('/agents/status', { method: 'PATCH', body: JSON.stringify({ status }) }),
  getQueue: () => request('/agents/queue'),

  // Leads
  getLeads: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/leads${qs}`);
  },
  updateLead: (id: string, data: Record<string, any>) =>
    request(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Analytics
  getAnalytics: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/analytics${qs}`);
  },

  // Config / Theme
  getThemes: () => request('/config/theme'),
  updateTheme: (id: string, config: any) =>
    request(`/config/theme/${id}`, { method: 'PUT', body: JSON.stringify({ config }) }),

  // Canned Responses
  getCannedResponses: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/config/canned${qs}`);
  },
  createCannedResponse: (data: any) =>
    request('/config/canned', { method: 'POST', body: JSON.stringify(data) }),
  deleteCannedResponse: (id: string) =>
    request(`/config/canned/${id}`, { method: 'DELETE' }),

  // Webhooks
  getWebhooks: () => request('/config/webhooks'),
  createWebhook: (data: any) =>
    request('/config/webhooks', { method: 'POST', body: JSON.stringify(data) }),

  // Health
  getHealth: () => request('/health'),
};

export function createAgentWS(token: string): WebSocket {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${proto}//${window.location.host}/ws/agent?token=${token}`);
}
