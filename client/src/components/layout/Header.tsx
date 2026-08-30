import { useEffect, useId, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'text-brand'
      : 'text-ink/80 hover:bg-stone-100 hover:text-ink'
  }`

export function Header() {
  const { user, status } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const accountLabel =
    status === 'ready' && user ? user.firstName : 'Log in'

  return (
    <header className="border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="page-wrap flex h-16 min-w-0 items-center justify-between gap-4">
        <Link
          to="/"
          className="font-display text-lg font-semibold tracking-tight text-ink"
        >
          CommerceOps
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Primary"
        >
          <NavLink to="/shop" className={navLinkClass}>
            Shop
          </NavLink>
          <NavLink to="/categories" className={navLinkClass}>
            Categories
          </NavLink>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            to={user ? '/account' : '/login'}
            className="rounded-md px-3 py-2 text-sm font-medium text-ink/80 hover:bg-stone-100"
          >
            {accountLabel}
          </Link>
          <Link
            to="/cart"
            className="relative rounded-md px-3 py-2 text-sm font-medium text-ink/80 hover:bg-stone-100"
            aria-label="Cart, 0 items"
          >
            Cart
            <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-stone-100 px-1.5 text-xs text-muted">
              0
            </span>
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex items-center rounded-md border border-line px-3 py-2 text-sm font-medium md:hidden"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      {menuOpen ? (
        <div
          id={menuId}
          className="border-t border-line bg-paper px-4 py-4 md:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            <NavLink to="/shop" className={navLinkClass}>
              Shop
            </NavLink>
            <NavLink to="/categories" className={navLinkClass}>
              Categories
            </NavLink>
            <NavLink to={user ? '/account' : '/login'} className={navLinkClass}>
              {accountLabel}
            </NavLink>
            <NavLink to="/cart" className={navLinkClass}>
              Cart (0)
            </NavLink>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
