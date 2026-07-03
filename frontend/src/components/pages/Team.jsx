import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'

const ROLE_COLORS = { owner: 'bg-ink text-paper', manager: 'bg-settled/10 text-settled', accountant: 'bg-paperdim text-stone' }
const ROLE_PERMS = {
  manager: ['Log transactions', 'View all data', 'Add parties', 'Approve payments under ₹10,000'],
  accountant: ['Log transactions', 'View all data', 'Add parties'],
}

export default function Team() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('accountant')
  const [inviting, setInviting] = useState(false)
  const [invite, setInvite] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.listTeam().then(setMembers).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleInvite(e) {
    e.preventDefault()
    if (!email.trim()) return
    setInviting(true); setError('')
    try {
      const res = await api.inviteTeam({ email: email.trim(), role })
      setInvite(res)
      setEmail('')
    } catch (err) { setError(err.message) }
    finally { setInviting(false) }
  }

  async function handleRemove(id) {
    if (!confirm('Remove this team member?')) return
    await api.removeTeamMember(id)
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-medium">Team Access</h1>
        <p className="text-stone text-sm mt-1">Invite your accountant or manager to access the same ledger</p>
      </div>

      {/* Invite form */}
      <div className="bg-paperdim border border-rule rounded-sm p-6 mb-8">
        <h2 className="font-medium mb-4">Invite a team member</h2>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              placeholder="accountant@email.com"
              className="flex-1 bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink placeholder:text-stone/50" />
            <select value={role} onChange={e => setRole(e.target.value)}
              className="bg-paper border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink">
              <option value="accountant">Accountant</option>
              <option value="manager">Manager</option>
            </select>
            <button type="submit" disabled={inviting || !email.trim()}
              className="bg-ink text-paper text-sm px-4 py-2.5 rounded-sm hover:bg-ink/90 disabled:opacity-50 flex-shrink-0">
              {inviting ? 'Inviting…' : 'Send invite'}
            </button>
          </div>

          {/* Permissions preview */}
          <div className="text-xs text-stone">
            <span className="font-medium capitalize">{role}</span> can:{' '}
            {ROLE_PERMS[role]?.join(' · ')}
            {role === 'manager' && <span className="text-due"> · Cannot approve payments above ₹10,000</span>}
          </div>

          {error && <p className="text-due text-sm">{error}</p>}
        </form>

        {/* Invite token result */}
        {invite && (
          <div className="mt-5 bg-ink text-paper rounded-sm p-4">
            <p className="text-xs text-stone mb-2 uppercase tracking-widest">Invite created</p>
            <p className="text-sm mb-3">Share this token with <strong>{invite.email}</strong> to join as <strong>{invite.role}</strong>:</p>
            <div className="flex items-center gap-2 bg-white/10 rounded-sm px-3 py-2">
              <code className="flex-1 text-xs break-all text-paper">{invite.invite_token}</code>
              <button onClick={() => navigator.clipboard.writeText(invite.invite_token)}
                className="text-xs text-stone hover:text-paper flex-shrink-0">Copy</button>
            </div>
            <p className="text-xs text-stone mt-2">They sign up at your app URL using this token.</p>
            <button onClick={() => setInvite(null)} className="text-xs text-stone hover:text-paper mt-2 underline">Dismiss</button>
          </div>
        )}
      </div>

      {/* Current team */}
      <div>
        <h2 className="font-medium mb-4">Current team</h2>
        {loading ? (
          <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-14 bg-rule/40 rounded-sm animate-pulse" />)}</div>
        ) : members.length === 0 ? (
          <div className="border border-rule border-dashed rounded-sm p-8 text-center">
            <p className="text-stone text-sm">No team members yet. Invite your accountant or manager above.</p>
          </div>
        ) : (
          <div className="border border-rule rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-paperdim border-b border-rule">
                  {['Email', 'Role', 'Joined', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id} className={`border-b border-rule last:border-0 ${i % 2 === 1 ? 'bg-paper/40' : ''}`}>
                    <td className="px-5 py-3.5">{m.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-sm font-medium capitalize ${ROLE_COLORS[m.role]}`}>{m.role}</span>
                    </td>
                    <td className="px-5 py-3.5 text-stone text-xs">{formatDate(m.created_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => handleRemove(m.id)} className="text-stone hover:text-due text-xs transition-colors">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role comparison */}
      <div className="mt-8 border border-rule rounded-sm overflow-hidden">
        <div className="bg-paperdim border-b border-rule px-5 py-3">
          <p className="text-sm font-medium">Role permissions</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium">Permission</th>
              <th className="text-center px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium">Accountant</th>
              <th className="text-center px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium">Manager</th>
              <th className="text-center px-5 py-3 text-xs uppercase tracking-widest text-stone font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['View all data', true, true, true],
              ['Add suppliers & customers', true, true, true],
              ['Log transactions', true, true, true],
              ['Approve payments under ₹10k', false, true, true],
              ['Approve payments above ₹10k', false, false, true],
              ['Invite team members', false, false, true],
              ['Delete data', false, false, true],
            ].map(([perm, acc, mgr, own]) => (
              <tr key={perm} className="border-b border-rule last:border-0">
                <td className="px-5 py-3 text-sm">{perm}</td>
                {[acc, mgr, own].map((has, i) => (
                  <td key={i} className="px-5 py-3 text-center">
                    {has ? <span className="text-settled font-bold">✓</span> : <span className="text-stone text-xs">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
