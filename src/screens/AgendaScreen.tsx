import { useEffect, useRef, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore'
import styled from 'styled-components'
import AppointmentForm, { type AppointmentData, type AppointmentFormValues } from '../components/AppointmentForm'
import { auth, db } from '../firebase'

const BRANCHES = ['Alamos', 'San Felipe'] as const
type BranchName = (typeof BRANCHES)[number]
type BranchView = BranchName | 'Ambas'

const formatBranchLabel = (branch: BranchName) => (branch === 'Alamos' ? 'Álamos' : 'San Felipe')

const ALL_COLUMNS = ['RM', 'TC', 'RXUSG'] as const
type ScheduleColumn = (typeof ALL_COLUMNS)[number]

const BRANCH_COLUMNS: Record<BranchName, ScheduleColumn[]> = {
  Alamos: [...ALL_COLUMNS],
  'San Felipe': ['RM', 'TC'],
}

const columnToTechniques: Record<ScheduleColumn, AppointmentData['technique'][]> = {
  RM: ['RM'],
  TC: ['TC'],
  RXUSG: ['Rayos X', 'Ultrasonido'],
}

const studyCatalog: Record<AppointmentData['technique'], string[]> = {
  RM: ['RM Columna', 'RM Craneal', 'RM Abdominal'],
  TC: ['TC Abdomen', 'TC Craneal', 'TC Tórax'],
  'Rayos X': ['Rx Tórax', 'Rx Abdominal', 'Rx Columna'],
  Ultrasonido: ['US Abdomen', 'US Músculo-esquelético', 'US Doppler'],
}

const timeLabels = generateTimeLabels(7 * 60, 23 * 60)

function generateTimeLabels(startMinutes: number, endMinutes: number) {
  return Array.from({ length: Math.floor((endMinutes - startMinutes) / 30) + 1 }, (_, index) =>
    formatTime(startMinutes + index * 30),
  )
}

function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}:${mins.toString().padStart(2, '0')}`
}

function buildCalendarGrid(month: Date) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
  const startGrid = new Date(firstOfMonth)
  const weekday = startGrid.getDay() || 7
  startGrid.setDate(startGrid.getDate() - (weekday - 1))

  return Array.from({ length: 6 }, () => {
    return Array.from({ length: 7 }, () => {
      const date = new Date(startGrid)
      startGrid.setDate(startGrid.getDate() + 1)
      return date
    })
  })
}

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function toDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function clampToAgendaYear(date: Date) {
  const min = new Date(2026, 0, 1, 12, 0, 0, 0)
  const max = new Date(2026, 11, 31, 12, 0, 0, 0)
  if (date < min) return min
  if (date > max) return max
  return date
}

function formatUserTag(value?: string) {
  if (!value) return 'N/D'
  return value.split('@')[0]
}

function formatDateTimeFromIso(value?: string) {
  if (!value) return '--:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hour = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return `${day}/${month}/${year} ${hour}`
}

type SelectedSlot = {
  branch: BranchName
  technique: AppointmentData['technique']
  time: string
  appointment?: AppointmentData
}

type ToolColor = {
  value: string
  label: string
}

type CellColorMark = {
  id: string
  date: string
  branch: BranchName
  column: ScheduleColumn
  time: string
  color: string
  colorLabel: string
  note: string
  createdBy: string
  createdAt: string
}

const STORAGE_KEY = 'ImgXXI_AgendaAppointments'
const COLOR_MARKS_STORAGE_KEY = 'ImgXXI_AgendaColorMarks'
const COLOR_MARKS_COLLECTION = 'agenda_color_marks'

const TOOL_COLORS: ToolColor[] = [
  { value: '#f59e0b', label: 'Ausencia parcial' },
  { value: '#ef4444', label: 'Técnico ausente' },
  { value: '#22c55e', label: 'Disponible' },
  { value: '#3b82f6', label: 'Mantenimiento' },
]

const COLOR_MARK_EDITORS = [
  'alamos01m@gmail.com',
  'alamos02m@gmail.com',
  'alamos03t@gmail.com',
  'alamos04u@gmail.com',
]

export default function AgendaScreen() {
  const [activeDate, setActiveDate] = useState(() => clampToAgendaYear(toDateOnly(new Date())))
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const initial = new Date()
    initial.setFullYear(2026)
    initial.setDate(1)
    return initial
  })
  const [fullscreen, setFullscreen] = useState(false)
  const [selectedCell, setSelectedCell] = useState<SelectedSlot | null>(null)
  const [appointments, setAppointments] = useState<AppointmentData[]>([])
  const [nextAppointmentId, setNextAppointmentId] = useState(0)

  const [newlyCreatedAppointmentId, setNewlyCreatedAppointmentId] = useState<number | null>(null)
  const [calendarCollapsed, setCalendarCollapsed] = useState(false)
  const [branchView, setBranchView] = useState<BranchView>('Ambas')
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [selectedToolColor, setSelectedToolColor] = useState<ToolColor | null>(null)
  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false)
  const [toolNote, setToolNote] = useState('')
  const [colorMarks, setColorMarks] = useState<CellColorMark[]>(() => {
    if (typeof window === 'undefined') return []
    const raw = window.localStorage.getItem(COLOR_MARKS_STORAGE_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as CellColorMark[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const floatingToolsRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!isColorPaletteOpen) return
      const target = event.target as Node | null
      if (!target) return
      if (floatingToolsRef.current?.contains(target)) return
      setIsColorPaletteOpen(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isColorPaletteOpen])

  const applyActiveDate = (date: Date) => {
    const normalized = clampToAgendaYear(toDateOnly(date))
    setActiveDate(normalized)
    setCalendarMonth(new Date(2026, normalized.getMonth(), 1))
  }

  const seedFirstAppointment = async () => {
    if (branchView === 'Ambas') {
      window.alert('Selecciona una sucursal específica para registrar el primer paciente.')
      return
    }

    const branchAppointments = appointments.filter(
      (appointment) => (appointment.branch ?? 'Alamos') === branchView,
    )

    if (branchAppointments.length > 0) {
      window.alert('Ya hay citas registradas. El primer paciente solo se puede agregar cuando la agenda está vacía.')
      return
    }

    const values: AppointmentFormValues = {
      technique: 'RM',
      study: studyCatalog.RM[1] ?? studyCatalog.RM[0],
      duration: '1 hr',
      patient: 'Juan Pérez',
      age: '32',
      number: '0001',
      doctor: 'Dr. Martínez',
      ambulance: false,
      sedation: false,
      oxygen: false,
      noteTitle: 'Primer paciente',
      observation: 'Primer paciente registrado en la colección.',
    }

    const newAppointment: AppointmentData = {
      id: nextAppointmentId,
      time: '09:00',
      date: activeDateString,
      branch: branchView,
      ...values,
    }

    const firestoreId = await saveAppointmentToFirestore(newAppointment)
    const appointmentWithDocId = firestoreId ? { ...newAppointment, firestoreId } : newAppointment
    syncAppointments([...appointments, appointmentWithDocId])
    await logAppointmentAudit('AGENDO', appointmentWithDocId)
    setNextAppointmentId((current) => current + 1)
    setNewlyCreatedAppointmentId(newAppointment.id)
    window.setTimeout(() => setNewlyCreatedAppointmentId(null), 8000)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const loadAppointments = async () => {
      let storedAppointments: AppointmentData[] = []
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        try {
          storedAppointments = JSON.parse(raw) as AppointmentData[]
        } catch {
          storedAppointments = []
        }
      }

      setAppointments(storedAppointments)
      setNextAppointmentId(
        storedAppointments.reduce((max, item) => Math.max(max, item.id), -1) + 1,
      )

      try {
        const snapshot = await getDocs(collection(db, 'appointments'))
        if (!snapshot.empty) {
          const firestoreAppointments = snapshot.docs.map((document) => ({
            branch: 'Alamos' as BranchName,
            ...(document.data() as AppointmentData),
            firestoreId: document.id,
          }))

          const mergedAppointments = [
            ...firestoreAppointments,
            ...storedAppointments.filter(
              (stored) => !firestoreAppointments.some((remote) => remote.id === stored.id),
            ),
          ]

          setAppointments(mergedAppointments)
          setNextAppointmentId(
            mergedAppointments.reduce((max, item) => Math.max(max, item.id), -1) + 1,
          )
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedAppointments))
        }
      } catch (error) {
        console.error('Error cargando citas de Firestore:', error)
      }
    }

    void loadAppointments()
  }, [])

  const activeDateString = formatLocalDateKey(activeDate)
  const calendarGrid = buildCalendarGrid(calendarMonth)
  const currentMonth = activeDate.toLocaleString('es-ES', { month: 'long' })
  const currentDay = activeDate.getDate()
  const currentWeekday = activeDate.toLocaleString('es-ES', { weekday: 'long' })
  const currentHourLabel = currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const currentUserLabel = formatUserTag(auth.currentUser?.email ?? 'N/D')
  const visibleBranches: BranchName[] = branchView === 'Ambas' ? [...BRANCHES] : [branchView]
  const branchViewLabel = branchView === 'Ambas' ? 'Álamos y San Felipe' : formatBranchLabel(branchView)
  const primaryBranch = branchView === 'Ambas' ? 'Alamos' : branchView
  const canEditColorMarks = COLOR_MARK_EDITORS.includes((auth.currentUser?.email ?? '').toLowerCase())

  useEffect(() => {
    const marksQuery = query(
      collection(db, COLOR_MARKS_COLLECTION),
      where('date', '==', activeDateString),
    )

    const unsubscribe = onSnapshot(
      marksQuery,
      (snapshot) => {
        const remoteMarks = snapshot.docs.map((document) => {
          const data = document.data() as Omit<CellColorMark, 'id'>
          return {
            ...data,
            id: document.id,
          }
        })

        setColorMarks((current) => {
          const next = [...current.filter((mark) => mark.date !== activeDateString), ...remoteMarks]
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(COLOR_MARKS_STORAGE_KEY, JSON.stringify(next))
          }
          return next
        })
      },
      (error) => {
        console.error('Error sincronizando marcas de color en Firestore:', error)
      },
    )

    return () => unsubscribe()
  }, [activeDateString])

  const today = new Date()
  const isActiveDateToday = activeDate.toDateString() === today.toDateString()

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      setFullscreen(false)
    } else if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen()
      setFullscreen(true)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingInField = Boolean(
        target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable),
      )

      if (isTypingInField || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key.toLowerCase() !== 'f') return

      event.preventDefault()
      void toggleFullscreen()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const changeDateByDays = (days: number) => {
    const next = toDateOnly(activeDate)
    next.setDate(next.getDate() + days)
    applyActiveDate(next)
  }

  const changeCalendarMonth = (months: number) => {
    setCalendarMonth((current) => {
      const next = new Date(current)
      next.setMonth(current.getMonth() + months)
      if (next.getFullYear() !== 2026) {
        return current
      }
      return next
    })
  }

  const hasAppointmentsInPrimaryBranch = appointments.some(
    (appointment) => (appointment.branch ?? 'Alamos') === primaryBranch,
  )

  const getColumnHasAppointments = (
    branch: BranchName,
    branchColumns: ScheduleColumn[],
  ): Record<ScheduleColumn, boolean> =>
    branchColumns.reduce((acc, col) => {
      const techniques = columnToTechniques[col] ?? ['RM']
      acc[col] = appointments.some(
        (appointment) =>
          (appointment.branch ?? 'Alamos') === branch &&
          techniques.includes(appointment.technique) &&
          appointment.date === activeDateString,
      )
      return acc
    }, {} as Record<ScheduleColumn, boolean>)

  const durationToMinutes = (duration: string) => {
    const value = duration.trim().toLowerCase().replace(',', '.')

    const mixedMatch = value.match(/^(\d+)\s*h(?:r)?\s*(\d+)\s*min$/)
    if (mixedMatch) return Number(mixedMatch[1]) * 60 + Number(mixedMatch[2])

    const minutesMatch = value.match(/^(\d+)\s*min$/)
    if (minutesMatch) return Number(minutesMatch[1])

    const hoursMatch = value.match(/^(\d+)(?:[.:](\d+))?\s*h(?:r)?$/)
    if (hoursMatch) {
      const hours = Number(hoursMatch[1])
      const fraction = hoursMatch[2]
      if (!fraction) return hours * 60

      const maybeMinutes = Number(fraction)
      const extraMinutes = maybeMinutes < 60 ? maybeMinutes : Math.round(Number(`0.${fraction}`) * 60)
      return hours * 60 + extraMinutes
    }

    if (value === '1.5 hr') return 90
    if (value === '1.30 hr') return 90
    if (value === '1 hr') return 60
    if (value === '2 hr') return 120
    return 30
  }

  const timeStringToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  const getSlotTimes = (startTime: string, durationMinutes: number) => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const start = hours * 60 + minutes
    const slots = Math.max(1, durationMinutes / 30)
    return Array.from({ length: slots }, (_, index) => {
      const value = start + index * 30
      const hour = Math.floor(value / 60)
      const minute = value % 60
      return `${hour}:${minute.toString().padStart(2, '0')}`
    })
  }

  const getAppointmentCoveringSlot = (branch: BranchName, column: ScheduleColumn, time: string) => {
    const techniques = columnToTechniques[column] ?? ['RM']
    return appointments.find((appointment) => {
      if ((appointment.branch ?? 'Alamos') !== branch) return false
      if (!techniques.includes(appointment.technique)) return false
      if (appointment.date !== activeDateString) return false
      return getSlotTimes(appointment.time, durationToMinutes(appointment.duration)).includes(time)
    })
  }

  const isSlotAvailable = (
    branch: BranchName,
    technique: AppointmentData['technique'],
    startTime: string,
    durationMinutes: number,
    excludeId?: number,
  ) => {
    const requestedSlots = getSlotTimes(startTime, durationMinutes)
    return !appointments.some((appointment) => {
      if ((appointment.branch ?? 'Alamos') !== branch) return false
      if (technique === 'Rayos X') {
        if (!['Rayos X', 'Ultrasonido'].includes(appointment.technique)) return false
      } else if (appointment.technique !== technique) {
        return false
      }
      if (appointment.date !== activeDateString) return false
      if (excludeId !== undefined && appointment.id === excludeId) return false
      const occupiedSlots = getSlotTimes(appointment.time, durationToMinutes(appointment.duration))
      return occupiedSlots.some((slot) => requestedSlots.includes(slot))
    })
  }

  const handleCellClick = (branch: BranchName, column: ScheduleColumn, time: string) => {
    const technique = (columnToTechniques[column] ?? ['RM'])[0]
    const appointment = getAppointmentCoveringSlot(branch, column, time)
    const selectedTime = appointment ? appointment.time : time
    setSelectedCell({ branch, technique, time: selectedTime, appointment })
  }

  const syncAppointments = (nextAppointments: AppointmentData[]) => {
    setAppointments(nextAppointments)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAppointments))
    }
  }

  const appointmentPayload = (appointment: AppointmentData) => {
    const start = timeStringToMinutes(appointment.time)
    const userEmail = auth.currentUser?.email ?? 'desconocido'
    const nowIso = new Date().toISOString()
    const payload: Omit<AppointmentData, 'firestoreId'> & { startTimeMinutes: number; endTimeMinutes: number } = {
      id: appointment.id,
      time: appointment.time,
      date: appointment.date,
      branch: appointment.branch ?? 'Alamos',
      technique: appointment.technique,
      study: appointment.study,
      duration: appointment.duration,
      patient: appointment.patient,
      age: appointment.age,
      number: appointment.number,
      doctor: appointment.doctor,
      ambulance: appointment.ambulance,
      sedation: appointment.sedation,
      oxygen: appointment.oxygen,
      noteTitle: appointment.noteTitle,
      observation: appointment.observation,
      createdBy: appointment.createdBy ?? userEmail,
      createdAt: appointment.createdAt ?? nowIso,
      updatedBy: userEmail,
      updatedAt: nowIso,
      startTimeMinutes: start,
      endTimeMinutes: start + durationToMinutes(appointment.duration),
    }
    return payload
  }

  const saveAppointmentToFirestore = async (appointment: AppointmentData): Promise<string | null> => {
    try {
      const payload = appointmentPayload(appointment)
      if (appointment.firestoreId) {
        await updateDoc(doc(db, 'appointments', appointment.firestoreId), payload)
        return appointment.firestoreId
      }

      const docRef = await addDoc(collection(db, 'appointments'), payload)
      return docRef.id
    } catch (error) {
      console.error('Error guardando cita en Firestore:', error)
      return null
    }
  }

  const logAppointmentAudit = async (
    action: 'AGENDO' | 'CANCELO',
    appointment: AppointmentData,
    reason?: string,
  ) => {
    try {
      await addDoc(collection(db, 'appointment_audit'), {
        action,
        user: auth.currentUser?.email ?? 'desconocido',
        idEstudio: appointment.id,
        study: appointment.study,
        patient: appointment.patient,
        branch: appointment.branch ?? 'Alamos',
        date: appointment.date,
        time: appointment.time,
        reason: reason?.trim() || null,
        createdAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error guardando bitácora de citas:', error)
    }
  }

  const deleteAppointmentFromFirestore = async (appointment: AppointmentData) => {
    try {
      if (appointment.firestoreId) {
        await deleteDoc(doc(db, 'appointments', appointment.firestoreId))
        return
      }

      const appointmentQuery = query(collection(db, 'appointments'), where('id', '==', appointment.id))
      const snapshot = await getDocs(appointmentQuery)
      snapshot.forEach((document) => {
        void deleteDoc(doc(db, 'appointments', document.id))
      })
    } catch (error) {
      console.error('Error eliminando cita de Firestore:', error)
    }
  }

  const handleSaveAppointment = async (values: AppointmentFormValues) => {
    const cell = selectedCell
    if (!cell) return

    const durationMinutes = durationToMinutes(values.duration)
    const branch = cell.branch
    const technique = cell.technique
    const excludeId = cell.appointment?.id

    if (!isSlotAvailable(branch, technique, cell.time, durationMinutes, excludeId)) {
      window.alert('El horario no está disponible para esa duración.')
      return
    }

    if (cell.appointment) {
      const updatedAppointment: AppointmentData = {
        ...cell.appointment,
        branch,
        ...values,
      }
      const updatedAppointments = appointments.map((appointment) =>
        appointment.id === updatedAppointment.id ? updatedAppointment : appointment,
      )
      syncAppointments(updatedAppointments)
      const firestoreId = await saveAppointmentToFirestore(updatedAppointment)
      if (!updatedAppointment.firestoreId && firestoreId) {
        const appointmentsWithDocId = updatedAppointments.map((appointment) =>
          appointment.id === updatedAppointment.id ? { ...appointment, firestoreId } : appointment,
        )
        syncAppointments(appointmentsWithDocId)
      } else if (!firestoreId) {
        window.alert('No se pudo actualizar en Firestore. La cita quedó local y puede perderse al recargar.')
      }
    } else {
      const newAppointment: AppointmentData = {
        id: nextAppointmentId,
        time: cell.time,
        date: activeDateString,
        branch,
        ...values,
      }
      const firestoreId = await saveAppointmentToFirestore(newAppointment)
      const appointmentWithDocId = firestoreId ? { ...newAppointment, firestoreId } : newAppointment
      syncAppointments([...appointments, appointmentWithDocId])
      if (!firestoreId) {
        window.alert('No se pudo guardar en Firestore. La cita quedó local y puede perderse al recargar.')
      }
      await logAppointmentAudit('AGENDO', appointmentWithDocId)
      setNextAppointmentId((current) => current + 1)
      setNewlyCreatedAppointmentId(newAppointment.id)
      if (typeof window !== 'undefined') {
        window.setTimeout(() => setNewlyCreatedAppointmentId(null), 8000)
      }
    }

    setSelectedCell(null)
  }

  const handleDeleteAppointment = async () => {
    if (!selectedCell?.appointment) return

    const confirmed = window.confirm('¿Seguro que deseas cancelar esta cita?')
    if (!confirmed) return

    const reason = window.prompt('Especifica la razón de cancelación:')
    if (reason === null) return

    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      window.alert('Debes especificar una razón para cancelar la cita.')
      return
    }

    try {
      await addDoc(collection(db, 'appointment_cancellations'), {
        appointmentId: selectedCell.appointment.id,
        firestoreId: selectedCell.appointment.firestoreId ?? null,
        patient: selectedCell.appointment.patient,
        branch: selectedCell.appointment.branch ?? 'Alamos',
        technique: selectedCell.appointment.technique,
        date: selectedCell.appointment.date,
        time: selectedCell.appointment.time,
        reason: trimmedReason,
        cancelledBy: auth.currentUser?.email ?? 'desconocido',
        cancelledAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error guardando motivo de cancelación:', error)
    }

    await logAppointmentAudit('CANCELO', selectedCell.appointment, trimmedReason)

    await deleteAppointmentFromFirestore(selectedCell.appointment)
    syncAppointments(appointments.filter((appointment) => appointment.id !== selectedCell.appointment!.id))
    setSelectedCell(null)
  }

  const handleCancel = () => {
    setSelectedCell(null)
  }

  useEffect(() => {
    if (!selectedCell) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleCancel()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedCell])

  useEffect(() => {
    if (!selectedCell) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedCell])

  const getMarkKey = (date: string, branch: BranchName, column: ScheduleColumn, time: string) =>
    `${date}_${branch}_${column}_${time}`

  const saveColorMarks = (nextMarks: CellColorMark[]) => {
    setColorMarks(nextMarks)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COLOR_MARKS_STORAGE_KEY, JSON.stringify(nextMarks))
    }
  }

  const getCellColorMark = (branch: BranchName, column: ScheduleColumn, time: string) =>
    colorMarks.find((mark) => mark.id === getMarkKey(activeDateString, branch, column, time))

  const handleToggleCellColor = async (
    event: React.MouseEvent<HTMLButtonElement>,
    branch: BranchName,
    column: ScheduleColumn,
    time: string,
  ) => {
    event.stopPropagation()

    if (!canEditColorMarks) {
      window.alert('Tu usuario solo tiene permiso de lectura para los colores de agenda.')
      return
    }

    const existing = getCellColorMark(branch, column, time)

    if (existing && (!selectedToolColor || existing.color === selectedToolColor.value)) {
      saveColorMarks(colorMarks.filter((mark) => mark.id !== existing.id))
      try {
        await deleteDoc(doc(db, COLOR_MARKS_COLLECTION, existing.id))
      } catch (error) {
        console.error('Error eliminando marca de color en Firestore:', error)
        window.alert('No se pudo sincronizar la eliminación en Firestore. Se conservará en caché local.')
      }
      return
    }

    if (!selectedToolColor) {
      window.alert('Selecciona un color en la barra flotante para activar la celda.')
      return
    }
    const trimmed = toolNote.trim() || selectedToolColor.label

    const mark: CellColorMark = {
      id: getMarkKey(activeDateString, branch, column, time),
      date: activeDateString,
      branch,
      column,
      time,
      color: selectedToolColor.value,
      colorLabel: selectedToolColor.label,
      note: trimmed,
      createdBy: auth.currentUser?.email ?? 'desconocido',
      createdAt: new Date().toISOString(),
    }

    const withoutCurrent = colorMarks.filter((item) => item.id !== mark.id)
    saveColorMarks([...withoutCurrent, mark])
    try {
      await setDoc(doc(db, COLOR_MARKS_COLLECTION, mark.id), mark)
    } catch (error) {
      console.error('Error guardando marca de color en Firestore:', error)
      window.alert('No se pudo sincronizar la marca en Firestore. Quedó guardada en caché local.')
    }
  }

  const dayColorNotes = colorMarks
    .filter((mark) => mark.date === activeDateString)
    .filter((mark) => (branchView === 'Ambas' ? true : mark.branch === branchView))
    .sort((a, b) => a.time.localeCompare(b.time))

  const dayColorNotesSummary = dayColorNotes.reduce<
    Array<{ key: string; color: string; text: string; cells: number }>
  >((acc, item) => {
    const key = `${item.branch}-${item.color}-${item.note}`
    const found = acc.find((entry) => entry.key === key)
    if (found) {
      found.cells += 1
      return acc
    }
    acc.push({
      key,
      color: item.color,
      text: `${formatBranchLabel(item.branch)} · ${item.note}`,
      cells: 1,
    })
    return acc
  }, [])

  const occupiedTimes = timeLabels.filter((time) =>
    appointments.some(
      (appointment) =>
        visibleBranches.includes((appointment.branch ?? 'Alamos') as BranchName) &&
        appointment.date === activeDateString &&
        getSlotTimes(appointment.time, durationToMinutes(appointment.duration)).includes(time),
    ),
  )

  const scrollToOccupied = (direction: 'up' | 'down') => {
    if (occupiedTimes.length === 0) {
      window.alert('No hay pacientes en la agenda de este día.')
      return
    }

    const threshold = 170
    let candidate: string | undefined

    if (direction === 'down') {
      candidate = occupiedTimes.find((time) => {
        const row = rowRefs.current[time]
        if (!row) return false
        return row.getBoundingClientRect().top > threshold
      })
      candidate = candidate ?? occupiedTimes[occupiedTimes.length - 1]
    } else {
      candidate = [...occupiedTimes]
        .reverse()
        .find((time) => {
          const row = rowRefs.current[time]
          if (!row) return false
          return row.getBoundingClientRect().top < threshold
        })
      candidate = candidate ?? occupiedTimes[0]
    }

    const target = rowRefs.current[candidate]
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToLateHour = () => {
    const atNineteen = rowRefs.current['19:00']
    if (atNineteen) {
      atNineteen.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    const lastLabel = timeLabels[timeLabels.length - 1]
    const lastRow = rowRefs.current[lastLabel]
    if (lastRow) {
      lastRow.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
  }

  const renderBranchSchedule = (branch: BranchName, registerRows: boolean) => {
    const branchColumns = BRANCH_COLUMNS[branch]
    const columnHasAppointments = getColumnHasAppointments(branch, branchColumns)

    return (
      <BranchAgendaBlock key={branch}>
        <BranchAgendaTitle
          type="button"
          onClick={() => setBranchView(branch)}
          title={`Ver solo ${formatBranchLabel(branch)}`}
        >
          {formatBranchLabel(branch)} {branchView === 'Ambas' ? '↗ Ver solo' : ''}
        </BranchAgendaTitle>
        <ScheduleGrid $compareMode={branchView === 'Ambas'}>
          <ScheduleRowHeader $columnsCount={branchColumns.length} $compact={branchView === 'Ambas'}>
            <TimeHeader>Hora</TimeHeader>
            {branchColumns.map((column) => (
              <ColumnHeader key={`${branch}-${column}`} $hasAny={columnHasAppointments[column]}>
                {column}
              </ColumnHeader>
            ))}
          </ScheduleRowHeader>

          {timeLabels.map((time, rowIndex) => (
            <ScheduleRow
              key={`${branch}-${time}`}
              $columnsCount={branchColumns.length}
              $compact={branchView === 'Ambas'}
              ref={
                registerRows
                  ? (row) => {
                      rowRefs.current[time] = row
                    }
                  : undefined
              }
            >
              <TimeCell>{time}</TimeCell>
              {branchColumns.map((column) => {
                const appointment = getAppointmentCoveringSlot(branch, column, time)
                const colorMark = getCellColorMark(branch, column, time)
                const isStartSlot = appointment?.time === time
                const appointmentSlots = appointment
                  ? getSlotTimes(appointment.time, durationToMinutes(appointment.duration))
                  : []
                const continuationIndex = appointment ? appointmentSlots.indexOf(time) : -1
                const isFirstContinuationSlot = continuationIndex === 1
                const isNew = appointment ? appointment.id === newlyCreatedAppointmentId : false
                const continuesBelow = Boolean(
                  appointment &&
                    appointmentSlots.includes(timeLabels[rowIndex + 1] ?? ''),
                )
                const isLunch = time === '14:00' || time === '14:30'
                const hour = parseInt(time.split(':')[0], 10)
                const isAfterHours = hour >= 19
                return (
                  <ScheduleCell
                    key={`${branch}-${column}-${time}`}
                    role="button"
                    tabIndex={0}
                    $hasAppointment={Boolean(appointment)}
                    $isBlocked={Boolean(appointment) && !isStartSlot}
                    $isNew={isNew}
                    $continuesBelow={continuesBelow}
                    $isLunch={isLunch}
                    $isAfterHours={isAfterHours}
                    $markColor={colorMark?.color}
                    aria-label={
                      appointment
                        ? `Editar cita ${formatBranchLabel(branch)} ${column} ${time}`
                        : `Agregar cita ${formatBranchLabel(branch)} ${column} ${time}`
                    }
                    onClick={() => handleCellClick(branch, column, time)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleCellClick(branch, column, time)
                      }
                    }}
                  >
                    {appointment ? (
                      isStartSlot ? (
                        <CellContent>
                          <CellName>{appointment.patient || 'Paciente'}</CellName>
                          <CellAge>{appointment.age ? `${appointment.age} años` : 'Edad no registrada'}</CellAge>
                          <CellMeta>
                            {appointment.ambulance && <IconBadge title="Ambulancia">🚑</IconBadge>}
                            {appointment.sedation && <IconBadge title="Sedación">💤</IconBadge>}
                            {appointment.oxygen && <IconBadge title="Tanque de oxígeno">🛢️</IconBadge>}
                          </CellMeta>
                          <CellNote>{`Tel: ${appointment.number || 'N/D'}`}</CellNote>
                          <CellStudy>{appointment.study}</CellStudy>
                          <CellObservation>{appointment.observation}</CellObservation>
                          <CellAudit>
                            {formatUserTag(appointment.createdBy)} · {formatDateTimeFromIso(appointment.createdAt)}
                          </CellAudit>
                        </CellContent>
                      ) : isFirstContinuationSlot ? (
                        <ContinuationNote>{appointment.noteTitle}</ContinuationNote>
                      ) : null
                    ) : (
                      <CellTooltip className="cell-tooltip">+</CellTooltip>
                    )}
                    <CellColorToggle
                      type="button"
                      onClick={(event) => handleToggleCellColor(event, branch, column, time)}
                      disabled={!selectedToolColor || !canEditColorMarks}
                      $checked={Boolean(colorMark)}
                      title={
                        !canEditColorMarks
                          ? 'Solo lectura'
                          : selectedToolColor
                          ? colorMark
                            ? 'Quitar color de celda'
                            : `Aplicar ${selectedToolColor.label}`
                          : 'Selecciona un color primero para activar'
                      }
                    >
                      {colorMark ? '✓' : ''}
                    </CellColorToggle>
                    <HoverLabel>{appointment ? 'Editar' : 'Agregar'}</HoverLabel>
                  </ScheduleCell>
                )
              })}
            </ScheduleRow>
          ))}
        </ScheduleGrid>
      </BranchAgendaBlock>
    )
  }

  return (
    <AgendaContainer>
      <AgendaHeader>
          <CalendarCard>
          <CalendarTitle>Calendario 2026</CalendarTitle>
          <CalendarMonth>{calendarMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</CalendarMonth>
          <CalendarMonthNav>
            <DateButton type="button" onClick={() => changeCalendarMonth(-1)} disabled={calendarMonth.getMonth() === 0}>
              ← Ene
            </DateButton>
            <CalendarWeekLabel>Selecciona una fecha</CalendarWeekLabel>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',alignItems:'center'}}>
              <CollapseButton type="button" onClick={() => setCalendarCollapsed((v) => !v)}>
                {calendarCollapsed ? 'Expandir' : 'Minimizar'}
              </CollapseButton>
              <DateButton type="button" onClick={() => changeCalendarMonth(1)} disabled={calendarMonth.getMonth() === 11}>
                Dic →
              </DateButton>
            </div>
          </CalendarMonthNav>
          {!calendarCollapsed && (
          <CalendarDays>
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <CalendarWeekdayLabel key={day}>{day}</CalendarWeekdayLabel>
            ))}
            {calendarGrid.flat().map((day) => {
              const isInMonth = day.getMonth() === calendarMonth.getMonth()
              const isActive = isSameDate(day, activeDate)
              return (
                <CalendarDay
                  key={day.toISOString()}
                  type="button"
                  $active={isActive}
                  $outside={!isInMonth}
                  onClick={() => applyActiveDate(day)}
                >
                  {day.getDate()}
                </CalendarDay>
              )
            })}
          </CalendarDays>
          )}
        </CalendarCard>
        <AgendaActions>
          <AgendaInfo>
            <AgendaTitle>Agenda</AgendaTitle>
            <AgendaSubTitle>
              Sucursal {branchViewLabel} • {currentWeekday}, {currentMonth} {currentDay}
              • Usuario: {currentUserLabel}
              <CurrentTimeBadge>{currentHourLabel}</CurrentTimeBadge>
            </AgendaSubTitle>
            {branchView === 'Ambas' && (
              <CompareHint>Comparando horarios entre sucursales para distribuir mejor la carga.</CompareHint>
            )}
          </AgendaInfo>
          <ActionGroup>
            <BranchSelector role="tablist" aria-label="Selector de sucursal">
              <BranchOption
                type="button"
                role="tab"
                aria-selected={branchView === 'Alamos'}
                $active={branchView === 'Alamos'}
                onClick={() => setBranchView('Alamos')}
              >
                Álamos
              </BranchOption>
              <BranchOption
                type="button"
                role="tab"
                aria-selected={branchView === 'San Felipe'}
                $active={branchView === 'San Felipe'}
                onClick={() => setBranchView('San Felipe')}
              >
                San Felipe
              </BranchOption>
              <BranchOption
                type="button"
                role="tab"
                aria-selected={branchView === 'Ambas'}
                $active={branchView === 'Ambas'}
                onClick={() => setBranchView('Ambas')}
              >
                Ambas
              </BranchOption>
            </BranchSelector>
            <ButtonGroup>
              <FullscreenButton type="button" onClick={toggleFullscreen}>
                {fullscreen ? 'Salir full' : 'Pantalla completa'}
              </FullscreenButton>
              {branchView === 'Alamos' && !hasAppointmentsInPrimaryBranch && (
                <SeedButton type="button" onClick={seedFirstAppointment}>
                  Primer paciente
                </SeedButton>
              )}
            </ButtonGroup>
            <DateNavigation>
              <DateButton type="button" onClick={() => changeDateByDays(-1)}>
                ← Día anterior
              </DateButton>
              <DateButton
                type="button"
                onClick={() => applyActiveDate(new Date())}
                disabled={isActiveDateToday}
              >
                Hoy
              </DateButton>
              <DateButton type="button" onClick={() => changeDateByDays(1)}>
                Día siguiente →
              </DateButton>
            </DateNavigation>
            <ColorNotesPanel>
              <ColorNotesTitle>Notas del día</ColorNotesTitle>
              {dayColorNotes.length === 0 ? (
                <ColorNotesEmpty>No hay celdas coloreadas para este día.</ColorNotesEmpty>
              ) : (
                <ColorNotesList>
                  {dayColorNotesSummary.map((note) => (
                    <ColorNoteItem key={note.key}>
                      <ColorDot style={{ background: note.color }} />
                      <ColorNoteText>
                        {note.text} · {note.cells} celda{note.cells > 1 ? 's' : ''}
                      </ColorNoteText>
                    </ColorNoteItem>
                  ))}
                </ColorNotesList>
              )}
            </ColorNotesPanel>
          </ActionGroup>
        </AgendaActions>
      </AgendaHeader>

      <BranchAgendaStack $compareMode={branchView === 'Ambas'}>
        {visibleBranches.map((branch, index) => renderBranchSchedule(branch, index === 0))}
      </BranchAgendaStack>

      <FloatingTools ref={floatingToolsRef}>
        <ToolbarRow>
          <PaletteToggle
            type="button"
            onClick={() => setIsColorPaletteOpen((value) => !value)}
            title="Seleccionar color"
            $open={isColorPaletteOpen}
          >
            {selectedToolColor && <SelectedColorDot style={{ background: selectedToolColor.value }} />}
          </PaletteToggle>
          <ScrollButtons>
            <FloatingScrollButton type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="Ir al inicio">
              ⇈
            </FloatingScrollButton>
            <FloatingScrollButton type="button" onClick={() => scrollToOccupied('up')} title="Paciente arriba">
              ↑
            </FloatingScrollButton>
            <FloatingScrollButton type="button" onClick={() => scrollToOccupied('down')} title="Paciente abajo">
              ↓
            </FloatingScrollButton>
            <FloatingScrollButton type="button" onClick={scrollToLateHour} title="Ir a 19:00 o al final">
              ⇊
            </FloatingScrollButton>
          </ScrollButtons>
        </ToolbarRow>
        {isColorPaletteOpen && (
          <CompactPanel>
            <ColorPalette>
              {TOOL_COLORS.map((toolColor) => (
                <ColorChip
                  key={toolColor.value}
                  type="button"
                  $active={selectedToolColor?.value === toolColor.value}
                  style={{ background: toolColor.value }}
                  title={toolColor.label}
                  onClick={() => {
                    setSelectedToolColor(toolColor)
                    setIsColorPaletteOpen(false)
                  }}
                />
              ))}
            </ColorPalette>
            <ToolNoteInput
              value={toolNote}
              onChange={(event) => setToolNote(event.target.value)}
              placeholder="Nota"
            />
          </CompactPanel>
        )}
      </FloatingTools>

      
      {selectedCell && (
        <ModalOverlay>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>{selectedCell.appointment ? 'Editar cita' : 'Agregar cita'}</ModalTitle>
              <CloseButton type="button" onClick={handleCancel} aria-label="Cerrar formulario">
                ×
              </CloseButton>
            </ModalHeader>
            <ModalBody>
              <AppointmentForm
                technique={selectedCell.technique}
                time={selectedCell.time}
                initialData={selectedCell.appointment}
                onSave={handleSaveAppointment}
                onCancel={handleCancel}
                onDelete={selectedCell.appointment ? handleDeleteAppointment : undefined}
              />
            </ModalBody>
          </ModalContent>
        </ModalOverlay>
      )}
    </AgendaContainer>
  )
}

const AgendaContainer = styled.section`
  display: grid;
  gap: 12px;
