import { useState, useRef } from 'react'
import { api } from '../../lib/api'
import { formatINR, formatDate } from '../../lib/format'

const TYPE_COLORS = { bill: 'text-due', payment_out: 'text-settled', sale: 'text-settled', payment_in: 'text-due' }
const TYPE_LABELS = { bill: 'Bill', payment_out: 'Payment out', sale: 'Sale', payment_in: 'Payment in' }
const CONF_COLORS = { HIGH: 'text-settled', MEDIUM: 'text-yellow-600', LOW: 'text-stone', NONE: 'text-stone/50' }

export default function BankImport() {
  const [step, setStep] = useState('upload') // upload | review | done
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const fileRef = useRef()

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setError('')
    try {
      const res = await api.uploadStatement(file)
      setMatches(res.rows.map(r => ({ ...r, selected: r.confidence !== 'NONE' })))
      setStep('review')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  function toggleSelect(i) {
    setMatches(prev => prev.map((m, idx) => idx === i ? { ...m, selected: !m.selected } : m))
  }

  async function handleConfirm() {
    const toImport = matches.filter(m => m.selected && m.matched_party_id && m.suggested_transaction_type)
    if (!toImport.length) { setError('No matched transactions selected.'); return }
    setSaving(true); setError('')
    try {
      const payload = toImport.map(m => ({
        row: { date: m.date, description: m.description, amount: m.amount, transaction_type: m.transaction_type, reference: m.reference || null },
        matched_party: m.matched_party_name,
        matched_party_id: m.matched_party_id,
        suggested_type: m.suggested_transaction_type,
        confidence: m.confidence,
        selected: true,
      }))
      const saved = await api.confirmBankImport(payload)
      setResult({ saved: saved.length })
      setStep('done')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const selectedCount = matches.filter(m => m.selected && m.matched_party_id).length
  const unmatchedCount = matches.filter(m => m.confidence === 'NONE').length

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-medium">Bank Statement Import</h1>
        <p className="text-stone text-sm mt-1">Upload your bank CSV · AI matches transactions to your parties · one-click import</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-3 mb-8">
        {['upload', 'review', 'done'].map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${step === s || (s === 'upload' && step !== 'upload') ? 'bg-ink text-paper' : 'bg-rule text-stone'}`}>
              {i + 1}
            </div>
            <span className={`text-sm capitalize ${step === s ? 'font-medium' : 'text-stone'}`}>{s}</span>
            {i < 2 && <span className="text-rule">→</span>}
          </div>
        ))}
      </div>

      {/* Upload step */}
      {step === 'upload' && (
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-rule rounded-sm p-16 text-center cursor-pointer hover:border-ink transition-colors"
          >
            <p className="text-4xl mb-4">📄</p>
            <p className="font-display text-xl font-medium mb-2">Drop your bank statement CSV here</p>
            <p className="text-stone text-sm mb-4">Supports SBI, HDFC, ICICI, Axis, Kotak and most Indian banks</p>
            <p className="text-xs text-stone/60">Click to browse · Max 2MB</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} className="hidden" />
          </div>

          {loading && (
            <div className="mt-6 bg-paperdim border border-rule rounded-sm p-6 text-center">
              <div className="flex gap-1 justify-center mb-2">
                {[0,150,300].map(d => <span key={d} className="w-2 h-2 bg-ink rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
              <p className="text-stone text-sm">Parsing CSV and matching with your parties…</p>
            </div>
          )}

          {error && <p className="mt-4 text-due text-sm">{error}</p>}

          <div className="mt-8 bg-paperdim border border-rule rounded-sm p-5">
            <p className="font-medium text-sm mb-3">How to export from your bank</p>
            <div className="grid sm:grid-cols-2 gap-3 text-sm text-stone">
              {[
                ['SBI', 'Internet Banking → Account Statement → Download CSV'],
                ['HDFC', 'NetBanking → My Accounts → Last 6 months → Download'],
                ['ICICI', 'iMobile / NetBanking → Account Statement → Export CSV'],
                ['Axis', 'Internet Banking → Accounts → Statement → CSV'],
              ].map(([bank, steps]) => (
                <div key={bank} className="flex gap-2">
                  <span className="font-medium text-ink flex-shrink-0">{bank}:</span>
                  <span>{steps}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Review step */}
      {step === 'review' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div className="flex gap-4 text-sm">
              <span className="text-settled font-medium">{matches.length - unmatchedCount} matched</span>
              <span className="text-stone">{unmatchedCount} unmatched</span>
              <span className="font-medium">{selectedCount} selected to import</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('upload')} className="border border-rule text-sm px-3 py-2 rounded-sm hover:bg-paperdim">
                ← Re-upload
              </button>
              <button onClick={handleConfirm} disabled={saving || selectedCount === 0}
                className="bg-ink text-paper text-sm px-4 py-2 rounded-sm hover:bg-ink/90 disabled:opacity-50">
                {saving ? 'Importing…' : `Import ${selectedCount} transactions`}
              </button>
            </div>
          </div>

          {error && <p className="text-due text-sm mb-4">{error}</p>}

          <div className="border border-rule rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-paperdim border-b border-rule">
                  <th className="px-4 py-3 text-left w-8"><input type="checkbox"
                    checked={matches.every(m => m.selected)}
                    onChange={e => setMatches(prev => prev.map(m => ({ ...m, selected: e.target.checked })))}
                    className="rounded" /></th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-widest text-stone font-medium">Date</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-widest text-stone font-medium">Bank Description</th>
                  <th className="px-4 py-3 text-right text-xs uppercase tracking-widest text-stone font-medium">Amount</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-widest text-stone font-medium">Matched Party</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-widest text-stone font-medium hidden md:table-cell">Type</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-widest text-stone font-medium hidden md:table-cell">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={i} className={`border-b border-rule last:border-0 ${!m.selected ? 'opacity-40' : ''} ${i % 2 === 1 ? 'bg-paper/40' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={m.selected} onChange={() => toggleSelect(i)} className="rounded" />
                    </td>
                    <td className="px-4 py-3 text-xs text-stone whitespace-nowrap">{formatDate(m.date)}</td>
                    <td className="px-4 py-3 truncate max-w-[200px]" title={m.description}>{m.description}</td>
                    <td className="px-4 py-3 text-right font-medium num">{formatINR(m.amount)}</td>
                    <td className="px-4 py-3">
                      {m.matched_party_name
                        ? <span className="font-medium">{m.matched_party_name}</span>
                        : <span className="text-stone text-xs italic">No match</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {m.suggested_transaction_type
                        ? <span className={`text-xs ${TYPE_COLORS[m.suggested_transaction_type]}`}>{TYPE_LABELS[m.suggested_transaction_type]}</span>
                        : <span className="text-stone text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs font-medium ${CONF_COLORS[m.confidence]}`}>{m.confidence}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Done step */}
      {step === 'done' && result && (
        <div className="border border-rule rounded-sm p-12 text-center">
          <p className="text-5xl mb-4">✅</p>
          <p className="font-display text-2xl font-medium mb-2">{result.saved} transactions imported</p>
          <p className="text-stone text-sm mb-8">Your ledger has been updated.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep('upload'); setMatches([]); setResult(null) }}
              className="border border-rule text-sm px-4 py-2.5 rounded-sm hover:bg-paperdim">
              Import another
            </button>
            <a href="/transactions" className="bg-ink text-paper text-sm px-4 py-2.5 rounded-sm hover:bg-ink/90">
              View transactions
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
