import { useState, type FormEvent } from 'react'
import styled from 'styled-components'

export type AppointmentFormValues = {
  technique: 'RM' | 'TC' | 'Rayos X' | 'Ultrasonido'
  study: string
  duration: string
  patient: string
  age: string
  number: string
  doctor: string
  ambulance: boolean
  sedation: boolean
  oxygen: boolean
  noteTitle: string
  observation: string
}

export type AppointmentData = AppointmentFormValues & {
  id: number
  time: string
  date: string
  branch?: 'Alamos' | 'San Felipe'
  firestoreId?: string
  startTimeMinutes?: number
  endTimeMinutes?: number
}

interface AppointmentFormProps {
  technique: AppointmentData['technique']
  time: string
  initialData?: AppointmentFormValues
  onSave: (appointment: AppointmentFormValues) => void
  onCancel: () => void
  onDelete?: () => void
}

const withSimpleContrast = (studies: string[]) =>
  studies.flatMap((name) => [`${name} SIMPLE`, `${name} CONTRASTADO`])

const unique = (values: string[]) => Array.from(new Set(values))

const rmBaseStudies = [
  'ABDOMEN COMPLETO',
  'ABDOMEN SUPERIOR',
  'ABDOMEN INFERIOR',
  'ANTEBRAZO',
  'ARTICULACIONES SACROILIACAS',
  'BRAZO',
  'CADERA',
  'COLUMNA CERVICAL',
  'COLUMNA DORSAL O TORACICA',
  'COLUMNA LUMBAR',
  'CRANEO',
  'CODO',
  'CUELLO',
  'FEMUR',
  'HOMBRO',
  'LENGUA',
  'MACIZO FACIAL',
  'MAMA',
  'MANO',
  'MUSLO/GLUTEO',
  'MUÑECA',
  'NARIZ',
  'NEURO EJE (VERTEBRAL)',
  'ORBITAS',
  'PIERNA',
  'PIE',
  'PLEXO BRAQUIAL',
  'PULMON',
  'REGIÓN FLEURA',
  'REGIÓN SELAR-SILLA TURCA',
  'RODILLA',
  'SACRO Y COXIGEA',
  'SNC',
  'TIBIA',
  'TOBILLO',
  'TORAX',
]

const rmAngioStudies = [
  'ANGIORESONANCIA DE ABDOMEN COMPLETO',
  'ANGIORESONANCIA DE ARTERIAS Y VENAS DE CRANEO',
  'ANGIORESONANCIA DE ARTERIAS',
  'ANGIORESONANCIA DE VENAS',
  'ANGIORESONANCIA DE MIEMBROS PELVICOS',
  'ANGIORESONANCIA DE AORTA TORACICA',
  'ANGIORESONANCIA DE CUELLO',
  'ANGIORESONANCIA DE TRONCOS SUPRA AORTICOS',
  'ANGIORESONANCIA RENAL',
  'URORESONANCIA',
  'COLANGIORESONANCIA',
]

const rmTechniques = [
  'EFECTO MIELOGRAFICO',
  'ESPECTROSCOPIA O PROTOCOLO DE LOBULOS TEMPORALES',
  'DIFUSION ADC',
  'TECNICA FIESTA',
  'TECNICA FLAIR O ECOGRADIENTE',
  'TECNICA STIR',
  'TECNICA BALANCE',
  'PROTOCOLO DE PERFUSION O ESTERONQUE',
  'PROTOCOLO DE HIPOCAMPOS O PROTOCOLO DE EPILEPSIA',
  'PROTOCOLO PARA ISQUEMIA CEREBRAL',
  'SECUENCIA ESTRONQUE SIMPLE Y CONTRASTADO',
  'VOLUMEN CEREBRAL RELATIVO',
  'PROTOCOLO DE STROKE GUIA A DIFUSION',
]

