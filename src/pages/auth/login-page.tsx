import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Button, Spinner } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RowError } from '@/components/form/field-row'
import { Ep3Logo } from '@/components/app/logo'
import { wait } from '@/lib/format'
import { isSignedIn, signIn } from '@/lib/session'
import { toast } from '@/lib/toast'

function LoginField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="login-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  )
}

function PasswordInput({ id, value, onChange, autoComplete, invalid }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false)
  const label = show ? 'Hide password' : 'Show password'
  return (
    <span className="login-input">
      <Input id={id} name={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} aria-invalid={invalid || undefined} onChange={e => onChange(e.target.value)} />
      <button className="login-show" type="button" aria-pressed={show} aria-label={label} title={label} onClick={() => setShow(s => !s)}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  )
}

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="login">
      <div className="login-side">{children}</div>
    </div>
  )
}

function LoginForm() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const userRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Log In · EP3 Admin'
    userRef.current?.focus()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      document.getElementById(username.trim() ? 'password' : 'username')?.focus()
      return
    }
    setBusy(true)
    await wait(500)
    signIn()
    navigate('/firms')
  }

  return (
    <LoginShell>
      <form className="login-form" noValidate onSubmit={submit}>
        <Ep3Logo className="login-logo" />
        <h1 tabIndex={-1}>Welcome back</h1>
        <p>Log in to the EP3 admin console.</p>
        <LoginField label="Username" htmlFor="username">
          <Input ref={userRef} id="username" name="username" autoComplete="username" autoCapitalize="off" spellCheck={false} value={username} onChange={e => { setUsername(e.target.value) }} />
        </LoginField>
        <LoginField label="Password" htmlFor="password">
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </LoginField>
        <RowError message={error} />
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? <><Spinner />Logging In…</> : <>Log In<ArrowRight size={18} /></>}
        </Button>
        <p className="login-foot">Need to register? <Link to="/?register=true">Register</Link></p>
      </form>
    </LoginShell>
  )
}

const PASSWORD_MIN_STRENGTH = 12
const SAMPLE_REGISTER_TOKEN = [{ alg: 'none' }, { sub: 'firms/A1-Trading/users/alex.morgan' }, { sample: true }]
  .map(part => btoa(JSON.stringify(part)).replace(/=+$/, ''))
  .join('.')

function tokenUsername(token: string) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)).sub.split('/').pop() as string
  } catch {
    return ''
  }
}

function passwordSuggestion(password: string) {
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter(re => re.test(password)).length
  const strength = password.length + (variety - 1) * 2
  if (strength >= PASSWORD_MIN_STRENGTH) return ''
  const percent = (strength / PASSWORD_MIN_STRENGTH).toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 2 })
  return `${percent} Add another word or two, or mix in capitals, numbers and symbols.`
}

type RegisterValues = { token: string; password: string; matchpassword: string }
type RegisterErrors = Partial<Record<keyof RegisterValues, string>>

function registerErrors(values: RegisterValues): RegisterErrors {
  const errors: RegisterErrors = {}
  if (!values.token) errors.token = 'Token is required.'
  if (!values.password) errors.password = 'Password is required.'
  if (values.password !== values.matchpassword) errors.matchpassword = 'Password must match.'
  else if (values.password && passwordSuggestion(values.password)) errors.matchpassword = passwordSuggestion(values.password)
  return errors
}

function RegisterForm() {
  const navigate = useNavigate()
  const [values, setValues] = useState<RegisterValues>({ token: '', password: '', matchpassword: '' })
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const tokenRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Register · EP3 Admin'
    tokenRef.current?.focus()
  }, [])

  // Once a field shows an error it re-validates as the person types, like the prototype.
  const update = (patch: Partial<RegisterValues>) => {
    const next = { ...values, ...patch, token: (patch.token ?? values.token) }
    setValues(next)
    const fresh = registerErrors({ ...next, token: next.token.trim() })
    const shown: RegisterErrors = {}
    ;(Object.keys(errors) as (keyof RegisterValues)[]).forEach(k => { if (errors[k] && fresh[k]) shown[k] = fresh[k] })
    setErrors(shown)
    setFormError('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = { ...values, token: values.token.trim() }
    const errs = registerErrors(clean)
    setErrors(errs)
    setFormError('')
    const first = (['token', 'password', 'matchpassword'] as const).find(k => errs[k])
    if (first) {
      document.getElementById(first)?.focus()
      return
    }
    setBusy(true)
    await wait(500)
    if (!tokenUsername(clean.token)) {
      setBusy(false)
      setFormError('Unable to register user.')
      return
    }
    toast('Successfully submitted registration for new user, you may now log in')
    navigate('/')
  }

  return (
    <LoginShell>
      <form className="login-form" noValidate onSubmit={submit}>
        <Ep3Logo className="login-logo" />
        <h1 tabIndex={-1}>Register</h1>
        <p>Paste your registration token and choose a password. Your username comes from the token.</p>
        <LoginField label="Token" htmlFor="token">
          <Input ref={tokenRef} id="token" name="token" autoComplete="off" autoCapitalize="off" spellCheck={false} value={values.token} aria-invalid={!!errors.token || undefined} onChange={e => update({ token: e.target.value })} />
          <RowError message={errors.token} />
          <span className="login-hint">
            No token?{' '}
            <button type="button" onClick={() => { update({ token: SAMPLE_REGISTER_TOKEN }); document.getElementById('password')?.focus() }}>Use a sample token</button>
          </span>
        </LoginField>
        <LoginField label="Username" htmlFor="reg-username">
          <Input id="reg-username" autoComplete="username" disabled value={tokenUsername(values.token.trim())} />
        </LoginField>
        <LoginField label="Password" htmlFor="password">
          <PasswordInput id="password" value={values.password} onChange={v => update({ password: v })} autoComplete="new-password" invalid={!!errors.password} />
          <RowError message={errors.password} />
        </LoginField>
        <LoginField label="Confirm Password" htmlFor="matchpassword">
          <PasswordInput id="matchpassword" value={values.matchpassword} onChange={v => update({ matchpassword: v })} autoComplete="new-password" invalid={!!errors.matchpassword} />
          <RowError message={errors.matchpassword} />
        </LoginField>
        <RowError message={formError} />
        <Button type="submit" size="lg" disabled={busy}>{busy ? <><Spinner />Registering…</> : 'Register'}</Button>
        <p className="login-foot">Already registered? <Link to="/">Log In</Link></p>
      </form>
    </LoginShell>
  )
}

/** "/" shows Log In, or Register with ?register=true. Signed-in people go to Firms. */
export function LoginPage() {
  const [params] = useSearchParams()
  if (isSignedIn()) return <Navigate to="/firms" replace />
  return String(params.get('register')).toLowerCase() === 'true' ? <RegisterForm key="register" /> : <LoginForm key="login" />
}
