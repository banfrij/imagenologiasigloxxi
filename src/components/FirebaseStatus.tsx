import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { db } from '../firebase'

export default function FirebaseStatus() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking')

  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        // lightweight read to check connectivity
        const q = query(collection(db, 'appointments'), limit(1) as any)
        await getDocs(q)
        if (mounted) setStatus('ok')
      } catch (e) {
        if (mounted) setStatus('error')
      }
    }
    void check()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <StatusWrap title={status === 'ok' ? 'Conectado a Firebase' : status === 'error' ? 'No se pudo conectar a Firebase' : 'Comprobando conexión...'} $state={status}>
      {status === 'checking' && '…'}
      {status === 'ok' && 'Firebase: OK'}
      {status === 'error' && 'Firebase: Error'}
    </StatusWrap>
  )
}

const StatusWrap = styled.div<{ $state: 'checking' | 'ok' | 'error' }>`
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 12px;
  background: ${({ $state }) => ($state === 'ok' ? '#dcfce7' : $state === 'error' ? '#fee2e2' : '#f3f4f6')};
  color: ${({ $state }) => ($state === 'ok' ? '#065f46' : $state === 'error' ? '#991b1b' : '#374151')};
  border: 1px solid rgba(0,0,0,0.06);
  display: inline-block;
`