const tcBaseStudies = [
  'ABDOMEN COMPLETO',
  'ABDOMEN SUPERIOR',
  'ABDOMEN INFERIOR',
  'ANTEBRAZO',
  'CADERA',
  'CODO',
  'CRANEO',
  'COLUMNA CERVICAL',
  'COLUMNA DORSAL O TORACICA',
  'COLUMNA LUMBAR',
  'CUELLO',
  'FEMUR',
  'HOMBRO',
  'MANO',
  'MUÑECA',
  'OMOPLATO',
  'PELVIS',
  'PIERNA',
  'RINONES',
  'SENOS PARANASALES',
  'SILLA TURCA AXIAL Y CORONAL',
  'RODILLA',
  'TOBILLO',
  'TORAX',
]

const tcAngioStudies = [
  'ANGIOTAC DE AORTA ABDOMINAL',
  'ANGIOTAC DE AORTA TORACICA',
  'ANGIOTAC CAROTIDEAS',
  'ANGIOTAC CEREBRAL',
  'ANGIOTAC DE MI',
  'ANGIOTAC DE MPS PIERNAS',
  'ANGIOTAC CIRCULACION CEREBRAL',
  'ANGIOTAC MPI',
  'UROTOMOGRAFIA',
  'SINGLE DE CORONARIAS',
]

const tcSpecialStudies = [
  'SCORE DE CALCIO',
  'PANCREAS DINAMICO',
  'TAC DE CRANEO SIMPLE Y RECONSTRUCCION',
  'TAC DE OIDOS SIMPLE',
  'TAC DE OIDOS SIMPLE 2 CORTES VENTANA OSEA',
]

const studyOptions: Record<AppointmentData['technique'], string[]> = {
  RM: unique([...withSimpleContrast([...rmBaseStudies, ...rmAngioStudies]), ...rmTechniques]),
  TC: unique([...withSimpleContrast([...tcBaseStudies, ...tcAngioStudies]), ...tcSpecialStudies]),
  'Rayos X': ['RXUSG SIMPLE', 'RXUSG CONTRASTADO'],
  Ultrasonido: ['RXUSG SIMPLE', 'RXUSG CONTRASTADO'],
}

