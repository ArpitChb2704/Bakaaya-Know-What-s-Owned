const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function getToken() { return localStorage.getItem('bakaaya_token') }
export function setToken(t) { localStorage.setItem('bakaaya_token', t) }
export function clearToken() { localStorage.removeItem('bakaaya_token'); localStorage.removeItem('bakaaya_business_name'); localStorage.removeItem('bakaaya_role') }

async function request(path, { method = 'GET', body, auth = true, isForm = false } = {}) {
  const headers = {}
  if (!isForm) headers['Content-Type'] = 'application/json'
  if (auth) { const t = getToken(); if (t) headers['Authorization'] = `Bearer ${t}` }
  const res = await fetch(`${API_URL}${path}`, {
    method, headers,
    body: isForm ? body : (body ? JSON.stringify(body) : undefined),
  })
  if (!res.ok) {
    let detail = 'Something went wrong.'
    try { const err = await res.json(); detail = err.detail || detail } catch {}
    throw new Error(detail)
  }
  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('text/html')) return res.text()
  return res.json()
}
async function getStatementPdf(body) {
  const headers = { 'Content-Type': 'application/json' }
  const t = getToken()
  if (t) headers['Authorization'] = `Bearer ${t}`
  const res = await fetch(`${API_URL}/api/analytics/statement`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = 'Something went wrong.'
    try { const err = await res.json(); detail = err.detail || detail } catch {}
    throw new Error(detail)
  }
  return res.arrayBuffer()
}

async function getInvoicePdf(transactionId) {
  const headers = {}
  const t = getToken()
  if (t) headers['Authorization'] = `Bearer ${t}`
  const res = await fetch(`${API_URL}/api/transactions/${transactionId}/invoice`, {
    method: 'GET',
    headers,
  })
  if (!res.ok) {
    let detail = 'Something went wrong.'
    try { const err = await res.json(); detail = err.detail || detail } catch {}
    throw new Error(detail)
  }
  return res.arrayBuffer()
}

export const api = {
  // auth
  signup: (d) => request('/api/auth/signup', { method: 'POST', body: d, auth: false }),
  login: (d) => request('/api/auth/login', { method: 'POST', body: d, auth: false }),
  inviteTeam: (d) => request('/api/auth/team/invite', { method: 'POST', body: d }),
  acceptInvite: (d) => request('/api/auth/team/accept', { method: 'POST', body: d, auth: false }),
  listTeam: () => request('/api/auth/team'),
  removeTeamMember: (id) => request(`/api/auth/team/${id}`, { method: 'DELETE' }),

  // parties
  listParties: (p = {}) => request(`/api/parties?${new URLSearchParams(p)}`),
  createParty: (d) => request('/api/parties', { method: 'POST', body: d }),
  getParty: (id) => request(`/api/parties/${id}`),
  updateParty: (id, d) => request(`/api/parties/${id}`, { method: 'PATCH', body: d }),
  deleteParty: (id) => request(`/api/parties/${id}`, { method: 'DELETE' }),
  refreshRisk: (id) => request(`/api/parties/${id}/risk`, { method: 'POST' }),

  // transactions
  listTransactions: (p = {}) => request(`/api/transactions?${new URLSearchParams(p)}`),
  checkDuplicate: (d) => request('/api/transactions/check-duplicate', { method: 'POST', body: d }),
  createTransaction: (d) => request('/api/transactions', { method: 'POST', body: d }),
  updateTransaction: (id, d) => request(`/api/transactions/${id}`, { method: 'PATCH', body: d }),
  deleteTransaction: (id) => request(`/api/transactions/${id}`, { method: 'DELETE' }),
  approveTransaction: (id) => request(`/api/transactions/${id}/approve`, { method: 'POST' }),


  // skus
  listSkus: () => request('/api/skus'),
  createSku: (d) => request('/api/skus', { method: 'POST', body: d }),
  updateSku: (id, d) => request(`/api/skus/${id}`, { method: 'PATCH', body: d }),
  archiveSku: (id) => request(`/api/skus/${id}`, { method: 'DELETE' }),

  // invoice
  getInvoicePdf: getInvoicePdf,

  // Sales report
  getSalesReport: (p = {}) => request(`/api/analytics/sales-report?${new URLSearchParams(p)}`),

  // dashboard
  getSummary: () => request('/api/dashboard/summary'),
  getCalendar: () => request('/api/dashboard/calendar'),

  // smart entry
  parseEntry: (text) => request('/api/smart-entry/parse', { method: 'POST', body: { text } }),
  confirmEntry: (parsed) => request('/api/smart-entry/confirm', { method: 'POST', body: parsed }),

  // chat
  ask: (question) => request('/api/chat', { method: 'POST', body: { question } }),

  // reminders
  listReminders: (p = {}) => request(`/api/reminders?${new URLSearchParams(p)}`),
  createReminder: (d) => request('/api/reminders', { method: 'POST', body: d }),
  updateReminder: (id, d) => request(`/api/reminders/${id}`, { method: 'PATCH', body: d }),
  deleteReminder: (id) => request(`/api/reminders/${id}`, { method: 'DELETE' }),

  // bank import
  uploadStatement: (file) => {
    const form = new FormData(); form.append('file', file)
    return request('/api/bank-import/upload', { method: 'POST', body: form, isForm: true })
  },
  confirmBankImport: (matches) => request('/api/bank-import/confirm', { method: 'POST', body: { matches } }),

  // analytics
  getCashflow: () => request('/api/analytics/cashflow'),
  getSupplierScores: () => request('/api/analytics/supplier-scores'),
  getStatement: getStatementPdf,
  generateUpiLink: (d) => request('/api/analytics/upi-link', { method: 'POST', body: d }),
}
