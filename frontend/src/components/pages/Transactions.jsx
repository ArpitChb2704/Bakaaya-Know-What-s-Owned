import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { formatINR, formatDate } from '../../lib/format'

const TYPE_META = {
  bill:        { label: 'Bill',        color: 'text-due',     bg: 'bg-due/10'     },
  payment_out: { label: 'Payment out', color: 'text-settled', bg: 'bg-settled/10' },
  sale:        { label: 'Sale',        color: 'text-settled', bg: 'bg-settled/10' },
  payment_in:  { label: 'Payment in',  color: 'text-due',     bg: 'bg-due/10'     },
}

function EditModal({ txn, partyName, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(txn.amount))
  const [txnDate, setTxnDate] = useState(txn.transaction_date)
  const [notes, setNotes] = useState(txn.notes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const meta = TYPE_META[txn.transaction_type]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return }
    setLoading(true)
    try {
      const updated = await api.updateTransaction(txn.id, { amount: Number(amount), transaction_date: txnDate, notes: notes.trim() || null })
      onSaved(updated); onClose()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <div className="bg-paper border border-rule rounded-sm w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-rule">
          <div>
            <h3 className="font-display text-lg font-medium">Edit Transaction</h3>
            <p className="text-stone text-xs mt-0.5"><span className={`${meta.color} font-medium`}>{meta.label}</span> · {partyName}</p>
          </div>
          <button onClick={onClose} className="text-stone hover:text-ink text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Amount (₹)</label>
            <input type="number" min="0.01" step="0.01" autoFocus value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Date</label>
            <input type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)}
              className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Invoice #, item name…"
              className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink placeholder:text-stone/50" />
          </div>
          {error && <p className="text-due text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-rule text-sm py-2.5 rounded-sm hover:bg-paperdim">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-ink text-paper text-sm py-2.5 rounded-sm hover:bg-ink/90 disabled:opacity-50">{loading ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LogModal({ parties, onClose, onAdded }) {
  const [partyId, setPartyId] = useState('')
  const [txnType, setTxnType] = useState('')
  const [amount, setAmount] = useState('')
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState(null)

  const selectedParty = parties.find(p => p.id === Number(partyId))
  const availableTypes = selectedParty
    ? selectedParty.party_type === 'supplier'
      ? [{ value: 'bill', label: 'Bill received (you owe more)' }, { value: 'payment_out', label: 'Payment made (you owe less)' }]
      : [{ value: 'sale', label: 'Sale / credit (they owe more)' }, { value: 'payment_in', label: 'Payment received (they owe less)' }]
    : []

  async function checkDuplicate() {
    if (!partyId || !txnType || !amount || Number(amount) <= 0) return
    try {
      const res = await api.checkDuplicate({ party_id: Number(partyId), transaction_type: txnType, amount: Number(amount), transaction_date: txnDate })
      setDuplicate(res.is_duplicate ? res : null)
    } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!partyId || !txnType || !amount || Number(amount) <= 0) { setError('Fill all fields.'); return }
    setLoading(true)
    try {
      const txn = await api.createTransaction({ party_id: Number(partyId), transaction_type: txnType, amount: Number(amount), transaction_date: txnDate, notes: notes.trim() || null })
      onAdded(txn); onClose()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <div className="bg-paper border border-rule rounded-sm w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-rule">
          <h3 className="font-display text-lg font-medium">Log Transaction</h3>
          <button onClick={onClose} className="text-stone hover:text-ink text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Party</label>
            <select value={partyId} onChange={e => { setPartyId(e.target.value); setTxnType(''); setDuplicate(null) }}
              className="w-full bg-paper border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink">
              <option value="">Select…</option>
              <optgroup label="Suppliers">{parties.filter(p => p.party_type === 'supplier').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
              <optgroup label="Customers">{parties.filter(p => p.party_type === 'customer').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
            </select>
          </div>
          {selectedParty && (
            <div>
              <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Type</label>
              <select value={txnType} onChange={e => setTxnType(e.target.value)}
                className="w-full bg-paper border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink">
                <option value="">Select…</option>
                {availableTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Amount (₹)</label>
            <input type="number" min="0.01" step="0.01" value={amount}
              onChange={e => { setAmount(e.target.value); setDuplicate(null) }}
              onBlur={checkDuplicate}
              className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink placeholder:text-stone/50" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Date</label>
            <input type="date" value={txnDate} onChange={e => { setTxnDate(e.target.value); setDuplicate(null) }} onBlur={checkDuplicate}
              className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Invoice #, item name…"
              className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink placeholder:text-stone/50" />
          </div>

          {/* Duplicate warning */}
          {duplicate && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-sm p-3">
              <p className="text-yellow-800 text-sm font-medium">⚠ Possible duplicate detected</p>
              <p className="text-yellow-700 text-xs mt-1">A similar transaction already exists on {formatDate(duplicate.existing_date)}{duplicate.existing_notes ? ` — "${duplicate.existing_notes}"` : ''}. Is this the same one?</p>
              <p className="text-yellow-600 text-xs mt-1">You can still save if it's a different transaction.</p>
            </div>
          )}

          {error && <p className="text-due text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-rule text-sm py-2.5 rounded-sm hover:bg-paperdim">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-ink text-paper text-sm py-2.5 rounded-sm hover:bg-ink/90 disabled:opacity-50">{loading ? 'Saving…' : duplicate ? 'Save anyway' : 'Log it'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [parties, setParties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([api.listTransactions({ limit: 200 }), api.listParties()])
      .then(([t, p]) => { setTransactions(t); setParties(p) })
      .finally(() => setLoading(false))
  }, [])

  const partyName = id => parties.find(p => p.id === id)?.name || '—'
  const filtered = transactions.filter(t =>
    !search || partyName(t.party_id).toLowerCase().includes(search.toLowerCase()) ||
    (t.notes || '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete(id) {
    if (!confirm('Delete this transaction?')) return
    await api.deleteTransaction(id)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-medium">Transactions</h1>
          <p className="text-stone text-sm mt-1">Every bill, sale and payment</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex-shrink-0 bg-ink text-paper px-4 py-2.5 text-sm rounded-sm hover:bg-ink/90 transition-opacity">+ Log transaction</button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by party or notes…"
        className="w-full max-w-sm bg-transparent border border-rule rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-ink mb-5 placeholder:text-stone/50" />

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-rule/40 rounded-sm animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="border border-rule border-dashed rounded-sm p-12 text-center">
          <p className="font-display text-xl text-stone mb-2">{search ? 'No matches' : 'No transactions yet'}</p>
          {!search && <button onClick={() => setShowAdd(true)} className="text-sm text-ink underline underline-offset-2">Log your first transaction</button>}
        </div>
      ) : (
        <div className="border border-rule rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paperdim">
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium">Date</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium">Party</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium hidden sm:table-cell">Type</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium hidden md:table-cell">Notes</th>
                <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium">Amount</th>
                <th className="px-5 py-3 text-right text-xs uppercase tracking-widest text-stone font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const meta = TYPE_META[t.transaction_type]
                return (
                  <tr key={t.id} className={`border-b border-rule last:border-0 hover:bg-paperdim transition-colors ${i % 2 === 1 ? 'bg-paper/40' : ''} ${t.requires_approval ? 'border-l-2 border-l-yellow-400' : ''}`}>
                    <td className="px-5 py-3.5 text-stone text-xs whitespace-nowrap">{formatDate(t.transaction_date)}</td>
                    <td className="px-5 py-3.5 font-medium">{partyName(t.party_id)}</td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-sm ${meta.bg} ${meta.color}`}>{meta.label}</span>
                      {t.requires_approval && <span className="ml-2 text-xs text-yellow-600 font-medium">⏳ Pending approval</span>}
                    </td>
                    <td className="px-5 py-3.5 text-stone hidden md:table-cell truncate max-w-xs">{t.notes || '—'}</td>
                    <td className={`px-5 py-3.5 text-right font-display font-medium num ${meta.color}`}>{formatINR(t.amount)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => setEditing(t)} className="text-stone hover:text-ink text-xs underline underline-offset-2">Edit</button>
                        <button onClick={() => handleDelete(t.id)} className="text-stone hover:text-due text-xs">Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <LogModal parties={parties} onClose={() => setShowAdd(false)} onAdded={t => setTransactions(prev => [t, ...prev])} />}
      {editing && <EditModal txn={editing} partyName={partyName(editing.party_id)} onClose={() => setEditing(null)} onSaved={u => setTransactions(prev => prev.map(t => t.id === u.id ? u : t))} />}
    </div>
  )
}
