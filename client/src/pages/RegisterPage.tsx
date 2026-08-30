import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/useAuth.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { getApiErrorMessage } from '../lib/http.ts'
import { getSafeReturnPath, loginPath } from '../lib/returnPath.ts'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnPath = getSafeReturnPath(searchParams.get('from'))

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useDocumentTitle('Create account | CommerceOps')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await register({ firstName, lastName, email, password })
      navigate(returnPath, { replace: true })
    } catch (caught: unknown) {
      setError(
        getApiErrorMessage(caught, 'Unable to create an account. Please try again.'),
      )
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
          Create account
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Registration creates a customer account. You can use it to keep a
          shopping cart.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
          {error ? (
            <p role="alert" className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink">
              {error}
            </p>
          ) : null}

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="register-first-name" className="text-sm font-medium text-ink">
                First name
              </label>
              <input
                id="register-first-name"
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
                maxLength={100}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="input-field mt-1.5"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="register-last-name" className="text-sm font-medium text-ink">
                Last name
              </label>
              <input
                id="register-last-name"
                name="lastName"
                type="text"
                autoComplete="family-name"
                required
                maxLength={100}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="input-field mt-1.5"
              />
            </div>
          </div>

          <div>
            <label htmlFor="register-email" className="text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="register-email"
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
            <label htmlFor="register-password" className="text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field mt-1.5"
            />
            <p className="mt-1.5 text-xs text-muted">8 to 72 characters.</p>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted">
          Already have an account?{' '}
          <Link
            to={loginPath(returnPath)}
            className="font-medium text-ink underline-offset-2 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </section>
  )
}
