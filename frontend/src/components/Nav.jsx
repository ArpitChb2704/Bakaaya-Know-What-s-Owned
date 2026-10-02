import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import Wordmark from './Wordmark'

const navItems = [
  { to: '/', label: 'Overview', end: true },
  { to: '/suppliers', label: 'Suppliers' },
  { to: '/customers', label: 'Customers' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/create-bill', label: 'Create Bill' },
  { to: '/skus', label: 'Products' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/bank-import', label: 'Import' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/ask', label: 'Ask AI' },
  { to: '/team', label: 'Team' },
]

export default function Nav() {
  const { businessName, logout } = useAuth()
  return (
    <header className="bg-ink text-paper sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Wordmark size="sm" className="text-paper" />
          <nav className="hidden xl:flex items-center gap-0.5">
            {navItems.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `px-2.5 py-1.5 rounded-sm text-sm transition-colors ${isActive ? 'bg-paper/10 text-paper font-medium' : 'text-stone hover:text-paper'}`}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-stone text-xs truncate max-w-[140px]">{businessName}</span>
          <button onClick={logout} className="text-stone hover:text-paper text-sm transition-colors">Out</button>
        </div>
      </div>
      <nav className="xl:hidden border-t border-white/10 flex overflow-x-auto">
        {navItems.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `flex-shrink-0 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${isActive ? 'text-paper border-due' : 'text-stone hover:text-paper border-transparent'}`}>
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
