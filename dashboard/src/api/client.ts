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
  login: (username: string, password: string) =>
    request('/agents/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  getMe: () => request('/agents/me'),

  setStatus: (status: string) =>
    request('/agents/status', { method: 'PATCH', body: JSON.stringify({ status }) }),

  getQueue: () => request('/agents/queue'),

  getLeads: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/leads${qs}`);
  },

  updateLead: (id: string, data: Record<string, any>) =>
    request(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getAnalytics: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/analytics${qs}`);
  },
};

export function createAgentWS(token: string): WebSocket {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${proto}//${window.location.host}/ws/agent?token=${token}`);
}
