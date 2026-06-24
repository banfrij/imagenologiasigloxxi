import { useState } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import Sidebar from './components/Sidebar'
import type { SidebarItem } from './components/Sidebar'
import AgendaScreen from './screens/AgendaScreen'
import StudiesScreen from './screens/StudiesScreen'
import HomeScreen from './screens/HomeScreen'
import PlaceholderScreen from './screens/PlaceholderScreen'


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
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeSection, setActiveSection] = useState<SidebarItem['section']>('agenda')
 
  const [error, setError] = useState('')

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (username === '123' && password === '123') {
      setIsAuthenticated(true)
      setError('')
      return
    }

    setError('Credenciales incorrectas. Usuario 123 / Contraseña 123.')
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setUsername('')
    setPassword('')
    setError('')
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
        return <PlaceholderScreen title="Pacientes" description="Listado y detalles de pacientes próximamente." />
      case 'traslados':
        return <PlaceholderScreen title="Traslados" description="Gestión de traslados próximamente." />
      case 'reportes':
        return <PlaceholderScreen title="Reportes" description="Reportes y estadísticas próximamente." />
      default:
        return <HomeScreen />
    }
  }

  return (
    <AppShell>
      <GlobalStyle />

      {!isAuthenticated ? (
        <LoginCard>
          <LoginTitle>Ingreso seguro</LoginTitle>
          <LoginText>Usuario de demostración para acceder al panel.</LoginText>
          <LoginForm onSubmit={handleLogin}>
            <Field>
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="123"
                autoComplete="username"
              />
            </Field>
            <Field>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="123"
                autoComplete="current-password"
              />
            </Field>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <LoginButton type="submit">Ingresar</LoginButton>
          </LoginForm>
        </LoginCard>
      ) : (
        <DashboardShell open={sidebarOpen}>
          <Sidebar
            open={sidebarOpen}
            items={sidebarItems}
            activeSection={activeSection}
            onSelect={setActiveSection}
            onToggle={() => setSidebarOpen((value) => !value)}
            onLogout={handleLogout}
          />

          <MainArea>
      
            {renderContent()}
          </MainArea>
        </DashboardShell>
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

const LoginCard = styled.section`
  width: min(480px, 100%);
  padding: 36px 32px;
  background: #ffffff;
  border: 1px solid #d6d9e6;
  border-radius: 28px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
`

const LoginTitle = styled.h1`
  margin: 0 0 8px;
  font-size: 28px;
  letter-spacing: -0.4px;
  color: #111827;
`

const LoginText = styled.p`
  margin: 0 0 28px;
  color: #4b5563;
  line-height: 1.6;
`

const LoginForm = styled.form`
  display: grid;
  gap: 18px;
`

const Field = styled.label`
  display: grid;
  gap: 10px;
  font-size: 14px;
  color: #4b5563;
`

const Label = styled.label`
  font-weight: 600;
`

const Input = styled.input`
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid #d1d5db;
  border-radius: 14px;
  background: #f8fafc;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:focus-visible {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.12);
  }
`

const LoginButton = styled.button`
  width: 100%;
  min-height: 46px;
  border: none;
  border-radius: 14px;
  background: #4f46e5;
  color: #ffffff;
  font-weight: 600;
  transition: background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: #4338ca;
  }

  &:active {
    transform: translateY(1px);
  }
`

const ErrorMessage = styled.p`
  margin: 0;
  color: #b91c1c;
  font-size: 14px;
`

const DashboardShell = styled.div<{ open: boolean }>`
  width: min(1320px, 100%);
  min-height: calc(50vh - 5px);
  display: grid;
  grid-template-columns: ${({ open }) => (open ? '260px 1fr' : '80px 1fr')};
  gap: 24px;
  background: #364357a3;
  border-radius: 32px;
  box-shadow: 0 32px 90px rgba(15, 23, 42, 0.12);
  overflow: hidden;

  @media (max-width: 900px) {
    grid-template-columns: ${({ open }) => (open ? 'min(280px, 65vw) 1fr' : '64px 1fr')};
  }

  @media (max-width: 640px) {
    grid-template-columns: ${({ open }) => (open ? '100% 1fr' : '64px 1fr')};
  }
`

const MainArea = styled.main`
  display: flex;
  flex-direction: column;
  padding: 28px 28px 32px;
  gap: 28px;
`
