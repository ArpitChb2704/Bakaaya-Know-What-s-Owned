import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import Wordmark from './Wordmark'

export default function AuthPage() {
  const { login, signup, acceptInvite } = useAuth()
  const [mode, setMode] = useState('login') // login | signup | invite
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else if (mode === 'signup') {
        if (!businessName.trim()) { setError('Enter your business name.'); setLoading(false); return }
        await signup(businessName, email, password)
      } else {
        if (!inviteToken.trim()) { setError('Enter your invite token.'); setLoading(false); return }
        await acceptInvite(inviteToken.trim(), password)
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-paper flex">
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-ink text-paper p-14">
        <Wordmark size="md" className="text-paper" />
        <div>
          <p className="font-display text-4xl leading-tight font-medium mb-6">
            Know what's owed.<br /><span className="text-due">Ask, don't search.</span>
          </p>
          <p className="text-stone text-sm leading-relaxed max-w-xs">
            Log bills and payments. Ask in English or Hindi. Import your bank statement. Share with your accountant.
          </p>
        </div>
        <p className="text-stone text-xs">"Bakaaya" — the amount due.</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-10"><Wordmark size="md" /></div>
          <h2 className="font-display text-2xl font-medium mb-1">
            {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Start your ledger' : 'Join your team'}
          </h2>
          <p className="text-stone text-sm mb-8">
            {mode === 'login' ? 'Sign in to your account' : mode === 'signup' ? 'Free. No credit card.' : 'Accept your team invite'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Business name</label>
                <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Chhabra Bakery"
                  className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink transition-colors placeholder:text-stone/50" />
              </div>
            )}
            {mode === 'invite' && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Invite token</label>
                <input type="text" value={inviteToken} onChange={e => setInviteToken(e.target.value)} placeholder="Paste token from owner"
                  className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink font-mono placeholder:text-stone/50" />
              </div>
            )}
            {mode !== 'invite' && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@business.com"
                  className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink transition-colors placeholder:text-stone/50" />
              </div>
            )}
            <div>
              <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full bg-transparent border border-rule rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-ink transition-colors placeholder:text-stone/50" />
            </div>
            {error && <p className="text-due text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-ink text-paper text-sm font-medium py-2.5 rounded-sm hover:bg-ink/90 disabled:opacity-50 transition-opacity">
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Join team'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-stone">
            {mode !== 'login' && (
              <p>Have an account? <button onClick={() => { setMode('login'); setError('') }} className="text-ink underline underline-offset-2">Sign in</button></p>
            )}
            {mode !== 'signup' && (
              <p>New business? <button onClick={() => { setMode('signup'); setError('') }} className="text-ink underline underline-offset-2">Create account</button></p>
            )}
            {mode !== 'invite' && (
              <p>Got an invite? <button onClick={() => { setMode('invite'); setError('') }} className="text-ink underline underline-offset-2">Join team</button></p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
