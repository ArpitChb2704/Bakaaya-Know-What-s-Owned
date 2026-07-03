import { useState, useRef, useEffect } from 'react'
import { api } from '../../lib/api'

const STARTERS = [
  'How much do I owe Amul?',
  'Which customer owes me the most?',
  'Show all unpaid bills.',
  'Total receivable from customers?',
  'Who has the highest outstanding balance?',
  'Which suppliers have pending dues?',
  'Show bills above ₹10,000',
  'Payments made this month?',
]

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[70%]`}>
        {!isUser && <p className="text-xs text-stone mb-1 ml-1 uppercase tracking-widest">Bakaaya</p>}
        <div className={`px-4 py-3 rounded-sm text-sm leading-relaxed ${isUser ? 'bg-ink text-paper' : 'bg-paperdim border border-rule text-ink'}`}>
          {msg.content}
        </div>
      </div>
    </div>
  )
}

export default function AskPage() {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: 'Ask me anything about your ledger — in English or Hindi. Try "How much do I owe Amul?" or "Which customer owes me the most?"',
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(question) {
    const q = (question || input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)
    try {
      const res = await api.ask(q)
      setMessages(prev => [...prev, { role: 'assistant', content: res.answer }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-8 flex flex-col" style={{ minHeight: 'calc(100vh - 56px)' }}>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-medium mb-1">Ask Bakaaya</h1>
        <p className="text-stone text-sm">Your ledger, in plain language. English, Hindi, Hinglish — all work.</p>
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {STARTERS.map(s => (
            <button key={s} onClick={() => send(s)}
              className="text-xs border border-rule rounded-sm px-3 py-1.5 text-stone hover:text-ink hover:border-ink transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-4 mb-6">
        {messages.map((m, i) => <Message key={i} msg={m} />)}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-paperdim border border-rule px-4 py-3 rounded-sm">
              <div className="flex gap-1 items-center h-4">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 bg-stone rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-4">
        <div className="bg-paper border border-rule rounded-sm flex items-center gap-2 px-4 py-3 shadow-sm focus-within:border-ink transition-colors">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask a question about your ledger…"
            disabled={loading}
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-stone/50 disabled:opacity-50"
          />
          <button onClick={() => send()} disabled={loading || !input.trim()}
            className="bg-ink text-paper text-xs px-3 py-1.5 rounded-sm disabled:opacity-30 hover:bg-ink/90 transition-opacity flex-shrink-0">
            Ask
          </button>
        </div>
        <p className="text-xs text-stone/50 mt-2 text-center">Reads your data only · no write access · powered by Groq</p>
      </div>
    </div>
  )
}
