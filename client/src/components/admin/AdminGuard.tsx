import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'
import { loginPath } from '../../lib/returnPath.ts'

export function AdminGuard() {
  const { user, status } = useAuth()
  const location = useLocation()
  const from = `${location.pathname}${location.search}`

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <p className="text-sm text-muted">Loading admin console…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to={loginPath(from)} replace />
  }

  if (user.role !== 'ADMIN') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-16">
        <section className="w-full max-w-lg min-w-0 rounded-lg border border-line bg-paper p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Admin access required
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            This area is limited to operations staff. Your customer account
            cannot open the admin console.
          </p>
          <Link to="/" className="btn-primary mt-8 inline-flex">
            Back to storefront
          </Link>
        </section>
      </main>
    )
  }

  return <Outlet />
}
