import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatINR } from '../../lib/format'
import { useAuth } from '../../lib/AuthContext'
import SmartEntry from '../SmartEntry'

function StatCard({ label, value, color = 'text-ink', sub, urgent }) {
  return (
    <div className={`bg-paperdim border rounded-sm p-5 ${urgent ? 'border-due/40' : 'border-rule'}`}>
      <p className="text-xs uppercase tracking-widest text-stone mb-2">{label}</p>
      <p className={`font-display text-3xl font-medium num ${color}`}>{value}</p>
      {sub && <p className="text-xs text-stone mt-1">{sub}</p>}
    </div>
  )
}

export default function Overview() {
  const { businessName } = useAuth()
  const [summary, setSummary] = useState(null)
  const [topParties, setTopParties] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    Promise.all([api.getSummary(), api.listParties()])
      .then(([s, parties]) => {
        setSummary(s)
        const outstanding = parties
          .filter(p => Number(p.balance) > 0)
          .sort((a, b) => Number(b.balance) - Number(a.balance))
          .slice(0, 8)
        setTopParties(outstanding)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-stone text-sm">{greeting()}</p>
        <h1 className="font-display text-3xl font-medium">{businessName}</h1>
      </div>

      {/* Smart Entry — top of dashboard */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-stone mb-2">Quick add transaction</p>
        <SmartEntry onSaved={load} />
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-rule/40 rounded-sm animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard label="Customers owe you" value={formatINR(summary?.total_receivable || 0)} color="text-settled" sub="Total receivable" />
          <StatCard label="You owe suppliers" value={formatINR(summary?.total_payable || 0)} color="text-due" sub="Total payable" />
          <StatCard label="Overdue" value={formatINR(summary?.overdue_amount || 0)} color={summary?.overdue_amount > 0 ? 'text-due' : 'text-stone'} sub={`${summary?.overdue_count || 0} parties past due`} urgent={summary?.overdue_amount > 0} />
          <StatCard label="Due this week" value={formatINR(summary?.upcoming_week_amount || 0)} color="text-ink" sub="Upcoming payments" />
          <StatCard label="High risk parties" value={summary?.high_risk_count || 0} color={summary?.high_risk_count > 0 ? 'text-due' : 'text-stone'} sub="Need attention" urgent={summary?.high_risk_count > 0} />
          <div className="bg-ink text-paper rounded-sm p-5 flex flex-col justify-between">
            <p className="text-xs uppercase tracking-widest text-stone mb-2">Net position</p>
            <p className={`font-display text-3xl font-medium num ${Number(summary?.total_receivable || 0) >= Number(summary?.total_payable || 0) ? 'text-settled' : 'text-due'}`}>
              {formatINR(Math.abs(Number(summary?.total_receivable || 0) - Number(summary?.total_payable || 0)))}
            </p>
            <p className="text-stone text-xs mt-1">
              {Number(summary?.total_receivable || 0) >= Number(summary?.total_payable || 0) ? 'In your favour' : 'You owe more'}
            </p>
          </div>
        </div>
      )}

      {/* Outstanding balances table */}
      {topParties.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-medium">Outstanding balances</h2>
            <div className="flex gap-3">
              <Link to="/suppliers" className="text-xs text-stone hover:text-ink underline underline-offset-2">Suppliers</Link>
              <Link to="/customers" className="text-xs text-stone hover:text-ink underline underline-offset-2">Customers</Link>
            </div>
          </div>
          <div className="border border-rule rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-paperdim">
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium">Name</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium hidden sm:table-cell">Type</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium hidden md:table-cell">Risk</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium hidden md:table-cell">Age</th>
                  <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {topParties.map((p, i) => (
                  <tr key={p.id} className={`border-b border-rule last:border-0 hover:bg-paperdim transition-colors ${i % 2 === 1 ? 'bg-paper/40' : ''}`}>
                    <td className="px-5 py-3.5 font-medium">{p.name}</td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className={`text-xs uppercase tracking-widest px-2 py-0.5 rounded-sm ${p.party_type === 'customer' ? 'bg-settled/10 text-settled' : 'bg-due/10 text-due'}`}>
                        {p.party_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      {p.risk_label ? (
                        <span className={`text-xs font-medium ${p.risk_label === 'HIGH' ? 'text-due' : p.risk_label === 'MEDIUM' ? 'text-yellow-600' : 'text-settled'}`}>
                          {p.risk_label === 'HIGH' ? '⬤ ' : p.risk_label === 'MEDIUM' ? '◐ ' : '○ '}{p.risk_label}
                        </span>
                      ) : <span className="text-stone text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      {p.days_outstanding ? (
                        <span className={`text-xs ${p.days_outstanding > 30 ? 'text-due font-medium' : p.days_outstanding > 14 ? 'text-yellow-600' : 'text-stone'}`}>
                          {p.days_outstanding}d
                        </span>
                      ) : <span className="text-stone text-xs">—</span>}
                    </td>
                    <td className={`px-5 py-3.5 text-right font-display font-medium num ${p.party_type === 'customer' ? 'text-settled' : 'text-due'}`}>
                      {formatINR(p.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && topParties.length === 0 && (
        <div className="border border-rule border-dashed rounded-sm p-12 text-center">
          <p className="font-display text-xl text-stone mb-2">Your ledger is empty</p>
          <p className="text-sm text-stone mb-1">Type a transaction above to get started.</p>
          <p className="text-xs text-stone/60">Try: "Amul bill 15000" or "Sharma paid 8000"</p>
        </div>
      )}

      {/* Ask AI banner */}
      <div className="mt-6 bg-ink text-paper rounded-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-display text-base font-medium mb-0.5">Have a question about your ledger?</p>
          <p className="text-stone text-sm">"How much do I owe Amul?" — ask in English or Hindi</p>
        </div>
        <Link to="/ask" className="flex-shrink-0 bg-paper text-ink px-4 py-2 rounded-sm text-sm font-medium hover:bg-paper/90 transition-opacity">
          Ask Bakaaya →
        </Link>
      </div>
    </div>
  )
}
