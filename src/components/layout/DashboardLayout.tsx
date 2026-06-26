import styled from 'styled-components'
import Sidebar, { type SidebarItem } from '../Sidebar'

interface DashboardLayoutProps {
  open: boolean
  items: SidebarItem[]
  activeSection: SidebarItem['section']
  onSelectSection: (section: SidebarItem['section']) => void
  onToggleSidebar: () => void
  onLogout: () => void
  children: React.ReactNode
}

export default function DashboardLayout({
  open,
  items,
  activeSection,
  onSelectSection,
  onToggleSidebar,
  onLogout,
  children,
}: DashboardLayoutProps) {
  return (
    <DashboardShell $open={open}>
      <Sidebar
        open={open}
        items={items}
        activeSection={activeSection}
        onSelect={onSelectSection}
        onToggle={onToggleSidebar}
        onLogout={onLogout}
      />
      <MainArea>{children}</MainArea>
    </DashboardShell>
  )
}

const DashboardShell = styled.div<{ $open: boolean }>`
  width: min(1320px, 100%);
  min-height: calc(50vh - 5px);
  display: grid;
  grid-template-columns: ${({ $open }) => ($open ? '260px 1fr' : '80px 1fr')};
  gap: 24px;
  background: #364357a3;
  border-radius: 32px;
  box-shadow: 0 32px 90px rgba(15, 23, 42, 0.12);
  overflow: hidden;

  @media (max-width: 900px) {
    grid-template-columns: ${({ $open }) => ($open ? 'min(280px, 65vw) 1fr' : '64px 1fr')};
  }

  @media (max-width: 640px) {
    grid-template-columns: ${({ $open }) => ($open ? '100% 1fr' : '64px 1fr')};
  }
`

const MainArea = styled.main`
  display: flex;
  flex-direction: column;
  padding: 28px 28px 32px;
  gap: 28px;
`
