import { createContext, useContext, useState, useCallback } from 'react'
import { api, setToken, clearToken, getToken } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [businessName, setBusinessName] = useState(() => localStorage.getItem('bakaaya_business_name') || null)
  const [role, setRole] = useState(() => localStorage.getItem('bakaaya_role') || 'owner')
  const [isAuthed, setIsAuthed] = useState(() => !!getToken())

  const login = useCallback(async (email, password) => {
    const res = await api.login({ email, password })
    setToken(res.access_token)
    localStorage.setItem('bakaaya_business_name', res.business_name)
    localStorage.setItem('bakaaya_role', res.role || 'owner')
    setBusinessName(res.business_name)
    setRole(res.role || 'owner')
    setIsAuthed(true)
  }, [])

  const signup = useCallback(async (businessNameInput, email, password) => {
    const res = await api.signup({ business_name: businessNameInput, email, password })
    setToken(res.access_token)
    localStorage.setItem('bakaaya_business_name', res.business_name)
    localStorage.setItem('bakaaya_role', res.role || 'owner')
    setBusinessName(res.business_name)
    setRole(res.role || 'owner')
    setIsAuthed(true)
  }, [])

  const acceptInvite = useCallback(async (token, password) => {
    const res = await api.acceptInvite({ token, password })
    setToken(res.access_token)
    localStorage.setItem('bakaaya_business_name', res.business_name)
    localStorage.setItem('bakaaya_role', res.role)
    setBusinessName(res.business_name)
    setRole(res.role)
    setIsAuthed(true)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setBusinessName(null)
    setRole('owner')
    setIsAuthed(false)
  }, [])

  return (
    <AuthContext.Provider value={{ businessName, role, isAuthed, login, signup, logout, acceptInvite }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
