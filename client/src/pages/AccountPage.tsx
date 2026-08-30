import { Link } from 'react-router-dom'
import { useAuth } from '../components/auth/useAuth.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { loginPath, registerPath } from '../lib/returnPath.ts'

export function AccountPage() {
  const { user, status, logout } = useAuth()
  useDocumentTitle('Account | CommerceOps')

  if (status === 'loading') {
    return (
      <section className="page-wrap py-16 sm:py-20">
        <p className="text-sm text-muted">Checking your session…</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="page-wrap py-16 sm:py-20">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Sign in to your account
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted">
          Use your CommerceOps customer account to keep a shopping cart.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={loginPath('/account')} className="btn-primary">
            Log in
          </Link>
          <Link to={registerPath('/account')} className="btn-secondary">
            Create account
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page-wrap py-16 sm:py-20">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        Account
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
        {user.firstName} {user.lastName}
      </h1>
      <p className="mt-3 text-sm text-muted">{user.email}</p>
      <p className="mt-6 max-w-xl text-sm leading-6 text-muted">
        Order history will be available after checkout is added. You can manage
        your cart now.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/cart" className="btn-primary">
          View cart
        </Link>
        <button type="button" className="btn-secondary" onClick={() => void logout()}>
          Log out
        </button>
      </div>
    </section>
  )
}
