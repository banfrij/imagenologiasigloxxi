import { useState, type FormEvent } from 'react'
import styled from 'styled-components'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../../firebase'
import { allowedEmails, isAllowedEmail } from '../../constants/auth'

const getAuthErrorMessage = (code: string) => {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.'
    case 'auth/invalid-email':
      return 'El correo no es valido.'
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'
    default:
      return 'No fue posible iniciar sesion. Intenta nuevamente.'
  }
}

export default function LoginPanel() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()
    if (!isAllowedEmail(normalizedEmail)) {
      setError(`Solo tienen acceso: ${allowedEmails.join(', ')}.`)
      return
    }

    setError('')
    setIsLoading(true)

    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password)
    } catch (firebaseError: unknown) {
      const code =
        typeof firebaseError === 'object' && firebaseError !== null && 'code' in firebaseError
          ? String(firebaseError.code)
          : ''
      setError(getAuthErrorMessage(code))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <LoginCard>
      <LoginTitle>Ingreso seguro</LoginTitle>
      <LoginText>Acceso restringido a usuarios autorizados en Firebase Auth.</LoginText>
      <LoginForm onSubmit={handleSubmit}>
        <Field>
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="usuario@correo.com"
            autoComplete="username"
            required
          />
        </Field>
        <Field>
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            required
          />
        </Field>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <LoginButton type="submit" disabled={isLoading}>
          {isLoading ? 'Validando...' : 'Ingresar'}
        </LoginButton>
      </LoginForm>
    </LoginCard>
  )
}

const LoginCard = styled.section`
  width: min(480px, 100%);
  padding: 36px 32px;
  background: #ffffff;
  border: 1px solid #d6d9e6;
  border-radius: 28px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
`

const LoginTitle = styled.h1`
  margin: 0 0 8px;
  font-size: 28px;
  letter-spacing: -0.4px;
  color: #111827;
`

const LoginText = styled.p`
  margin: 0 0 28px;
  color: #4b5563;
  line-height: 1.6;
`

const LoginForm = styled.form`
  display: grid;
  gap: 18px;
`

const Field = styled.label`
  display: grid;
  gap: 10px;
  font-size: 14px;
  color: #4b5563;
`

const Label = styled.label`
  font-weight: 600;
`

const Input = styled.input`
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid #d1d5db;
  border-radius: 14px;
  background: #f8fafc;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:focus-visible {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.12);
  }
`

const LoginButton = styled.button`
  width: 100%;
  min-height: 46px;
  border: none;
  border-radius: 14px;
  background: #4f46e5;
  color: #ffffff;
  font-weight: 600;
  transition: background 0.2s ease, transform 0.2s ease;

  &:hover:not(:disabled) {
    background: #4338ca;
  }

  &:disabled {
    opacity: 0.72;
    cursor: not-allowed;
  }

  &:active {
    transform: translateY(1px);
  }
`

const ErrorMessage = styled.p`
  margin: 0;
  color: #b91c1c;
  font-size: 14px;
`