`

const AgendaHeader = styled.div`
  display: grid;
  grid-template-columns: minmax(320px, 420px) 1fr;
  gap: 14px;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`

const CalendarCard = styled.div`
  min-width: 300px;
  width: 100%;
  justify-self: center;
  padding: 18px;
  border-radius: 20px;
  background: #a3e1fa;
  border: 1px solid #e5e7eb;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
  display: grid;
  gap: 12px;

  @media (max-width: 900px) {
    min-width: 100%;
    padding: 14px;
  }
`

const CalendarTitle = styled.span`
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
`

const CalendarMonth = styled.h2`
  margin: 0;
  font-size: 28px;
  color: #111827;
` 

const CalendarMonthNav = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
`

const CalendarWeekLabel = styled.div`
  text-align: center;
  color: #475569;
  font-size: 14px;
  font-weight: 600;
`

const CollapseButton = styled.button`
  border: none;
  border-radius: 12px;
  padding: 8px 12px;
  background: #eef2ff;
  color: #1e3a8a;
  font-weight: 700;
  cursor: pointer;
  margin-right: 6px;

  &:hover {
    background: #dbeafe;
  }
`

const CalendarWeekdayLabel = styled.p`
  margin: 0;
  color: #64748b;
  text-transform: capitalize;
`

