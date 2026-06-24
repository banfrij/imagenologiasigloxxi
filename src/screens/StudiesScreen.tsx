import { useEffect, useState } from 'react'
import styled from 'styled-components'

type Study = {
  id: number
  code?: string
  name: string
  modality: 'RM' | 'TC' | 'Rayos X' | 'Ultrasonido' | string
  priceSimple: number
  priceContrast: number
  priceSimpleUrgency: number
  priceContractedUrgency: number
  specs?: string
}

const STORAGE_KEY = 'ImgXXI_Studies'

export default function StudiesScreen() {
  const [studies, setStudies] = useState<Study[]>([])
  const [nextId, setNextId] = useState(1)
  const [form, setForm] = useState<Partial<Study>>({ modality: 'RM', priceSimple: 0, priceContrast: 0, priceSimpleUrgency: 0, priceContractedUrgency: 0 })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Study[]
        setStudies(parsed)
        setNextId(parsed.reduce((m, s) => Math.max(m, s.id), 0) + 1)
      } catch {
        // ignore
      }
    }
  }, [])

  const save = () => {
    if (!form.name) return
    const newStudy: Study = {
      id: nextId,
      code: form.code,
      name: form.name,
      modality: (form.modality as Study['modality']) || 'RM',
      priceSimple: Number(form.priceSimple) || 0,
      priceContrast: Number(form.priceContrast) || 0,
      priceSimpleUrgency: Number(form.priceSimpleUrgency) || 0,
      priceContractedUrgency: Number(form.priceContractedUrgency) || 0,
      specs: form.specs || '',
    }
    const next = [...studies, newStudy]
    setStudies(next)
    setNextId((n) => n + 1)
    setForm({ modality: 'RM', priceSimple: 0, priceContrast: 0, priceSimpleUrgency: 0, priceContractedUrgency: 0 })
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const remove = (id: number) => {
    const next = studies.filter((s) => s.id !== id)
    setStudies(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return (
    <Container>
      <Header>
        <Title>Gestión de estudios</Title>
        <Subtitle>Crea y administra los estudios, precios y especificaciones.</Subtitle>
      </Header>

      <FormGrid>
        <Field>
          <Label>Código</Label>
          <Input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </Field>
        <Field>
          <Label>Nombre</Label>
          <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field>
          <Label>Modalidad</Label>
          <Select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })}>
            <option>RM</option>
            <option>TC</option>
            <option>Rayos X</option>
            <option>Ultrasonido</option>
          </Select>
        </Field>
        <PriceGroup>
          <PriceField>
            <Label>Simple</Label>
            <Input type="number" value={String(form.priceSimple ?? '')} onChange={(e) => setForm({ ...form, priceSimple: Number(e.target.value) })} />
          </PriceField>
          <PriceField>
            <Label>Contrastada</Label>
            <Input type="number" value={String(form.priceContrast ?? '')} onChange={(e) => setForm({ ...form, priceContrast: Number(e.target.value) })} />
          </PriceField>
          <PriceField>
            <Label>Simple C / Urgencia</Label>
            <Input type="number" value={String(form.priceSimpleUrgency ?? '')} onChange={(e) => setForm({ ...form, priceSimpleUrgency: Number(e.target.value) })} />
          </PriceField>
          <PriceField>
            <Label>Contratado C / Urgencia</Label>
            <Input type="number" value={String(form.priceContractedUrgency ?? '')} onChange={(e) => setForm({ ...form, priceContractedUrgency: Number(e.target.value) })} />
          </PriceField>
        </PriceGroup>
        <FieldFull>
          <Label>Especificaciones</Label>
          <Textarea value={form.specs || ''} onChange={(e) => setForm({ ...form, specs: e.target.value })} />
        </FieldFull>
        <Actions>
          <SaveButton type="button" onClick={save}>Guardar estudio</SaveButton>
        </Actions>
      </FormGrid>

      <List>
        {studies.map((s) => (
        <ListItem key={s.id}>
          <ListInfo>
            <strong>{s.name}</strong>
            <div>{s.modality} • {s.code ?? '—'}</div>
            <div style={{color:'#475569'}}>{s.specs}</div>
          </ListInfo>
          <ListMeta>
            <PriceList>
              <PriceRow><span>Simple</span><span>${s.priceSimple.toFixed(2)}</span></PriceRow>
              <PriceRow><span>Contrastada</span><span>${s.priceContrast.toFixed(2)}</span></PriceRow>
              <PriceRow><span>Simple C/Urg.</span><span>${s.priceSimpleUrgency.toFixed(2)}</span></PriceRow>
              <PriceRow><span>Contratado C/Urg.</span><span>${s.priceContractedUrgency.toFixed(2)}</span></PriceRow>
            </PriceList>
            <DeleteButton type="button" onClick={() => remove(s.id)}>Eliminar</DeleteButton>
          </ListMeta>
        </ListItem>
        ))}
      </List>
    </Container>
  )
}

const Container = styled.section`
  display: grid;
  gap: 20px;
`

const Header = styled.div`
  display: grid;
  gap: 6px;
`

const Title = styled.h1`
  margin: 0;
  font-size: 28px;
`

const Subtitle = styled.p`
  margin: 0;
  color: #64748b;
`

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 12px;
  align-items: start;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const Field = styled.label`
  display: grid;
  gap: 8px;
`

const FieldFull = styled(Field)`
  grid-column: 1 / -1;
`

const Label = styled.span`
  font-weight: 700;
  color: #111827;
`

const Input = styled.input`
  min-height: 44px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
`

const Select = styled.select`
  min-height: 44px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
`

const Textarea = styled.textarea`
  min-height: 88px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
`

const Actions = styled.div`
  grid-column: 1 / -1;
  display:flex;
  justify-content: flex-end;
`

const SaveButton = styled.button`
  border:none;
  background: #2563eb;
  color: white;
  padding: 10px 16px;
  border-radius: 12px;
  font-weight:700;
`

const List = styled.ul`
  list-style:none;
  margin:0;
  padding:0;
  display:grid;
  gap:10px;
`

const ListItem = styled.li`
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:12px 14px;
  background:#fff;
  border-radius:12px;
  border:1px solid #e5e7eb;
`

const ListInfo = styled.div`
  display:grid;
  gap:6px;
`

const ListMeta = styled.div`
  display:grid;
  gap:8px;
  align-items:center;
  justify-items:end;
`

const DeleteButton = styled.button`
  border:none;
  background:transparent;
  color:#b91c1c;
  font-weight:700;
  cursor:pointer;
`

const PriceGroup = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 10px;
`

const PriceField = styled.label`
  display: grid;
  gap: 6px;
`

const PriceList = styled.div`
  display: grid;
  gap: 6px;
  min-width: 160px;
`

const PriceRow = styled.div`
  display:flex;
  justify-content:space-between;
  color:#0f172a;
`
