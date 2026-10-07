import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, setAdminToken } from '../../lib/adminApi'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await adminApi.login(email, password)
      setAdminToken(res.access_token)
      navigate('/admin')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="font-display text-2xl mb-6 text-center">Bakaaya Admin</h1>
        {error && <div className="bg-due/10 border border-due/30 rounded-sm p-3 mb-4 text-sm text-due">{error}</div>}
        <input type="email" required placeholder="Admin email" value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border border-rule rounded-sm px-3 py-2.5 mb-3 bg-transparent text-sm" />
        <input type="password" required placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border border-rule rounded-sm px-3 py-2.5 mb-4 bg-transparent text-sm" />
        <button type="submit" disabled={loading}
          className="w-full bg-ink text-paper py-2.5 rounded-sm disabled:opacity-50">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}