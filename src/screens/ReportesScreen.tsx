import { useMemo, useState } from 'react'
import styled from 'styled-components'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { db } from '../firebase'

type AppointmentReport = {
  id: number
  date: string
  time: string
  branch?: 'Alamos' | 'San Felipe'
  study: string
  noteTitle: string
  patient: string
  doctor: string
  ambulance: boolean
  oxygen: boolean
  sedation: boolean
  createdBy?: string
}

type AuditEvent = {
  action: 'AGENDO' | 'CANCELO'
  user: string
  idEstudio: number
  date: string
  time: string
  reason?: string | null
  createdAt: string
  patient?: string
  study?: string
  branch?: string
}

function formatDateDisplay(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (!year || !month || !day) return dateKey
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
}

function formatDateTimeDisplay(isoValue: string) {
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return isoValue
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return `${day}/${month}/${year} ${time}`
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0)
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekBounds(reference: Date) {
  const normalized = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate(), 12, 0, 0, 0)
  const day = normalized.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const weekStart = new Date(normalized)
  weekStart.setDate(normalized.getDate() + diffToMonday)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  return { weekStart, weekEnd }
}

function isWithinWeek(dateKey: string, start: Date, end: Date) {
  const date = parseDateKey(dateKey)
  return date >= start && date <= end
}