const CalendarDays = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
`

const CalendarDay = styled.button<{ $active?: boolean; $outside?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border-radius: 14px;
  background: ${({ $active }) => ($active ? '#4338ca' : '#f8fafc')};
  color: ${({ $active, $outside }) => ($active ? '#ffffff' : $outside ? '#94a3b8' : '#0f172a')};
  font-weight: ${({ $active }) => ($active ? 700 : 600)};
  width: 100%;
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;

  &:hover {
    background: ${({ $active }) => ($active ? '#3730a3' : '#e0e7ff')};
    transform: translateY(-1px);
  }
`
const AgendaActions = styled.div`
  display: grid;
  gap: 18px;
  flex: 1;
  min-width: 260px;
`

const AgendaInfo = styled.div`
  display: grid;
  gap: 8px;
`

const BranchSelector = styled.div`
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
`

const BranchOption = styled.button<{ $active: boolean }>`
  border: 1px solid ${({ $active }) => ($active ? '#4338ca' : '#cbd5e1')};
  background: ${({ $active }) => ($active ? '#eef2ff' : '#ffffff')};
  color: ${({ $active }) => ($active ? '#312e81' : '#334155')};
  border-radius: 999px;
  padding: 8px 14px;
  font-weight: 700;
  cursor: pointer;
`

