import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { formatINR, formatDate } from '../lib/format'

const EXAMPLES = [
  'Amul bill 15000',
  'Sharma paid 8000 today',
  'Paid Pepsi 12000 by UPI',
  'amul ka bill 15000',
  'sharma ko 8000 de diye',
  'coca cola se maal liya 25000',
]

const TYPE_LABELS = {
  bill: 'Bill received',
  payment_out: 'Payment made',
  sale: 'Sale / credit',
  payment_in: 'Payment received',
}

const TYPE_COLORS = {
  bill: 'text-due',
  payment_out: 'text-settled',
  sale: 'text-settled',
  payment_in: 'text-due',
}

export default function SmartEntry({ onSaved }) {
  const [text, setText] = useState('')
  const [state, setState] = useState('idle')
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState('')
  const [exampleIdx, setExampleIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setExampleIdx(i => (i + 1) % EXAMPLES.length), 2500)
    return () => clearInterval(t)
  }, [])

  async function handleParse() {
    if (!text.trim()) return
    setState('parsing')
    setError('')
    try {
      const res = await api.parseEntry(text.trim())
      if (res.error || !res.parsed) {
        setError("Couldn't understand that. Try: 'Amul bill 15000' or 'sharma ko 5000 de diye'")
        setState('error')
      } else {
        setParsed(res.parsed)
        setState('preview')
      }
    } catch {
      setError('Parse failed. Check your connection.')
      setState('error')
    }
  }

  async function handleConfirm() {
    setState('saving')
    try {
      await api.confirmEntry(parsed)
      setState('saved')
      setText('')
      setTimeout(() => { setState('idle'); setParsed(null) }, 1800)
      onSaved?.()
    } catch (e) {
      setError(e.message)
      setState('error')
    }
  }

  function handleEdit() { setState('idle'); setParsed(null); setError('') }

  return (
    <div className="bg-ink border border-white/10 rounded-sm overflow-hidden">
      {/* Input bar */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-stone text-base flex-shrink-0">💬</span>
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleParse(); if (e.key === 'Escape') handleEdit() }}
          disabled={state === 'parsing' || state === 'saving'}
          placeholder={EXAMPLES[exampleIdx]}
          className="flex-1 bg-transparent text-paper text-sm focus:outline-none placeholder:text-white/30 disabled:opacity-50 caret-paper"
          style={{ color: '#F7F5F0' }}
        />
        {(state === 'idle' || state === 'error') && (
          <button onClick={handleParse} disabled={!text.trim()}
            className="flex-shrink-0 bg-due text-paper text-xs px-3 py-1.5 rounded-sm disabled:opacity-30 hover:bg-due/90 transition-opacity font-medium">
            Parse →
          </button>
        )}
        {state === 'parsing' && <span className="text-stone text-xs flex-shrink-0 animate-pulse">reading…</span>}
        {state === 'saved' && <span className="text-settled text-sm flex-shrink-0 font-medium">✓ Saved</span>}
      </div>

      {/* Error */}
      {state === 'error' && error && (
        <div className="border-t border-white/10 px-4 py-2.5 text-due text-xs">{error}</div>
      )}

      {/* Preview card */}
      {state === 'preview' && parsed && (
        <div className="border-t border-white/10">
          <div className="px-4 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Party</p>
              <p className="text-paper font-medium">{parsed.party_name}</p>
              <p className="text-white/40 text-xs capitalize">{parsed.party_type}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Type</p>
              <p className={`font-medium text-sm ${TYPE_COLORS[parsed.transaction_type]}`}>
                {TYPE_LABELS[parsed.transaction_type]}
              </p>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Amount</p>
              <p className="text-paper font-display text-xl font-medium num">{formatINR(parsed.amount)}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Date</p>
              <p className="text-paper text-sm">{formatDate(parsed.transaction_date)}</p>
              {parsed.confidence !== 'HIGH' && (
                <p className="text-yellow-400 text-xs mt-0.5">⚠ {parsed.confidence} confidence</p>
              )}
            </div>
          </div>
          <div className="flex gap-3 px-4 pb-4">
            <button onClick={handleConfirm} disabled={state === 'saving'}
              className="bg-settled text-paper text-sm px-4 py-2 rounded-sm hover:bg-settled/90 disabled:opacity-50 font-medium">
              {state === 'saving' ? 'Saving…' : '✓ Save transaction'}
            </button>
            <button onClick={handleEdit} className="text-white/40 text-sm hover:text-paper transition-colors px-2">
              Edit
            </button>
          </div>
        </div>
      )}

      {/* Hint row */}
      {state === 'idle' && (
        <div className="border-t border-white/10 px-4 py-2 flex gap-3">
          {['English', 'Hindi', 'Hinglish'].map(l => (
            <span key={l} className="text-white/25 text-xs">{l} ✓</span>
          ))}
          <span className="text-white/20 text-xs ml-auto">Press Enter to parse</span>
        </div>
      )}
    </div>
  )
}
