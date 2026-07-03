import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatINR, formatDate } from '../../lib/format'

const TYPE_META = {
  bill:        { label: 'Bill',        sign: '+', color: 'text-due'     },
  payment_out: { label: 'Payment out', sign: '−', color: 'text-settled' },
  sale:        { label: 'Sale',        sign: '+', color: 'text-settled' },
  payment_in:  { label: 'Payment in',  sign: '−', color: 'text-due'     },
}

const REMINDER_STATUSES = [
  { value: 'called', label: '📞 Called' },
  { value: 'visited', label: '🚶 Visited' },
  { value: 'email_sent', label: '📧 Email sent' },
  { value: 'payment_promised', label: '🤝 Promised' },
  { value: 'paid', label: '✅ Paid' },
]

function RiskBadge({ label, score, reasons }) {
  if (!label) return null
  const colors = { LOW: 'text-settled bg-settled/10', MEDIUM: 'text-yellow-700 bg-yellow-50', HIGH: 'text-due bg-due/10' }
  const icons = { LOW: '○', MEDIUM: '◐', HIGH: '⬤' }
  const parsed = (() => { try { return JSON.parse(reasons || '[]') } catch { return [] } })()
  return (
    <div className={`inline-flex flex-col gap-1 px-3 py-2 rounded-sm text-xs font-medium ${colors[label]}`}>
      <span>{icons[label]} Risk: {label} ({Math.round(score || 0)}/100)</span>
      {parsed.map((r, i) => <span key={i} className="opacity-70">• {r}</span>)}
    </div>
  )
}