const AgendaSubTitle = styled.p`
  margin: 0;
  color: #1f2937;
  font-size: 19px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`

const CurrentTimeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1e3a8a;
  font-size: 14px;
  font-weight: 800;
`

const CompareHint = styled.p`
  margin: 0;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
`

const ActionGroup = styled.div`
  display: grid;
  gap: 10px;
`

const ButtonGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-start;
`

const DateNavigation = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  margin-top: 0;
` 

const DateButton = styled.button`
  border: none;
  border-radius: 16px;
  padding: 10px 16px;
  background: #eef2ff;
  color: #1e3a8a;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover:not(:disabled) {
    background: #dbeafe;
  }

  &:disabled {
    background: #e2e8f0;
    color: #94a3b8;
    cursor: default;
  }
`

const AgendaTitle = styled.h1`
  margin: 0;
  font-size: 32px;
  letter-spacing: -0.8px;
`

const FullscreenButton = styled.button`
  border: none;
  border-radius: 16px;
  padding: 12px 20px;
  background: #4f46e5;
  color: white;
  font-weight: 600;
  box-shadow: 0 14px 28px rgba(79, 70, 229, 0.18);

  &:hover {
    background: #4338ca;
  }
`



const SeedButton = styled.button`
  border: none;
  border-radius: 16px;
  padding: 12px 20px;
  background: #10b981;
  color: white;
  font-weight: 600;
  transition: background 0.2s ease;

  &:hover {
    background: #059669;
  }
