import styled from 'styled-components'

export interface SidebarItem {
  label: string
  section: 'agenda' | 'facturacion' | 'interpretaciones' | 'pacientes' | 'traslados' | 'reportes' | 'estudios'
}

interface SidebarProps {
  open: boolean
  items: SidebarItem[]
  activeSection: string
  onSelect: (section: SidebarItem['section']) => void
  onToggle: () => void
  onLogout: () => void
}

const iconMap: Record<SidebarItem['section'], string> = {
  agenda: '📅',
  facturacion: '💳',
  interpretaciones: '🧾',
  pacientes: '👤',
  estudios: '🔬',
  traslados: '🚑',
  reportes: '📊',
}

export default function Sidebar({ open, items, activeSection, onSelect, onToggle, onLogout }: SidebarProps) {
  return (
    <SidebarShell $open={open} aria-label="Navegación lateral">
      <SidebarHeader>
        <Brand>{open ? 'IMG XXI' : 'I'}</Brand>
        <SidebarToggle type="button" onClick={onToggle} aria-expanded={open} $open={open}>
          {open ? 'Ocultar ◀' : '☰'}
        </SidebarToggle>
      </SidebarHeader>
      <SidebarNav>
        {items.map((item) => (
          <SidebarItemButton
            key={item.section}
            type="button"
            onClick={() => onSelect(item.section)}
            $active={activeSection === item.section}
            $open={open}
          >
            <SidebarIcon>{iconMap[item.section]}</SidebarIcon>
            {open ? item.label : null}
          </SidebarItemButton>
        ))}
      </SidebarNav>
      <SidebarFooter>
        <LogoutButton type="button" onClick={onLogout} $open={open}>
          {open ? 'Cerrar sesión' : '↩'}
        </LogoutButton>
      </SidebarFooter>
    </SidebarShell>
  )
}

const SidebarShell = styled.aside<{ $open: boolean }>`
  background: #0f172a;
  color: #e2e8f0;
  padding: ${({ $open }) => ($open ? '24px 18px' : '20px 14px')};
  display: flex;
  flex-direction: column;
  gap: ${({ $open }) => ($open ? '20px' : '14px')};
  width: ${({ $open }) => ($open ? '260px' : '80px')};
  transition: width 0.28s ease, transform 0.28s ease;

  @media (max-width: 900px) {
    position: relative;
    z-index: 40;
    width: ${({ $open }) => ($open ? 'min(280px, 65vw)' : '64px')};
    padding: ${({ $open }) => ($open ? '20px 14px' : '18px 10px')};
  }

  @media (max-width: 640px) {
    width: ${({ $open }) => ($open ? '100%' : '64px')};
    padding: ${({ $open }) => ($open ? '18px 14px' : '16px 10px')};
  }
`

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
`

const Brand = styled.span`
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.6px;
`

const SidebarToggle = styled.button<{ $open?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  padding: ${({ $open }) => ($open ? '10px 14px' : '8px')};
  color: #ffffff;
  background: ${({ $open }) => ($open ? 'linear-gradient(90deg,#4f46e5,#7c3aed)' : 'rgba(255,255,255,0.06)')};
  border: none;
  border-radius: 999px;
  box-shadow: ${({ $open }) => ($open ? '0 6px 20px rgba(79,70,229,0.18)' : 'none')};
  transition: background 0.22s ease, box-shadow 0.22s ease, transform 0.18s ease;

  &:hover {
    transform: translateY(-1px);
  }

  ${({ $open }) =>
    !$open &&
    `
    width: 38px;
    height: 38px;
    padding: 0;
    justify-content: center;
    border-radius: 12px;
  `}

  @media (max-width: 640px) {
    width: 100%;
    justify-content: center;
  }
`

const SidebarNav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* prevent nav from stretching to fill vertical space */
  flex: 0 0 auto;
`

const SidebarFooter = styled.div`
  display: flex;
  justify-content: center;
  /* push footer to bottom when sidebar has extra space */
  margin-top: auto;
`

const LogoutButton = styled.button<{ $open: boolean }>`
  width: 100%;
  border: none;
  background: #ef4444;
  color: #ffffff;
  font-weight: 700;
  border-radius: 16px;
  padding: ${({ $open }) => ($open ? '10px 14px' : '10px')};
  min-height: ${({ $open }) => ($open ? '40px' : '38px')};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s ease;

  &:hover {
    background: #dc2626;
  }
`

const SidebarItemButton = styled.button<{ $active: boolean; $open: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: ${({ $open }) => ($open ? '12px 14px' : '10px')};
  min-height: ${({ $open }) => ($open ? '44px' : '38px')};
  border: none;
  border-radius: 16px;
  color: ${({ $active }) => ($active ? '#f8fafc' : '#e2e8f0')};
  background: ${({ $active }) => ($active ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255, 255, 255, 0.03)')};
  text-align: left;
  transition: background 0.2s ease;

  &:hover,
  &:focus-visible {
    background: rgba(148, 163, 184, 0.16);
    outline: none;
  }

  position: relative;

  &:before {
    content: '';
    position: absolute;
    left: 10px;
    width: 6px;
    height: 36px;
    border-radius: 8px;
    background: ${({ $active }) => ($active ? '#6366f1' : 'transparent')};
    opacity: ${({ $open }) => ($open ? 1 : 0)};
    transition: opacity 0.18s ease, background 0.18s ease;
  }
`

const SidebarIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 16px;
`
