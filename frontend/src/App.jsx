import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import AuthPage from './components/AuthPage'
import Nav from './components/Nav'
import Overview from './components/pages/Overview'
import PartyList from './components/pages/PartyList'
import PartyDetail from './components/pages/PartyDetail'
import Transactions from './components/pages/Transactions'
import CalendarView from './components/pages/CalendarView'
import AskPage from './components/pages/AskPage'
import BankImport from './components/pages/BankImport'
import Analytics from './components/pages/Analytics'
import Team from './components/pages/Team'
import CreateBill from './components/pages/CreateBill'
import Skus from './components/pages/Skus'
import { useState, useEffect } from 'react'
import PlanExpiredScreen from './components/pages/PlanExpiredScreen'
import AdminLogin from './components/pages/AdminLogin'
import AdminDashboard from './components/pages/AdminDashboard'

function AppShell() {
  const { isAuthed } = useAuth()
  const [planExpired, setPlanExpired] = useState(false)
  useEffect(() => {
    const handler = () => setPlanExpired(true)
    window.addEventListener('plan-expired', handler)
    return () => window.removeEventListener('plan-expired', handler)
  }, [])

  if (planExpired) return <PlanExpiredScreen />
  if (!isAuthed) return <AuthPage />
  return (
    <div className="min-h-screen bg-paper">
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/suppliers" element={<PartyList partyType="supplier" />} />
          <Route path="/customers" element={<PartyList partyType="customer" />} />
          <Route path="/party/:id" element={<PartyDetail />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/create-bill" element={<CreateBill />} />
          <Route path="/skus" element={<Skus />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/ask" element={<AskPage />} />
          <Route path="/bank-import" element={<BankImport />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/team" element={<Team />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/*" element={
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        } />
      </Routes>
    </BrowserRouter>
  )
}