`

// Study screen moved to a dedicated StudiesScreen component

const ScheduleGrid = styled.div<{ $compareMode: boolean }>`
  display: grid;
  width: 100%;
  overflow-x: ${({ $compareMode }) => ($compareMode ? 'hidden' : 'auto')};
  overflow-y: visible;
  border-radius: 24px;
  border: 1px solid #000;
  background: #c2e2f8;
`

const BranchAgendaStack = styled.div<{ $compareMode: boolean }>`
  display: grid;
  gap: 18px;

  ${({ $compareMode }) =>
    $compareMode &&
    `
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  `}

  @media (max-width: 1180px) {
    grid-template-columns: 1fr;
  }
`

const BranchAgendaBlock = styled.section`
  display: grid;
  gap: 10px;
`

const BranchAgendaTitle = styled.button`
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  justify-self: start;
  color: #0f172a;
`

const ScheduleRowHeader = styled.div<{ $columnsCount: number; $compact: boolean }>`
  display: grid;
  grid-template-columns: ${({ $columnsCount, $compact }) =>
    $compact
      ? `82px repeat(${$columnsCount}, minmax(0, 1fr))`
      : `100px repeat(${$columnsCount}, minmax(120px, 1fr))`};
  background: #a0e2f7;
  padding: 0;
  gap: 0;
  border-bottom: 1px solid #000;
  position: sticky;
  top: 0;
  z-index: 30;

  @media (max-width: 900px) {
    grid-template-columns: ${({ $columnsCount }) => `80px repeat(${$columnsCount}, minmax(100px, 1fr))`};
  }
  @media (max-width: 520px) {
    grid-template-columns: ${({ $columnsCount }) => `64px repeat(${$columnsCount}, minmax(80px, 1fr))`};
  }
