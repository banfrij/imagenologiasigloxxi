import styled from 'styled-components'

const dashboardCards = [
  { title: 'Sucursal', description: 'Ubicación y datos clave.' },
  { title: 'Pacientes', description: 'Lista de registro y atención.' },
  { title: 'Estudios', description: 'Resumen de estudios disponibles.' },
  { title: 'Agenda', description: 'Citas y bloques de horario.' },
  { title: 'Facturación', description: 'Control de cobros y pagos.' },
  { title: 'Interpretaciones', description: 'Resultados y estados.' },
]

export default function HomeScreen() {
  return (
    <ScreenContainer>
      <PageHeader>
        <PageHeading>Home</PageHeading>
        <PageDescription>Panel de inicio con los accesos rápidos y la vista general del dashboard.</PageDescription>
      </PageHeader>

      <GridSection>
        {dashboardCards.map((card) => (
          <InfoCard key={card.title}>
            <CardTitle>{card.title}</CardTitle>
            <CardText>{card.description}</CardText>
          </InfoCard>
        ))}
      </GridSection>
    </ScreenContainer>
  )
}

const ScreenContainer = styled.section`
  display: grid;
  gap: 28px;
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

const GridSection = styled.section`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  align-items: stretch;
`

const InfoCard = styled.article`
  min-height: 150px;
  padding: 24px;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const CardTitle = styled.h2`
  margin: 0;
  font-size: 20px;
  color: #111827;
`

const CardText = styled.p`
  margin: 0;
  color: #475569;
  line-height: 1.7;
`
