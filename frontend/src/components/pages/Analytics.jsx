import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { formatINR } from '../../lib/format'

const GRADE_COLORS = { A: 'text-settled bg-settled/10', B: 'text-ink bg-paperdim', C: 'text-yellow-700 bg-yellow-50', D: 'text-due bg-due/10' }

function CashflowChart({ weeks }) {
  if (!weeks.length) return null
  const maxVal = Math.max(...weeks.map(w => Math.max(w.expected_inflow, w.expected_outflow)))
  return (
    <div className="mt-4">
      <div className="flex gap-4 text-xs text-stone mb-3">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-settled inline-block" /> Inflow</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-due inline-block" /> Outflow</span>
      </div>
      <div className="flex gap-3 items-end h-32">
        {weeks.map((w, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex gap-0.5 items-end h-24">
              <div className="flex-1 rounded-t-sm bg-settled/70 transition-all"
                style={{ height: `${(w.expected_inflow / maxVal) * 100}%` }} />
              <div className="flex-1 rounded-t-sm bg-due/70 transition-all"
                style={{ height: `${(w.expected_outflow / maxVal) * 100}%` }} />
            </div>
            <p className="text-xs text-stone text-center">{new Date(w.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Analytics() {
  const [cashflow, setCashflow] = useState(null)
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('cashflow')

  useEffect(() => {
    Promise.all([api.getCashflow(), api.getSupplierScores()])
      .then(([c, s]) => { setCashflow(c); setScores(s) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-medium">Analytics</h1>
        <p className="text-stone text-sm mt-1">Cashflow forecast and supplier performance</p>
      </div>

      <div className="flex border-b border-rule mb-8 gap-6">
        {['cashflow', 'suppliers'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${tab === t ? 'border-ink text-ink' : 'border-transparent text-stone hover:text-ink'}`}>
            {t === 'cashflow' ? 'Cashflow Forecast' : 'Supplier Performance'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-rule/40 rounded-sm animate-pulse" />)}</div>
      ) : tab === 'cashflow' ? (
        <div>
          {cashflow?.warning && (
            <div className="bg-due/10 border border-due/30 rounded-sm p-4 mb-6 flex gap-3">
              <span className="text-due text-lg">⚠</span>
              <p className="text-sm text-due">{cashflow.warning}</p>
            </div>
          )}
          <div className="bg-paperdim border border-rule rounded-sm p-6 mb-6">
            <p className="text-xs uppercase tracking-widest text-stone mb-2">4-Week Forecast</p>
            <p className="text-sm leading-relaxed">{cashflow?.summary || 'No data yet.'}</p>
            {cashflow?.weeks?.length > 0 && <CashflowChart weeks={cashflow.weeks} />}
          </div>
          {cashflow?.weeks?.length > 0 && (
            <div className="border border-rule rounded-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-paperdim border-b border-rule">
                    {['Week', 'Expected In', 'Expected Out', 'Net', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs uppercase tracking-widest text-stone font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashflow.weeks.map((w, i) => (
                    <tr key={i} className={`border-b border-rule last:border-0 ${i % 2 === 1 ? 'bg-paper/40' : ''}`}>
                      <td className="px-5 py-3.5 text-stone text-xs">
                        {new Date(w.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} –{' '}
                        {new Date(w.week_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-5 py-3.5 text-settled font-medium num">{formatINR(w.expected_inflow)}</td>
                      <td className="px-5 py-3.5 text-due font-medium num">{formatINR(w.expected_outflow)}</td>
                      <td className={`px-5 py-3.5 font-display font-medium num ${w.net >= 0 ? 'text-settled' : 'text-due'}`}>
                        {w.net >= 0 ? '+' : ''}{formatINR(Math.abs(w.net))}
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {w.gap ? <span className="text-due">Gap: {formatINR(Math.abs(w.gap))}</span> : <span className="text-settled">✓ Surplus</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div>
          {scores.length === 0 ? (
            <div className="border border-rule border-dashed rounded-sm p-12 text-center">
              <p className="font-display text-xl text-stone mb-2">No supplier data yet</p>
              <p className="text-stone text-sm">Add suppliers and log transactions to see performance scores.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scores.map(s => (
                <div key={s.party_id} className="border border-rule rounded-sm p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium">{s.party_name}</h3>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-sm ${GRADE_COLORS[s.grade]}`}>{s.grade}</span>
                      </div>
                      <p className="text-stone text-sm">{s.insight}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-display text-3xl font-medium">{s.score}</p>
                      <p className="text-xs text-stone">/ 100</p>
                    </div>
                  </div>
                  <div className="w-full bg-rule rounded-full h-1.5 mb-4">
                    <div className={`h-1.5 rounded-full transition-all ${s.score >= 80 ? 'bg-settled' : s.score >= 60 ? 'bg-yellow-500' : s.score >= 40 ? 'bg-yellow-600' : 'bg-due'}`}
                      style={{ width: `${s.score}%` }} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    {[
                      { label: 'Total Billed', val: formatINR(s.total_billed) },
                      { label: 'Total Paid', val: formatINR(s.total_paid), color: 'text-settled' },
                      { label: 'Outstanding', val: formatINR(s.outstanding), color: Number(s.outstanding) > 0 ? 'text-due' : 'text-stone' },
                      { label: 'Avg Pay Days', val: s.avg_payment_days ? `${s.avg_payment_days}d` : '—' },
                    ].map(({ label, val, color }) => (
                      <div key={label}>
                        <p className="text-xs text-stone mb-0.5">{label}</p>
                        <p className={`font-medium num ${color || ''}`}>{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