function UPIModal({ party, balance, onClose }) {
  const [upiId, setUpiId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    if (!upiId.trim()) { setError('Enter your UPI ID'); return }
    setLoading(true)
    try {
      const res = await api.generateUpiLink({ party_id: party.id, upi_id: upiId.trim() })
      setResult(res)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <div className="bg-paper border border-rule rounded-sm w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-rule">
          <h3 className="font-display text-lg font-medium">Payment Link</h3>
          <button onClick={onClose} className="text-stone hover:text-ink text-xl">×</button>
        </div>
        <div className="p-6">
          {!result ? (
            <div className="space-y-4">
              <p className="text-sm text-stone">Generate a UPI payment link for <strong>{party.name}</strong> — outstanding {formatINR(balance)}</p>
              <div>
                <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Your UPI ID</label>
                <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi"
                  className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink placeholder:text-stone/50" />
              </div>
              {error && <p className="text-due text-sm">{error}</p>}
              <button onClick={handleGenerate} disabled={loading}
                className="w-full bg-ink text-paper text-sm py-2.5 rounded-sm hover:bg-ink/90 disabled:opacity-50">
                {loading ? 'Generating…' : 'Generate link'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-settled text-sm font-medium">✓ Link generated for {formatINR(result.amount)}</p>
              <div>
                <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">UPI Link</label>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs bg-paperdim border border-rule rounded-sm px-3 py-2 break-all">{result.upi_link}</code>
                  <button onClick={() => navigator.clipboard.writeText(result.upi_link)}
                    className="text-xs border border-rule px-2 py-1 rounded-sm hover:bg-paperdim flex-shrink-0">Copy</button>
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">WhatsApp Message</label>
                <div className="bg-paperdim border border-rule rounded-sm p-3 text-xs whitespace-pre-wrap">{result.whatsapp_message}</div>
                <button onClick={() => navigator.clipboard.writeText(result.whatsapp_message)}
                  className="text-xs text-stone hover:text-ink underline mt-1">Copy message</button>
              </div>
              <button onClick={onClose} className="w-full border border-rule text-sm py-2 rounded-sm hover:bg-paperdim">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatementModal({ party, onClose }) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  async function handleView(viewMode) {
    setLoading(true)
    try {
      const html = await api.getStatement({ party_id: party.id, from_date: fromDate || null, to_date: toDate || null })
      const win = window.open('', '_blank')
      if (viewMode === 'print') {
        win.document.write(html)
        win.document.close()
        win.print()
      } else {
        win.document.write(html)
        win.document.close()
      }
    } catch (err) { alert(err.message) }
    finally { setLoading(false); onClose() }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <div className="bg-paper border border-rule rounded-sm w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-rule">
          <h3 className="font-display text-lg font-medium">Generate Statement</h3>
          <button onClick={onClose} className="text-stone hover:text-ink text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-stone">Professional statement for <strong>{party.name}</strong></p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">From date</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">To date</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => handleView('view')} disabled={loading}
              className="flex-1 border border-rule text-sm py-2.5 rounded-sm hover:bg-paperdim">
              View statement
            </button>
            <button onClick={() => handleView('print')} disabled={loading}
              className="flex-1 bg-ink text-paper text-sm py-2.5 rounded-sm hover:bg-ink/90 disabled:opacity-50">
              {loading ? 'Loading…' : 'Print / PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PartyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [party, setParty] = useState(null)
  const [txns, setTxns] = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [riskLoading, setRiskLoading] = useState(false)
  const [tab, setTab] = useState('ledger')
  const [reminderNote, setReminderNote] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [showUPI, setShowUPI] = useState(false)
  const [showStatement, setShowStatement] = useState(false)

  useEffect(() => {
    Promise.all([api.getParty(id), api.listTransactions({ party_id: id, limit: 200 }), api.listReminders({ party_id: id })])
      .then(([p, t, r]) => { setParty(p); setTxns(t); setReminders(r) })
      .finally(() => setLoading(false))
  }, [id])

  const ledgerRows = (() => {
    const sorted = [...txns].sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date))
    let running = 0
    return sorted.map(t => {
      const isInc = ['bill', 'sale'].includes(t.transaction_type)
      running = isInc ? running + Number(t.amount) : running - Number(t.amount)
      return { ...t, running }
    }).reverse()
  })()

  async function handleRefreshRisk() {
    setRiskLoading(true)
    try {
      const risk = await api.refreshRisk(id)
      setParty(p => ({ ...p, risk_score: risk.risk_score, risk_label: risk.risk_label, risk_reasons: JSON.stringify(risk.risk_reasons) }))
    } finally { setRiskLoading(false) }
  }

  async function handleAddReminder() {
    if (!party) return
    const r = await api.createReminder({ party_id: party.id, notes: reminderNote || null, follow_up_date: followUpDate || null, amount_at_time: party.balance })
    setReminders(prev => [r, ...prev])
    setReminderNote(''); setFollowUpDate('')
  }

  if (loading) return <div className="max-w-4xl mx-auto px-5 py-10"><div className="h-64 bg-rule/40 rounded-sm animate-pulse" /></div>
  if (!party) return <div className="max-w-4xl mx-auto px-5 py-10 text-center"><p className="text-stone">Party not found.</p></div>

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      <button onClick={() => navigate(-1)} className="text-stone text-sm hover:text-ink mb-6 flex items-center gap-1">← Back</button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-3xl font-medium">{party.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-sm uppercase tracking-widest ${party.party_type === 'customer' ? 'bg-settled/10 text-settled' : 'bg-due/10 text-due'}`}>
              {party.party_type}
            </span>
          </div>
          {party.phone && <p className="text-stone text-sm">📞 {party.phone}</p>}
          {party.gst_number && <p className="text-stone text-sm font-mono text-xs mt-0.5">GST: {party.gst_number}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs uppercase tracking-widest text-stone mb-1">Outstanding</p>
          <p className={`font-display text-4xl font-medium num ${party.party_type === 'customer' ? 'text-settled' : 'text-due'}`}>
            {formatINR(party.balance)}
          </p>
          {party.days_outstanding && <p className={`text-xs mt-1 ${party.days_outstanding > 30 ? 'text-due' : 'text-stone'}`}>{party.days_outstanding} days</p>}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setShowStatement(true)}
          className="text-xs border border-rule rounded-sm px-3 py-1.5 hover:bg-paperdim transition-colors">
          📄 Statement / PDF
        </button>
        {party.party_type === 'customer' && Number(party.balance) > 0 && (
          <button onClick={() => setShowUPI(true)}
            className="text-xs border border-rule rounded-sm px-3 py-1.5 hover:bg-paperdim transition-colors">
            💳 Payment link
          </button>
        )}
        <button onClick={handleRefreshRisk} disabled={riskLoading}
          className="text-xs border border-rule rounded-sm px-3 py-1.5 hover:bg-paperdim transition-colors disabled:opacity-50">
          {riskLoading ? 'Analysing…' : '⭐ Refresh risk'}
        </button>
      </div>

      <div className="mb-5">
        <RiskBadge label={party.risk_label} score={party.risk_score} reasons={party.risk_reasons} />
      </div>

      <div className="flex border-b border-rule mb-6 gap-6">
        {['ledger', 'reminders'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${tab === t ? 'border-ink text-ink' : 'border-transparent text-stone hover:text-ink'}`}>
            {t} {t === 'reminders' && reminders.length > 0 && `(${reminders.length})`}
          </button>
        ))}
      </div>

      {tab === 'ledger' && (
        <div>
          {ledgerRows.length === 0 ? (
            <p className="text-stone text-sm text-center py-12">No transactions yet.</p>
          ) : (
            <div>
              {ledgerRows.map((t, i) => {
                const meta = TYPE_META[t.transaction_type]
                const isInc = ['bill', 'sale'].includes(t.transaction_type)
                return (
                  <div key={t.id} className="relative">
                    {i < ledgerRows.length - 1 && <div className="absolute left-[19px] top-10 bottom-0 w-px bg-rule" />}
                    <div className="flex gap-4 py-3">
                      <div className={`w-10 h-10 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold ${isInc ? 'border-due/40 text-due bg-due/5' : 'border-settled/40 text-settled bg-settled/5'}`}>
                        {meta.sign}
                      </div>
                      <div className="flex-1 pt-1.5">
                        <div className="flex items-baseline justify-between gap-4">
                          <div>
                            <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
                            {t.notes && <span className="text-stone text-xs ml-2">— {t.notes}</span>}
                            <p className="text-stone text-xs mt-0.5">{formatDate(t.transaction_date)}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`font-display font-medium num ${meta.color}`}>{meta.sign}{formatINR(t.amount)}</p>
                            <p className="text-stone text-xs num">Bal: {formatINR(Math.abs(t.running))}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'reminders' && (
        <div>
          <div className="bg-paperdim border border-rule rounded-sm p-4 mb-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <input value={reminderNote} onChange={e => setReminderNote(e.target.value)}
                placeholder="Notes (called, visited, promised…)"
                className="flex-1 bg-transparent border border-rule rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-ink placeholder:text-stone/50" />
              <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                className="bg-transparent border border-rule rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              <button onClick={handleAddReminder} className="bg-ink text-paper text-sm px-4 py-2 rounded-sm hover:bg-ink/90 flex-shrink-0">Add</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-5">
            {REMINDER_STATUSES.map(s => (
              <button key={s.value}
                onClick={async () => {
                  const r = await api.createReminder({ party_id: party.id, amount_at_time: party.balance })
                  const updated = await api.updateReminder(r.id, { status: s.value })
                  setReminders(prev => [updated, ...prev])
                }}
                className="text-xs border border-rule rounded-sm px-3 py-1.5 hover:bg-paperdim transition-colors">{s.label}</button>
            ))}
          </div>
          {reminders.length === 0 ? (
            <p className="text-stone text-sm text-center py-8">No follow-ups logged yet.</p>
          ) : (
            <div className="space-y-3">
              {reminders.map(r => (
                <div key={r.id} className="border border-rule rounded-sm p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-sm font-medium ${r.status === 'paid' ? 'bg-settled/10 text-settled' : 'bg-paperdim text-stone'}`}>
                        {REMINDER_STATUSES.find(s => s.value === r.status)?.label || r.status}
                      </span>
                      {r.amount_at_time && <span className="text-xs text-stone">at {formatINR(r.amount_at_time)}</span>}
                    </div>
                    {r.notes && <p className="text-sm">{r.notes}</p>}
                    <p className="text-xs text-stone mt-1">{formatDate(r.created_at)}</p>
                    {r.follow_up_date && <p className="text-xs text-due mt-0.5">Follow up: {formatDate(r.follow_up_date)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showUPI && <UPIModal party={party} balance={party.balance} onClose={() => setShowUPI(false)} />}
      {showStatement && <StatementModal party={party} onClose={() => setShowStatement(false)} />}
    </div>
  )
}