`

const ScheduleRow = styled.div<{ $columnsCount: number; $compact: boolean }>`
  display: grid;
  grid-template-columns: ${({ $columnsCount, $compact }) =>
    $compact
      ? `82px repeat(${$columnsCount}, minmax(0, 1fr))`
      : `100px repeat(${$columnsCount}, minmax(120px, 1fr))`};
  gap: 0;
  align-items: stretch;

  @media (max-width: 900px) {
    grid-template-columns: ${({ $columnsCount }) => `80px repeat(${$columnsCount}, minmax(100px, 1fr))`};
  }
  @media (max-width: 520px) {
    grid-template-columns: ${({ $columnsCount }) => `64px repeat(${$columnsCount}, minmax(80px, 1fr))`};
  }
`

const TimeHeader = styled.div`
  padding: 16px 12px;
  font-size: 14px;
  font-weight: 800;
  color: #111827;
  background: #b8c2cc;
  border-top: 1px solid #000;
  border-right: 1px solid #000;
  border-bottom: 1px solid #000;
  position: sticky;
  left: 0;
  z-index: 31;

  @media (max-width: 520px) {
    padding: 10px 8px;
    font-size: 12px;
  }
`

const ColumnHeader = styled.div<{ $hasAny?: boolean }>`
  padding: 16px 12px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #0f172a;
  background: ${({ $hasAny }) => ($hasAny ? '#c7d2fe' : '#e2e8f0')};
  border-top: 0;
  border-left: 1px solid #000;
  border-bottom: 1px solid #000;

  @media (max-width: 520px) {
    padding: 10px 8px;
    font-size: 12px;
  }