export default function ReportesScreen() {
  const [appointments, setAppointments] = useState<AppointmentReport[]>([])
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [referenceDate, setReferenceDate] = useState(() => new Date())
  const [hasSearched, setHasSearched] = useState(false)
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false)

  const { weekStart, weekEnd } = useMemo(() => getWeekBounds(referenceDate), [referenceDate])
  const weekStartKey = toDateInputValue(weekStart)
  const weekEndKey = toDateInputValue(weekEnd)

  const fetchAudit = async () => {
    const auditQuery = query(
      collection(db, 'appointment_audit'),
      where('date', '>=', weekStartKey),
      where('date', '<=', weekEndKey),
    )
    const auditSnap = await getDocs(auditQuery)
    const auditRows = auditSnap.docs.map((document) => document.data() as AuditEvent)
    const search = patientSearch.trim().toLowerCase()
    const filteredAudit =
      !search
        ? auditRows
        : auditRows.filter((event) => (event.patient ?? '').toLowerCase().includes(search))

    setAudit(
      filteredAudit.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime()
        const bTime = new Date(b.createdAt).getTime()
        return bTime - aTime
      }),
    )
    setHasLoadedHistory(true)
  }

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const appointmentsQuery = query(
        collection(db, 'appointments'),
        where('date', '>=', weekStartKey),
        where('date', '<=', weekEndKey),
      )
      const appointmentsSnap = await getDocs(appointmentsQuery)

      const appointmentRows = appointmentsSnap.docs.map((document) => document.data() as AppointmentReport)
      const search = patientSearch.trim().toLowerCase()
      const filteredRows =
        !search
          ? appointmentRows
          : appointmentRows.filter((row) => row.patient.toLowerCase().includes(search))

      setAppointments(filteredRows)
      setHasSearched(true)
    } catch (error) {
      console.error('Error cargando reportes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const weeklyAppointments = useMemo(() => {
    if (!hasSearched) return []
    return appointments
      .filter((row) => isWithinWeek(row.date, weekStart, weekEnd))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.time.localeCompare(b.time)
      })
  }, [appointments, hasSearched, weekStart, weekEnd])

  const totalServices = weeklyAppointments.length

  const exportWeeklyPdf = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4')

    doc.setFillColor(46, 149, 46)
    doc.rect(8, 8, 281, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(15)
    doc.text('IMAGENOLOGIA SIGLO XXI', 12, 16)
    doc.setFontSize(8)
    doc.text(`Reporte semanal: ${formatDateDisplay(toDateInputValue(weekStart))} - ${formatDateDisplay(toDateInputValue(weekEnd))}`, 12, 22)

    doc.setTextColor(0, 0, 0)
    doc.setFillColor(236, 242, 236)
    doc.rect(8, 30, 90, 14, 'F')
    doc.rect(101, 30, 90, 14, 'F')
    doc.rect(194, 30, 95, 14, 'F')
    doc.setFontSize(8)
    doc.text('TOTAL SERVICIOS', 45, 35, { align: 'center' })
    doc.text('PACIENTES EN LISTA', 146, 35, { align: 'center' })
    doc.text('BÚSQUEDA ACTIVA', 241, 35, { align: 'center' })
    doc.setFontSize(11)
    doc.text(String(totalServices), 45, 41, { align: 'center' })
    doc.text(String(new Set(weeklyAppointments.map((item) => item.patient)).size), 146, 41, { align: 'center' })
    doc.text(patientSearch.trim() || 'NINGUNA', 241, 41, { align: 'center' })

    autoTable(doc, {
      startY: 48,
      head: [[
        'FOLIO',
        'FECHA',
        'INICIO',
        'CLINICA',
        'ESTUDIO',
        'SUBESTUDIO',
        'PACIENTE',
        'MEDICO',
        'AMB',
        'OXIGENO',
        'ANESTESIA',
        'USUARIO',
        'ESTADO',
      ]],
      body: weeklyAppointments.map((row) => [
        String(row.id),
        formatDateDisplay(row.date),
        row.time,
        row.branch === 'San Felipe' ? 'SAN FELIPE' : 'ALAMOS',
        row.study,
        row.noteTitle,
        row.patient,
        row.doctor,
        row.ambulance ? 'SI' : 'NO',
        row.oxygen ? 'SI' : 'NO',
        row.sedation ? 'SI' : 'NO',
        row.createdBy || 'N/D',
        'A',
      ]),
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [80, 162, 80] },
      margin: { left: 8, right: 8 },
    })

    doc.save(`reporte_pacientes_${toDateInputValue(weekStart)}_${toDateInputValue(weekEnd)}.pdf`)
  }

  return (
    <ReportShell>
      <PageHeader>
        <PageHeading>Reportes</PageHeading>
        <PageDescription>Historial de agenda/cancelación y concentrado semanal de pacientes con descarga en PDF.</PageDescription>
      </PageHeader>

      <ControlsCard>
        <ControlGroup>
          <ControlLabel>Semana de referencia</ControlLabel>
          <ControlInput
            id="weekDate"
            type="date"
            value={toDateInputValue(referenceDate)}
            onChange={(event) => setReferenceDate(parseDateKey(event.target.value))}
          />
        </ControlGroup>
        <ControlGroup>
          <ControlLabel>Buscar paciente</ControlLabel>
          <ControlInput
            id="patientSearch"
            value={patientSearch}
            onChange={(event) => setPatientSearch(event.target.value)}
            placeholder="Nombre del paciente"
          />
        </ControlGroup>
        <ControlActions>
          <ActionButton type="button" onClick={() => void fetchData()}>
            Buscar
          </ActionButton>
          <PrimaryButton type="button" onClick={exportWeeklyPdf} disabled={!hasSearched}>
            Descargar PDF
          </PrimaryButton>
        </ControlActions>
      </ControlsCard>

      <SummaryGrid>
        <SummaryCard>
          <SummaryLabel>Total servicios</SummaryLabel>
          <SummaryValue>{totalServices}</SummaryValue>
        </SummaryCard>
        <SummaryCard>
          <SummaryLabel>Semana</SummaryLabel>
          <SummaryValue>{formatDateDisplay(toDateInputValue(weekStart))} - {formatDateDisplay(toDateInputValue(weekEnd))}</SummaryValue>
        </SummaryCard>
      </SummaryGrid>

      <SectionCard>
        <SectionTitle>Concentrado semanal de pacientes</SectionTitle>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Inicio</th>
                <th>Clínica</th>
                <th>Estudio</th>
                <th>Subestudio</th>
                <th>Paciente</th>
                <th>Médico</th>
                <th>Amb</th>
                <th>Oxígeno</th>
                <th>Anestesia</th>
                <th>Usuario</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {weeklyAppointments.map((row) => (
                <tr key={`${row.id}-${row.date}-${row.time}`}>
                  <td>{row.id}</td>
                  <td>{formatDateDisplay(row.date)}</td>
                  <td>{row.time}</td>
                  <td>{row.branch === 'San Felipe' ? 'San Felipe' : 'Alamos'}</td>
                  <td>{row.study}</td>
                  <td>{row.noteTitle}</td>
                  <td>{row.patient}</td>
                  <td>{row.doctor}</td>
                  <td>{row.ambulance ? 'SI' : 'NO'}</td>
                  <td>{row.oxygen ? 'SI' : 'NO'}</td>
                  <td>{row.sedation ? 'SI' : 'NO'}</td>
                  <td>{row.createdBy || 'N/D'}</td>
                  <td>A</td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!hasSearched && <EmptyText>Ejecuta una búsqueda para mostrar datos.</EmptyText>}
          {hasSearched && !isLoading && weeklyAppointments.length === 0 && <EmptyText>No hay datos para esta semana.</EmptyText>}
        </TableWrap>
      </SectionCard>

      <SectionCard>
        <SectionHeader>
          <SectionTitle>Historial de agenda y cancelación</SectionTitle>
          <ActionButton type="button" onClick={() => void fetchAudit()}>
            Refrescar historial
          </ActionButton>
        </SectionHeader>
        <HistoryList>
          {audit.slice(0, 40).map((event, index) => (
            <HistoryItem key={`${event.createdAt}-${event.idEstudio}-${index}`}>
              <strong>{event.action}</strong> | Usuario: {event.user} | Id_estudio: {event.idEstudio} | Fecha cita: {formatDateDisplay(event.date)} {event.time} | Registrado: {formatDateTimeDisplay(event.createdAt)}
              {event.action === 'CANCELO' && event.reason ? ` | Razón: ${event.reason}` : ''}
            </HistoryItem>
          ))}
          {!hasLoadedHistory && <EmptyText>Usa "Refrescar historial" para consultar movimientos.</EmptyText>}
          {hasLoadedHistory && !isLoading && audit.length === 0 && <EmptyText>No hay movimientos en historial todavía.</EmptyText>}
        </HistoryList>
      </SectionCard>
    </ReportShell>
  )
}

const ReportShell = styled.section`
  display: grid;
  gap: 18px;
`

const PageHeader = styled.header`
  display: grid;
  gap: 8px;
`

const PageHeading = styled.h1`
  margin: 0;
  font-size: 32px;
`

const PageDescription = styled.p`
  margin: 0;
  color: #475569;
`

const ControlsCard = styled.div`
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

const ControlGroup = styled.label`
  display: grid;
  gap: 8px;
`

const ControlLabel = styled.span`
  font-size: 13px;
  color: #475569;
  font-weight: 700;
`

const ControlInput = styled.input`
  min-height: 40px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 0 12px;
  background: #f8fafc;
`

const ControlActions = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-end;
`

const ActionButton = styled.button`
  border: 1px solid #cbd5e1;
  background: #ffffff;
  border-radius: 12px;
  padding: 10px 14px;
  font-weight: 700;
`

const PrimaryButton = styled.button`
  border: none;
  background: #15803d;
  color: #ffffff;
  border-radius: 12px;
  padding: 10px 14px;
  font-weight: 700;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

const SummaryGrid = styled.div`
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`

const SummaryCard = styled.div`
  border: 1px solid #dbe2ea;
  border-radius: 16px;
  background: #f8fafc;
  padding: 12px;
  display: grid;
  gap: 6px;
`

const SummaryLabel = styled.span`
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`

const SummaryValue = styled.strong`
  font-size: 18px;
  color: #0f172a;
`

const SectionCard = styled.section`
  background: #ffffff;
  border: 1px solid #dbe2ea;
  border-radius: 18px;
  padding: 14px;
  display: grid;
  gap: 12px;
`

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 20px;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`

const TableWrap = styled.div`
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    border: 1px solid #e2e8f0;
    padding: 7px 8px;
    font-size: 12px;
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

const HistoryList = styled.div`
  display: grid;
  gap: 8px;
`

const HistoryItem = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  padding: 10px;
  font-size: 13px;
  color: #334155;
`
