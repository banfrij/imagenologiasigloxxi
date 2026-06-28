import { useEffect, useState } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import type { SidebarItem } from './components/Sidebar'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import LoginPanel from './components/auth/LoginPanel'
import DashboardLayout from './components/layout/DashboardLayout'
import AgendaScreen from './screens/AgendaScreen'
import StudiesScreen from './screens/StudiesScreen'
import PacientesScreen from './screens/Pacientes'
import HomeScreen from './screens/HomeScreen'
import PlaceholderScreen from './screens/PlaceholderScreen'
import ReportesScreen from './screens/ReportesScreen'
import { auth } from './firebase'
import { isAllowedEmail } from './constants/auth'


const sidebarItems: SidebarItem[] = [
  { label: 'Agenda', section: 'agenda' },
  { label: 'Facturación', section: 'facturacion' },
  { label: 'Interpretaciones', section: 'interpretaciones' },
  { label: 'Pacientes', section: 'pacientes' },
  { label: 'Estudios', section: 'estudios' },
  { label: 'Traslados', section: 'traslados' },
  { label: 'Reportes', section: 'reportes' },
]

const GlobalStyle = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    min-height: 100%;
  }

  body {
    margin: 0;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #eef2f7;
    color: #111827;
    min-height: 100vh;
  }

  button,
  input {
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
`

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeSection, setActiveSection] = useState<SidebarItem['section']>('agenda')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && !isAllowedEmail(firebaseUser.email ?? '')) {
        signOut(auth).catch(() => undefined)
        setUser(null)
        setIsAuthLoading(false)
        return
      }

      setUser(firebaseUser)
      setIsAuthLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleLogout = () => {
    signOut(auth).catch(() => undefined)
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'agenda':
        return <AgendaScreen />
      case 'estudios':
        return <StudiesScreen />
      case 'facturacion':
        return <PlaceholderScreen title="Facturación" description="Gestión de facturación próximamente." />
      case 'interpretaciones':
        return <PlaceholderScreen title="Interpretaciones" description="Interpretaciones y resultados próximamente." />
      case 'pacientes':
        return <PacientesScreen />
      case 'traslados':
        return <PlaceholderScreen title="Traslados" description="Gestión de traslados próximamente." />
      case 'reportes':
        return <ReportesScreen />
      default:
        return <HomeScreen />
    }
  }

  return (
    <AppShell>
      <GlobalStyle />

      {isAuthLoading ? (
        <LoadingCard>Validando sesión...</LoadingCard>
      ) : !user ? (
        <LoginPanel />
      ) : (
        <DashboardLayout
          open={sidebarOpen}
          items={sidebarItems}
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          onToggleSidebar={() => setSidebarOpen((value) => !value)}
          onLogout={handleLogout}
        >
          {renderContent()}
        </DashboardLayout>
      )}
    </AppShell>
  )
}

export default App

const AppShell = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(180deg, #eef2f7 0%, #ffffff 100%);
`

const LoadingCard = styled.section`
  width: min(380px, 100%);
  padding: 24px;
  text-align: center;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid #d6d9e6;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
  color: #334155;
  font-weight: 600;
`
