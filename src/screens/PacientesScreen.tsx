import { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

type PatientRow = {
  id: number
  patient: string
  number: string
  study: string
  date: string
  time: string
  branch?: string
  doctor?: string
}

function formatDateDisplay(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (!year || !month || !day) return dateKey
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
}

export default function PacientesScreen() {
  const [rows, setRows] = useState<PatientRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [nameFilter, setNameFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const fetchPatients = async () => {
    setIsLoading(true)
    try {
      const snapshot = await getDocs(collection(db, 'appointments'))
      const data = snapshot.docs.map((document) => document.data() as PatientRow)
      setRows(data)
    } catch (error) {
      console.error('Error cargando pacientes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchPatients()
  }, [])

  const filteredRows = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase()
    return rows
      .filter((row) => !normalizedName || row.patient.toLowerCase().includes(normalizedName))
      .filter((row) => !dateFilter || row.date === dateFilter)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.time.localeCompare(b.time)
      })
  }, [rows, nameFilter, dateFilter])

  return (
    <Shell>
      <Header>
        <Title>Pacientes</Title>
        <Description>Listado por nombre, estudio realizado y fecha con actualización manual.</Description>
      </Header>

      <FiltersCard>
        <Field>
          <Label>Buscar por nombre</Label>
          <Input
            id="patientNameFilter"
            value={nameFilter}
            onChange={(event) => setNameFilter(event.target.value)}
            placeholder="Nombre del paciente"
          />
        </Field>
        <Field>
          <Label>Fecha</Label>
          <Input
            id="patientDateFilter"
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />
        </Field>
        <Actions>
          <RefreshButton type="button" onClick={() => void fetchPatients()}>
            Actualizar
          </RefreshButton>
        </Actions>
      </FiltersCard>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Teléfono</th>
              <th>Estudio</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Sucursal</th>
              <th>Médico</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={`${row.id}-${row.date}-${row.time}`}>
                <td>{row.patient}</td>
                <td>{row.number || 'N/D'}</td>
                <td>{row.study}</td>
                <td>{formatDateDisplay(row.date)}</td>
                <td>{row.time}</td>
                <td>{row.branch ?? 'Alamos'}</td>
                <td>{row.doctor ?? 'N/D'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!isLoading && filteredRows.length === 0 && <EmptyText>No hay pacientes para los filtros seleccionados.</EmptyText>}
      </TableWrap>
    </Shell>
  )
}

const Shell = styled.section`
  display: grid;
  gap: 16px;
`

const Header = styled.header`
  display: grid;
  gap: 8px;
`

const Title = styled.h1`
  margin: 0;
  font-size: 32px;
`

const Description = styled.p`
  margin: 0;
  color: #475569;
`

const FiltersCard = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  background: #ffffff;
  border: 1px solid #dbe2ea;
  border-radius: 18px;
  padding: 14px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`

const Field = styled.label`
  display: grid;
  gap: 8px;
`

const Label = styled.span`
  font-size: 13px;
  color: #475569;
  font-weight: 700;
`

const Input = styled.input`
  min-height: 40px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 0 12px;
  background: #f8fafc;
`

const Actions = styled.div`
  display: flex;
  align-items: flex-end;
`

const RefreshButton = styled.button`
  border: none;
  border-radius: 12px;
  background: #15803d;
  color: #ffffff;
  padding: 10px 14px;
  font-weight: 700;
`

const TableWrap = styled.div`
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    border: 1px solid #e2e8f0;
    padding: 8px;
    font-size: 13px;
    text-align: left;
    white-space: nowrap;
  }

  thead th {
    background: #41a541;
    color: #ffffff;
  }
`

const EmptyText = styled.p`
  margin: 0;
  padding: 12px;
  color: #64748b;
`
