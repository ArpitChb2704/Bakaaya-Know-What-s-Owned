import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { formatINR, formatDate } from '../../lib/format'
import { useNavigate } from 'react-router-dom'

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDay(year, month) {
  return new Date(year, month, 1).getDay()
}

const EVENT_COLORS = {
  overdue: 'bg-due text-paper',
  due: 'bg-yellow-500 text-paper',
  follow_up: 'bg-settled text-paper',
}

export default function CalendarView() {
  const navigate = useNavigate()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [events, setEvents] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getCalendar()
      .then(setEvents)
      .finally(() => setLoading(false))
  }, [])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDay(year, month)
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  function eventsOnDay(day) {
    const d = new Date(year, month, day).toISOString().slice(0, 10)
    return events.filter(e => e.date === d)
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelected(null)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelected(null)
  }

  const selectedEvents = selected ? eventsOnDay(selected) : []

  // Summary counts
  const overdueCount = events.filter(e => e.event_type === 'overdue').length
  const dueCount = events.filter(e => e.event_type === 'due').length

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Payment Calendar</h1>
          <p className="text-stone text-sm mt-1">Your dues and receivables on a timeline</p>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-due inline-block" /> {overdueCount} overdue</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" /> {dueCount} due soon</span>
        </div>
      </div>

      <div className="border border-rule rounded-sm overflow-hidden">
        {/* Month nav */}
        <div className="bg-paperdim border-b border-rule px-5 py-4 flex items-center justify-between">
          <button onClick={prevMonth} className="text-stone hover:text-ink text-lg leading-none">←</button>
          <h2 className="font-display text-lg font-medium">{monthNames[month]} {year}</h2>
          <button onClick={nextMonth} className="text-stone hover:text-ink text-lg leading-none">→</button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-rule">
          {dayNames.map(d => (
            <div key={d} className="text-center py-2 text-xs uppercase tracking-widest text-stone">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="h-64 flex items-center justify-center text-stone text-sm">Loading…</div>
        ) : (
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {[...Array(firstDay)].map((_, i) => (
              <div key={`e${i}`} className="border-b border-r border-rule min-h-[80px] bg-paperdim/30" />
            ))}
            {/* Day cells */}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1
              const dayEvents = eventsOnDay(day)
              const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate()
              const isSelected = selected === day
              const col = (firstDay + i) % 7
              const isLastCol = col === 6

              return (
                <div
                  key={day}
                  onClick={() => setSelected(isSelected ? null : day)}
                  className={`border-b ${!isLastCol ? 'border-r' : ''} border-rule min-h-[80px] p-1.5 cursor-pointer transition-colors ${isSelected ? 'bg-paperdim' : 'hover:bg-paperdim/50'}`}
                >
                  <p className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-ink text-paper' : 'text-stone'}`}>
                    {day}
                  </p>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map((e, ei) => (
                      <div key={ei} className={`text-xs px-1 py-0.5 rounded-sm truncate ${EVENT_COLORS[e.event_type]}`}>
                        {e.party_name.split(' ')[0]}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="text-xs text-stone">+{dayEvents.length - 2}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Day detail panel */}
      {selected && selectedEvents.length > 0 && (
        <div className="mt-6 border border-rule rounded-sm overflow-hidden">
          <div className="bg-paperdim border-b border-rule px-5 py-3">
            <p className="font-medium text-sm">
              {monthNames[month]} {selected}, {year} — {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="divide-y divide-rule">
            {selectedEvents.map((e, i) => (
              <div key={i} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-sm font-medium ${EVENT_COLORS[e.event_type]}`}>
                    {e.event_type === 'overdue' ? 'OVERDUE' : e.event_type === 'due' ? 'DUE' : 'FOLLOW UP'}
                  </span>
                  <div>
                    <p className="font-medium">{e.party_name}</p>
                    <p className="text-xs text-stone capitalize">{e.party_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className={`font-display font-medium num ${e.party_type === 'customer' ? 'text-settled' : 'text-due'}`}>
                    {formatINR(e.amount)}
                  </p>
                  <button
                    onClick={() => navigate(`/party/${e.party_id}`)}
                    className="text-xs text-stone hover:text-ink underline underline-offset-2"
                  >
                    View →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && selectedEvents.length === 0 && (
        <div className="mt-6 border border-rule border-dashed rounded-sm p-6 text-center text-stone text-sm">
          No dues or events on {monthNames[month]} {selected}.
        </div>
      )}
    </div>
  )
}
