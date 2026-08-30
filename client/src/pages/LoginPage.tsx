import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/useAuth.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { getApiErrorMessage } from '../lib/http.ts'
import { getSafeReturnPath, registerPath } from '../lib/returnPath.ts'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnPath = getSafeReturnPath(searchParams.get('from'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useDocumentTitle('Log in | CommerceOps')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await login(email, password)
      navigate(returnPath, { replace: true })
    } catch (caught: unknown) {
      setError(getApiErrorMessage(caught, 'Unable to sign in. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="page-wrap py-16 sm:py-20">
      <div className="mx-auto w-full max-w-md min-w-0">
        <p className="text-sm font-medium tracking-wide text-muted uppercase">
          Account
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
          Log in
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Sign in to add products to your cart and manage quantities.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
          {error ? (
            <p role="alert" className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink">
              {error}
            </p>
          ) : null}

          <div>
            <label htmlFor="login-email" className="text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-field mt-1.5"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field mt-1.5"
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted">
          Need an account?{' '}
          <Link
            to={registerPath(returnPath)}
            className="font-medium text-ink underline-offset-2 hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </section>
  )
}