`

const TimeCell = styled.div`
  padding: 16px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  background: #cbd5e1;
  border-top: 1px solid #000;
  border-left: 1px solid #000;
  border-bottom: 1px solid #000;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: sticky;
  left: 0;
  z-index: 20;

  @media (max-width: 520px) {
    padding: 10px 8px;
    font-size: 12px;
  }
`

const CellTooltip = styled.span`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #4f46e5;
  font-size: 18px;
  font-weight: 700;
  opacity: 0;
  transition: opacity 0.2s ease;
  @media (max-width: 520px) {
    font-size: 16px;
  }
`

const ScheduleCell = styled.div<{ $hasAppointment: boolean; $isBlocked: boolean; $isNew?: boolean; $continuesBelow?: boolean; $isLunch?: boolean; $isAfterHours?: boolean; $markColor?: string }>`
  min-height: 92px;
  padding: 12px;
  border-left: 1px solid #000;
  border-right: 1px solid #000;
  border-top: ${({ $isBlocked }) => ($isBlocked ? 'none' : '1px solid #000')};
  border-bottom: ${({ $continuesBelow }) => ($continuesBelow ? 'none' : '1px solid #000')};
  background: ${({ $markColor, $hasAppointment, $isNew, $isBlocked, $isLunch, $isAfterHours }) =>
    $markColor
      ? $markColor
      :
    $hasAppointment
      ? $isNew
        ? '#bbf7d0'
        : $isBlocked
        ? '#c5d5fb'
        : '#dbeafe'
      : $isLunch
      ? '#656e7a'
      : $isAfterHours
      ? '#8589a1'
      : '#dbd4d4'};
  position: relative;
  cursor: pointer;
  overflow: hidden;
  text-align: left;
  border-radius: ${({ $hasAppointment, $isBlocked, $continuesBelow }) => {
    if (!$hasAppointment) return '0';
    if ($isBlocked) return $continuesBelow ? '0' : '0 0 14px 14px';
    return $continuesBelow ? '14px 14px 0 0' : '14px';
  }};

  display: grid;
  align-items: ${({ $hasAppointment }) => ($hasAppointment ? 'center' : 'stretch')};
  justify-items: center;
  padding: ${({ $hasAppointment }) => ($hasAppointment ? '18px 12px' : '12px')};

  &:hover {
    background: ${({ $markColor, $hasAppointment, $isNew }) =>
      $markColor
        ? $markColor
        :
      $hasAppointment
        ? $isNew
          ? '#9df5b8'
          : '#c7ddff'
        : '#eef2ff'};
  }

  &:hover .cell-tooltip {
    opacity: 1;
  }

  &:focus-visible {
    outline: 2px solid #a5b4fc;
    outline-offset: -2px;
  }

  @media (max-width: 900px) {
    min-height: 84px;
    padding: 8px;
  }