export default function AppointmentForm({ technique, time, initialData, onSave, onCancel, onDelete }: AppointmentFormProps) {
  const [study, setStudy] = useState(initialData?.study ?? studyOptions[technique][0])
  const [duration, setDuration] = useState(initialData?.duration ?? '1 hr')
  const [patient, setPatient] = useState(initialData?.patient ?? '')
  const [age, setAge] = useState(initialData?.age ?? '')
  const [number, setNumber] = useState(initialData?.number ?? '')
  const [doctor, setDoctor] = useState(initialData?.doctor ?? '')
  const [ambulance, setAmbulance] = useState(initialData?.ambulance ?? false)
  const [sedation, setSedation] = useState(initialData?.sedation ?? false)
  const [oxygen, setOxygen] = useState(initialData?.oxygen ?? false)
  const [noteTitle, setNoteTitle] = useState(initialData?.noteTitle ?? 'Notas')
  const [observation, setObservation] = useState(initialData?.observation ?? '')
  const [errors, setErrors] = useState<string[]>([])

  const activeStudyOptions = studyOptions[technique]
  const studyQuery = study.trim().toLowerCase()
  const quickSuggestions = activeStudyOptions
    .filter((option) => !studyQuery || option.toLowerCase().includes(studyQuery))
    .slice(0, 14)

  const validateForm = () => {
    const validationErrors: string[] = []

    const effectiveStudy = study.trim()
    if (!effectiveStudy) validationErrors.push('El estudio es obligatorio.')
    if (!duration.trim()) validationErrors.push('La duración es obligatoria.')
    if (!patient.trim()) validationErrors.push('El nombre del paciente es obligatorio.')
    if (!age.trim()) validationErrors.push('La edad es obligatoria.')
    if (!number.trim()) validationErrors.push('El número de ficha es obligatorio.')
    if (!doctor.trim()) validationErrors.push('El doctor es obligatorio.')
    if (!noteTitle.trim()) validationErrors.push('El título de la nota es obligatorio.')
    if (!observation.trim()) validationErrors.push('La observación es obligatoria.')

    return validationErrors
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validateForm()
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors([])
    onSave({
      technique,
      study: study.trim(),
      duration,
      patient,
      age,
      number,
      doctor,
      ambulance,
      sedation,
      oxygen,
      noteTitle,
      observation,
    })
  }

  return (
    <FormShell>
      <FormHeader>
        <FormTitle>{technique} - {time}</FormTitle>
        <FormSubTitle>Agregar paciente a la agenda</FormSubTitle>
        {errors.length > 0 && (
          <ErrorMessage>
            <strong>Revisa los campos obligatorios:</strong>
            <ErrorList>
              {errors.map((error) => (
                <ErrorItem key={error}>{error}</ErrorItem>
              ))}
            </ErrorList>
          </ErrorMessage>
        )}
      </FormHeader>
      <FormGrid onSubmit={handleSubmit}>
        <FormGroup>
          <FormLabel htmlFor="study">Estudio</FormLabel>
          <FormInput
            id="study"
            list="study-options"
            value={study}
            onChange={(event) => setStudy(event.target.value)}
            placeholder="Buscar o escribir estudio"
            required
          />
          <FieldHint>Busca en el catalogo o escribe libremente si no aparece.</FieldHint>
          <datalist id="study-options">
            {activeStudyOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          {quickSuggestions.length > 0 && (
            <SuggestionsWrap>
              {quickSuggestions.map((option) => (
                <SuggestionChip key={option} type="button" onClick={() => setStudy(option)}>
                  {option}
                </SuggestionChip>
              ))}
            </SuggestionsWrap>
          )}
        </FormGroup>

        <FormGroup>
          <FormLabel htmlFor="duration">Duración</FormLabel>
          <FormSelect id="duration" value={duration} onChange={(event) => setDuration(event.target.value)} required>
            <option>30 min</option>
            <option>1 hr</option>
            <option>1.5 hr</option>
            <option>2 hr</option>
          </FormSelect>
        </FormGroup>

        <FormGroup>
          <FormLabel htmlFor="patient">Paciente</FormLabel>
          <FormInput
            id="patient"
            value={patient}
            onChange={(event) => setPatient(event.target.value)}
            placeholder="Nombre"
            required
          />
        </FormGroup>

        <FormGroup>
          <FormLabel htmlFor="age">Edad</FormLabel>
          <FormInput
            id="age"
            value={age}
            onChange={(event) => setAge(event.target.value)}
            placeholder="01"
            required
          />
        </FormGroup>

        <FormGroup>
          <FormLabel htmlFor="number">Número</FormLabel>
          <FormInput
            id="number"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="Nro. de ficha"
            required
          />
        </FormGroup>

        <FormGroup>
          <FormLabel htmlFor="doctor">Doctor</FormLabel>
          <FormInput
            id="doctor"
            value={doctor}
            onChange={(event) => setDoctor(event.target.value)}
            placeholder="Nombre del doctor"
            required
          />
        </FormGroup>

        <FormGroupFull>
          <FormLabel>Íconos</FormLabel>
          <IconOptions>
            <IconButton type="button" $active={ambulance} onClick={() => setAmbulance((value) => !value)}>
              🚑 Ambulancia
            </IconButton>
            <IconButton type="button" $active={sedation} onClick={() => setSedation((value) => !value)}>
              💤 Sedación
            </IconButton>
            <IconButton type="button" $active={oxygen} onClick={() => setOxygen((value) => !value)}>
              🛢️ Tanque O2
            </IconButton>
          </IconOptions>
        </FormGroupFull>

        <FormGroupFull>
          <FormLabel htmlFor="noteTitle">Notas H1</FormLabel>
          <FormInput
            id="noteTitle"
            value={noteTitle}
            onChange={(event) => setNoteTitle(event.target.value)}
            placeholder="Título de la nota"
            required
          />
        </FormGroupFull>

        <FormGroupFull>
          <FormLabel htmlFor="observation">Observación médica</FormLabel>
          <FormTextArea
            id="observation"
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            rows={4}
            placeholder="Observaciones del estudio"
            required
          />
        </FormGroupFull>

        <FormActions>
          {onDelete && (
            <DeleteButton type="button" onClick={onDelete}>
              Cancelar cita
            </DeleteButton>
          )}
          <CancelButton type="button" onClick={onCancel}>Cerrar</CancelButton>
          <SubmitButton type="submit">Guardar paciente</SubmitButton>
        </FormActions>
      </FormGrid>
    </FormShell>
  )
}

const FormShell = styled.section`
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
  display: grid;
  gap: 20px;
`

const FormHeader = styled.div`
  display: grid;
  gap: 6px;
`

const FormTitle = styled.h2`
  margin: 0;
  font-size: 24px;
  color: #111827;
`

const FormSubTitle = styled.p`
  margin: 0;
  color: #475569;
`

const FormGrid = styled.form`
  display: grid;
  gap: 18px;
`

const FormGroup = styled.label`
  display: grid;
  gap: 8px;
  font-size: 14px;
  color: #374151;
`

const FormGroupFull = styled.div`
  display: grid;
  gap: 8px;
`

const FormLabel = styled.label`
  font-weight: 600;
  color: #111827;
`

const FormInput = styled.input`
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid #d1d5db;
  border-radius: 14px;
  background: #f8fafc;
`

const FormSelect = styled.select`
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid #d1d5db;
  border-radius: 14px;
  background: #f8fafc;
`

const FieldHint = styled.span`
  color: #64748b;
  font-size: 12px;
`

const SuggestionsWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
`

const SuggestionChip = styled.button`
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #f8fafc;
  color: #1f2937;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.2;

  &:hover {
    background: #e2e8f0;
  }
`

const FormTextArea = styled.textarea`
  width: 100%;
  min-height: 90px;
  padding: 14px;
  border: 1px solid #d1d5db;
  border-radius: 14px;
  background: #f8fafc;
  resize: vertical;
`

const ErrorMessage = styled.div`
  padding: 14px;
  border-radius: 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  display: grid;
  gap: 10px;
`

const ErrorList = styled.ul`
  margin: 0;
  padding-left: 18px;
  color: #991b1b;
`

const ErrorItem = styled.li`
  margin-bottom: 4px;
`

const IconOptions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`

const IconButton = styled.button<{ $active: boolean }>`
  flex: 1;
  min-width: 120px;
  padding: 16px 18px;
  border: 1px solid ${({ $active }) => ($active ? '#4338ca' : '#d1d5db')};
  border-radius: 18px;
  background: ${({ $active }) => ($active ? '#eef2ff' : '#f8fafc')};
  color: #111827;
  font-weight: 600;
  font-size: 18px;
  line-height: 1.2;

  &:hover {
    background: #e0e7ff;
  }

  @media (max-width: 520px) {
    min-width: 90px;
    padding: 12px 14px;
    font-size: 14px;
  }
`

const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
`

const CancelButton = styled.button`
  border: 1px solid #d1d5db;
  border-radius: 14px;
  background: #ffffff;
  color: #475569;
  padding: 12px 18px;
`

const DeleteButton = styled.button`
  border: 1px solid #f87171;
  border-radius: 14px;
  background: #fee2e2;
  color: #b91c1c;
  padding: 12px 18px;
`

const SubmitButton = styled.button`
  border: none;
  border-radius: 14px;
  background: #4f46e5;
  color: #ffffff;
  padding: 12px 18px;
`
