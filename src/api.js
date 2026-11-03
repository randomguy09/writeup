// Anonymous, per-browser identity (replaces Firebase anonymous auth).
const KEY = 'ctf-portfolio-owner-id';

export function getOwnerId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-owner-id': getOwnerId(),
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  list: () => request('/api/writeups'),
  create: (body) => request('/api/writeups', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/api/writeups/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id) => request(`/api/writeups/${id}`, { method: 'DELETE' }),
};