`

const CellContent = styled.div`
  display: grid;
  gap: 6px;
  justify-items: center;
  align-items: center;
  text-align: center;
`

const CellMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: center;
`

const IconBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  min-height: 42px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.16);
  color: #4338ca;
  font-size: 20px;
  padding: 6px;
  font-weight: 700;
`

const CellName = styled.span`
  display: block;
  font-weight: 700;
  color: #111827;
  font-size: 14px;
`

const CellAge = styled.span`
  display: block;
  font-size: 12px;
  color: #334155;
  font-weight: 600;
`

const CellNote = styled.span`
  display: block;
  font-size: 12px;
  color: #475569;
  font-weight: 700;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  word-break: break-word;
  max-width: 100%;
`

const CellStudy = styled.span`
  display: block;
  font-size: 12px;
  color: #2563eb;
  font-weight: 600;
`

const CellObservation = styled.span`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  line-height: 1.25;
  color: #334155;
  max-width: 100%;
`

const CellAudit = styled.span`
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: #0f172a;
  font-weight: 700;
  opacity: 0.85;
`

const ContinuationNote = styled.span`
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: #334155;
  text-align: center;
  padding: 6px 8px;
`

const HoverLabel = styled.span`
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(79, 70, 229, 0.12);
  color: #4338ca;
  font-size: 11px;
  font-weight: 700;
  opacity: 0;
  transition: opacity 0.2s ease;

  ${ScheduleCell}:hover & {
    opacity: 1;
  }
`

const CellColorToggle = styled.button<{ $checked: boolean }>`
  position: absolute;
  left: 8px;
  bottom: 8px;
  width: 20px;
  height: 20px;
  border: 1px solid #0f172a;
  border-radius: 6px;
  padding: 0;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  background: ${({ $checked }) => ($checked ? '#0f172a' : '#ffffff')};
  color: ${({ $checked }) => ($checked ? '#f8fafc' : 'transparent')};
  opacity: 0;
  line-height: 1;
  transition: opacity 0.18s ease, transform 0.18s ease;
  transform: translateY(2px);
  pointer-events: none;

  ${ScheduleCell}:hover &,
  ${ScheduleCell}:focus-within & {
    opacity: 0.88;
    transform: translateY(0);
    pointer-events: auto;
  }

  &:disabled {
    opacity: 0;
    cursor: default;
  }
`

const ColorNotesPanel = styled.div`
  margin-top: 2px;
  padding: 12px;
  border-radius: 14px;
  background: #e2e8f0;
  border: 1px solid #cbd5e1;
  display: grid;
  gap: 8px;
`

const ColorNotesTitle = styled.p`
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
`

const ColorNotesEmpty = styled.p`
  margin: 0;
  font-size: 12px;
  color: #475569;
`

const ColorNotesList = styled.div`
  display: grid;
  gap: 6px;
`

const ColorNoteItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const ColorDot = styled.span`
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.28);
`

const ColorNoteText = styled.span`
  font-size: 12px;
  color: #1f2937;
  font-weight: 600;
`

const FloatingTools = styled.aside`
  position: fixed;
  right: 22px;
  bottom: 18px;
  z-index: 45;
  width: fit-content;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.92);
  color: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 10px 22px rgba(2, 6, 23, 0.34);
  padding: 6px;
  display: grid;
  gap: 6px;
`

const ToolbarRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const PaletteToggle = styled.button<{ $open: boolean }>`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid ${({ $open }) => ($open ? '#e2e8f0' : 'rgba(148, 163, 184, 0.55)')};
  background: transparent;
  display: grid;
  place-items: center;
  padding: 0;
`

const SelectedColorDot = styled.span`
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.38);
`

const CompactPanel = styled.div`
  display: grid;
  gap: 6px;
  padding: 6px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.58);
`

const ColorPalette = styled.div`
  display: flex;
  gap: 6px;
`

const ColorChip = styled.button<{ $active: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: ${({ $active }) => ($active ? '2px solid #f8fafc' : '1px solid rgba(15, 23, 42, 0.4)')};
  box-shadow: ${({ $active }) => ($active ? '0 0 0 2px rgba(148, 163, 184, 0.55)' : 'none')};
`

const ToolNoteInput = styled.input`
  min-height: 24px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.9);
  color: #e2e8f0;
  padding: 0 6px;
  font-size: 11px;
  width: 120px;

  &::placeholder {
    color: #94a3b8;
  }
`

const ScrollButtons = styled.div`
  display: flex;
  gap: 6px;
`

const FloatingScrollButton = styled.button`
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  width: 28px;
  height: 28px;
  padding: 0;
  display: grid;
  place-items: center;
  background: #dbeafe;
  color: #1e3a8a;
  font-size: 16px;
  font-weight: 800;
`

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.48);
  display: grid;
  align-items: center;
  justify-items: center;
  padding: 16px;
  overflow: hidden;
  z-index: 50;
`

const ModalContent = styled.div`
  width: min(720px, 100%);
  max-height: calc(100vh - 32px);
  overflow: hidden;
  background: #b0c6dd;
  border-radius: 22px;
  box-shadow: 0 32px 72px rgba(15, 23, 42, 0.28);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
`



const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 18px 12px;
  background: #b0c6dd;
  border-radius: 22px 22px 0 0;
`

const ModalBody = styled.div`
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 18px 18px;
`

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 24px;
  color: #111827;
`

const CloseButton = styled.button`
  border: none;
  background: transparent;
  color: #475569;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
`

