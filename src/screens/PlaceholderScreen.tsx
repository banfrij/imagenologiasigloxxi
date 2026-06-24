import styled from 'styled-components'

interface PlaceholderScreenProps {
  title: string
  description: string
}

export default function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  return (
    <PlaceholderShell>
      <PageHeader>
        <PageHeading>{title}</PageHeading>
        <PageDescription>{description}</PageDescription>
      </PageHeader>
      <PlaceholderContent>Contenido de la sección próximamente.</PlaceholderContent>
    </PlaceholderShell>
  )
}

const PlaceholderShell = styled.section`
  display: grid;
  gap: 24px;
`

const PageHeader = styled.header`
  display: grid;
  gap: 10px;
`

const PageHeading = styled.h1`
  margin: 0;
  font-size: 32px;
  letter-spacing: -0.8px;
`

const PageDescription = styled.p`
  margin: 0;
  color: #475569;
  line-height: 1.7;
`

const PlaceholderContent = styled.div`
  min-height: 280px;
  border-radius: 24px;
  background: #f8fafc;
  border: 1px dashed #d1d5db;
  display: grid;
  place-items: center;
  color: #64748b;
  font-size: 16px;
  text-align: center;
  padding: 28px;
`
