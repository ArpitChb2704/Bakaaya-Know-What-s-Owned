const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function getAdminToken() { return localStorage.getItem('bakaaya_admin_token') }
export function setAdminToken(t) { localStorage.setItem('bakaaya_admin_token', t) }
export function clearAdminToken() { localStorage.removeItem('bakaaya_admin_token') }

async function adminRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) { const t = getAdminToken(); if (t) headers['Authorization'] = `Bearer ${t}` }
  const res = await fetch(`${API_URL}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let detail = 'Something went wrong.'
    try { const err = await res.json(); detail = err.detail || detail } catch {}
    throw new Error(detail)
  }
  if (res.status === 204) return null
  return res.json()
}

export const adminApi = {
  login: async (email, password) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    const res = await fetch(`${API_URL}/api/admin/login`, { method: 'POST', body: form })
    if (!res.ok) {
      let detail = 'Invalid admin credentials'
      try { const err = await res.json(); detail = err.detail || detail } catch {}
      throw new Error(detail)
    }
    return res.json()
  },
  listBusinesses: () => adminRequest('/api/admin/businesses'),
  getBusiness: (id) => adminRequest(`/api/admin/businesses/${id}`),
  updateBusiness: (id, d) => adminRequest(`/api/admin/businesses/${id}`, { method: 'PATCH', body: d }),
  recordPayment: (id, d) => adminRequest(`/api/admin/businesses/${id}/payment`, { method: 'POST', body: d }),
  suspend: (id) => adminRequest(`/api/admin/businesses/${id}/suspend`, { method: 'POST' }),
  reactivate: (id) => adminRequest(`/api/admin/businesses/${id}/reactivate`, { method: 'POST' }),
  resetPassword: (id) => adminRequest(`/api/admin/businesses/${id}/reset-password`, { method: 'POST' }),
}