import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatINR } from '../../lib/format'

function validateGST(gst) {
  if (!gst) return true
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst.toUpperCase())
}

function AddPartyModal({ partyType, onClose, onAdded }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [gst, setGst] = useState('')
  const [creditDays, setCreditDays] = useState(7)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gstError, setGstError] = useState('')

  function handleGstChange(val) {
    setGst(val.toUpperCase())
    if (val && !validateGST(val)) {
      setGstError('Invalid GST format (e.g. 09AABCU9603R1ZV)')
    } else {
      setGstError('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    if (gst && !validateGST(gst)) { setError('Fix the GST number first.'); return }
    setLoading(true)
    try {
      const party = await api.createParty({
        name: name.trim(),
        party_type: partyType,
        phone: phone.trim() || null,
        gst_number: gst.trim() || null,
        notes: notes.trim() || null,
        credit_period_days: Number(creditDays),
      })
      onAdded(party)
      onClose()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <div className="bg-paper border border-rule rounded-sm w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-rule">
          <h3 className="font-display text-lg font-medium">Add {partyType === 'supplier' ? 'Supplier' : 'Customer'}</h3>
          <button onClick={onClose} className="text-stone hover:text-ink text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Name *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder={partyType === 'supplier' ? 'Amul, Britannia…' : 'Sharma Bakery…'}
              className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink transition-colors placeholder:text-stone/50" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="9876543210"
              className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink transition-colors placeholder:text-stone/50" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">
              GST Number <span className="normal-case tracking-normal text-stone/60">(optional)</span>
            </label>
            <input value={gst} onChange={e => handleGstChange(e.target.value)}
              placeholder="09AABCU9603R1ZV"
              maxLength={15}
              className={`w-full bg-transparent border rounded-sm px-3 py-2.5 text-sm focus:outline-none transition-colors placeholder:text-stone/50 font-mono ${gstError ? 'border-due focus:border-due' : 'border-rule focus:border-ink'}`} />
            {gstError && <p className="text-due text-xs mt-1">{gstError}</p>}
            {gst && !gstError && <p className="text-settled text-xs mt-1">✓ Valid format</p>}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Credit period (days)</label>
            <input type="number" min={1} value={creditDays} onChange={e => setCreditDays(e.target.value)}
              className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink transition-colors" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional"
              className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink transition-colors resize-none placeholder:text-stone/50" />
          </div>

          {error && <p className="text-due text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-rule text-sm py-2.5 rounded-sm hover:bg-paperdim transition-colors">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-ink text-paper text-sm py-2.5 rounded-sm hover:bg-ink/90 disabled:opacity-50 transition-opacity">
              {loading ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PartyList({ partyType }) {
  const navigate = useNavigate()
  const [parties, setParties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const label = partyType === 'supplier' ? 'Supplier' : 'Customer'

  const fetchParties = useCallback(() => {
    setLoading(true)
    api.listParties({ party_type: partyType }).then(setParties).finally(() => setLoading(false))
  }, [partyType])

  useEffect(() => { fetchParties() }, [fetchParties])

  const filtered = parties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  async function handleDelete(e, id) {
    e.stopPropagation()
    if (!confirm('Delete this party and all their transactions?')) return
    await api.deleteParty(id)
    setParties(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-medium">{label}s</h1>
          <p className="text-stone text-sm mt-1">{parties.length} {label.toLowerCase()}{parties.length !== 1 ? 's' : ''} in your ledger</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex-shrink-0 bg-ink text-paper px-4 py-2.5 text-sm rounded-sm hover:bg-ink/90 transition-opacity">
          + Add {label}
        </button>
      </div>

      {parties.length > 4 && (
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}s…`}
          className="w-full max-w-sm bg-transparent border border-rule rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-ink mb-5 placeholder:text-stone/50" />
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-rule/40 rounded-sm animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="border border-rule border-dashed rounded-sm p-12 text-center">
          <p className="font-display text-xl text-stone mb-2">{search ? 'No matches' : `No ${label.toLowerCase()}s yet`}</p>
          {!search && <button onClick={() => setShowAdd(true)} className="text-sm text-ink underline underline-offset-2 mt-1">Add your first {label.toLowerCase()}</button>}
        </div>
      ) : (
        <div className="border border-rule rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paperdim">
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium">Name</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium hidden sm:table-cell">Phone</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium hidden lg:table-cell">GST</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium hidden md:table-cell">Risk</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium hidden md:table-cell">Age</th>
                <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium">Balance</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} onClick={() => navigate(`/party/${p.id}`)}
                  className={`border-b border-rule last:border-0 hover:bg-paperdim transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-paper/40' : ''}`}>
                  <td className="px-5 py-3.5 font-medium">{p.name}</td>
                  <td className="px-5 py-3.5 text-stone hidden sm:table-cell">{p.phone || '—'}</td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    {p.gst_number
                      ? <span className="font-mono text-xs text-stone">{p.gst_number}</span>
                      : <span className="text-stone text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    {p.risk_label
                      ? <span className={`text-xs font-medium ${p.risk_label === 'HIGH' ? 'text-due' : p.risk_label === 'MEDIUM' ? 'text-yellow-600' : 'text-settled'}`}>
                          {p.risk_label === 'HIGH' ? '⬤' : p.risk_label === 'MEDIUM' ? '◐' : '○'} {p.risk_label}
                        </span>
                      : <span className="text-stone text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    {p.days_outstanding
                      ? <span className={`text-xs ${p.days_outstanding > 30 ? 'text-due font-medium' : p.days_outstanding > 14 ? 'text-yellow-600' : 'text-stone'}`}>{p.days_outstanding}d</span>
                      : <span className="text-stone text-xs">—</span>}
                  </td>
                  <td className={`px-5 py-3.5 text-right font-display font-medium num ${Number(p.balance) === 0 ? 'text-stone' : partyType === 'customer' ? 'text-settled' : 'text-due'}`}>
                    {Number(p.balance) === 0 ? '—' : formatINR(p.balance)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={e => handleDelete(e, p.id)} className="text-stone hover:text-due text-xs transition-colors">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddPartyModal partyType={partyType} onClose={() => setShowAdd(false)} onAdded={p => setParties(prev => [...prev, p])} />}
    </div>
  )
}
