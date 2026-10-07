import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, getAdminToken, clearAdminToken } from '../../lib/adminApi'

function StatusBadge({ status, daysLeft }) {
  if (status === 'suspended') return <span className="text-xs font-bold px-2 py-0.5 rounded-sm text-due bg-due/10">Suspended</span>
  if (daysLeft != null && daysLeft < 0) return <span className="text-xs font-bold px-2 py-0.5 rounded-sm text-due bg-due/10">Expired</span>
  if (daysLeft != null && daysLeft <= 10) return <span className="text-xs font-bold px-2 py-0.5 rounded-sm text-yellow-700 bg-yellow-50">{daysLeft}d left</span>
  return <span className="text-xs font-bold px-2 py-0.5 rounded-sm text-settled bg-settled/10">Active</span>
}

function daysLeft(validUntil) {
  if (!validUntil) return null
  const diff = Math.ceil((new Date(validUntil) - new Date()) / (1000 * 60 * 60 * 24))
  return diff
}

function BusinessDetail({ business, onClose, onChanged }) {
  const [form, setForm] = useState({ business_name: business.business_name || '', email: business.email })
  const [paymentAmount, setPaymentAmount] = useState('')
  const [planType, setPlanType] = useState('monthly')
  const [notes, setNotes] = useState('')
  const [tempPassword, setTempPassword] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSaveInfo() {
    setBusy(true); setError('')
    try {
      await adminApi.updateBusiness(business.id, form)
      onChanged()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function handleRecordPayment() {
    setBusy(true); setError('')
    try {
      await adminApi.recordPayment(business.id, {
        amount: Number(paymentAmount), plan_type: planType, notes: notes || null,
      })
      setPaymentAmount(''); setNotes('')
      onChanged()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function handleSuspendToggle() {
    setBusy(true); setError('')
    try {
      if (business.plan_status === 'suspended') {
        await adminApi.reactivate(business.id)
      } else {
        await adminApi.suspend(business.id)
      }
      onChanged()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function handleResetPassword() {
    if (!confirm('Generate a new temporary password for this business?')) return
    setBusy(true); setError('')
    try {
      const res = await adminApi.resetPassword(business.id)
      setTempPassword(res.temp_password)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <div className="bg-paper border border-rule rounded-sm w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-rule">
          <h3 className="font-display text-lg font-medium">{business.business_name || business.email}</h3>
          <button onClick={onClose} className="text-stone hover:text-ink text-xl">×</button>
        </div>

        <div className="p-6 space-y-6">
          {error && <div className="bg-due/10 border border-due/30 rounded-sm p-3 text-sm text-due">{error}</div>}

          {tempPassword && (
            <div className="bg-settled/10 border border-settled/30 rounded-sm p-3 text-sm">
              New temporary password: <strong className="select-all">{tempPassword}</strong>
              <p className="text-xs text-stone mt-1">Share this with the business owner manually. It won't be shown again.</p>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-widest text-stone mb-2">Business Info</p>
            <input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              placeholder="Business name"
              className="w-full border border-rule rounded-sm px-3 py-2 mb-2 bg-transparent text-sm" />
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email"
              className="w-full border border-rule rounded-sm px-3 py-2 mb-2 bg-transparent text-sm" />
            <button onClick={handleSaveInfo} disabled={busy} className="text-sm border border-rule px-3 py-1.5 rounded-sm hover:bg-paperdim disabled:opacity-50">
              Save
            </button>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-stone mb-2">Plan Status</p>
            <div className="flex items-center gap-3 mb-3">
              <StatusBadge status={business.plan_status} daysLeft={daysLeft(business.plan_valid_until)} />
              <span className="text-sm text-stone">
                {business.plan_valid_until ? `Valid until ${business.plan_valid_until}` : 'No plan set'}
              </span>
            </div>
            <button onClick={handleSuspendToggle} disabled={busy}
              className="text-sm border border-rule px-3 py-1.5 rounded-sm hover:bg-paperdim disabled:opacity-50">
              {business.plan_status === 'suspended' ? 'Reactivate' : 'Suspend'}
            </button>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-stone mb-2">Record Payment</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input type="number" placeholder="Amount" value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                className="border border-rule rounded-sm px-3 py-2 bg-transparent text-sm" />
              <select value={planType} onChange={e => setPlanType(e.target.value)}
                className="border border-rule rounded-sm px-3 py-2 bg-transparent text-sm">
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-rule rounded-sm px-3 py-2 mb-2 bg-transparent text-sm" />
            <button onClick={handleRecordPayment} disabled={busy || !paymentAmount}
              className="bg-ink text-paper px-3 py-1.5 rounded-sm text-sm disabled:opacity-50">
              Record Payment & Extend Plan
            </button>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-stone mb-2">Password</p>
            <button onClick={handleResetPassword} disabled={busy}
              className="text-sm border border-rule px-3 py-1.5 rounded-sm hover:bg-paperdim disabled:opacity-50">
              Generate New Password
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  function load() {
    setLoading(true)
    adminApi.listBusinesses().then(setBusinesses).catch(err => {
      if (err.message.includes('credentials') || err.message.includes('validate')) {
        clearAdminToken()
        navigate('/admin/login')
      }
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!getAdminToken()) { navigate('/admin/login'); return }
    load()
  }, [])

  function handleLogout() {
    clearAdminToken()
    navigate('/admin/login')
  }

  async function refreshSelected() {
    if (!selected) return
    const fresh = await adminApi.getBusiness(selected.id)
    setSelected(fresh)
    load()
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-medium">Admin — Businesses</h1>
        <button onClick={handleLogout} className="text-stone hover:text-ink text-sm">Log out</button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-rule/40 rounded-sm animate-pulse" />)}</div>
      ) : businesses.length === 0 ? (
        <p className="text-stone text-sm">No businesses yet.</p>
      ) : (
        <div className="border border-rule rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-paperdim border-b border-rule">
                {['Business', 'Email', 'Status', 'Valid Until', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs uppercase tracking-widest text-stone font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {businesses.map((b, i) => (
                <tr key={b.id} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paperdim ${i % 2 === 1 ? 'bg-paper/40' : ''}`}
                  onClick={() => setSelected(b)}>
                  <td className="px-5 py-3.5">{b.business_name || '—'}</td>
                  <td className="px-5 py-3.5 text-stone">{b.email}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={b.plan_status} daysLeft={daysLeft(b.plan_valid_until)} /></td>
                  <td className="px-5 py-3.5 text-stone">{b.plan_valid_until || '—'}</td>
                  <td className="px-5 py-3.5 text-right text-xs text-stone">View →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <BusinessDetail business={selected} onClose={() => setSelected(null)} onChanged={refreshSelected} />
      )}
    </div>
  )
}