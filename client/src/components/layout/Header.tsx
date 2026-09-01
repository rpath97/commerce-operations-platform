import { useEffect, useId, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { BrandLogo } from '../brand/BrandLogo.tsx'
import { useAuth } from '../auth/useAuth.ts'
import { useCart } from '../cart/useCart.ts'
import { loginPath } from '../../lib/returnPath.ts'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-brand/10 text-brand'
      : 'text-ink/80 hover:bg-white/5 hover:text-ink'
  }`

export function Header() {
  const { user, status, logout } = useAuth()
  const { itemCount } = useCart()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const returnFrom = `${location.pathname}${location.search}`

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
  const cartLabel = `Cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[#050805]/95 backdrop-blur-xl">
      <div className="page-wrap flex h-18 min-w-0 items-center justify-between gap-4">
        <Link
          to="/"
          className="flex shrink-0 items-center rounded-md focus-visible:outline-none"
          aria-label="Noryx home"
        >
          <BrandLogo
            decorative
            markClassName="h-8 w-8 sm:h-9 sm:w-9"
            wordmarkClassName="text-lg sm:text-xl"
          />
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

        <div className="hidden min-w-0 items-center gap-2 md:flex">
          {user ? (
            <>
              {user.role === 'ADMIN' ? (
                <Link
                  to="/admin"
                  className="rounded-md px-3 py-2 text-sm font-medium text-ink/80 hover:bg-white/5 hover:text-brand"
                >
                  Admin
                </Link>
              ) : null}
              <Link
                to="/account"
                className="rounded-md px-3 py-2 text-sm font-medium text-ink/80 hover:bg-white/5 hover:text-ink"
              >
                {accountLabel}
              </Link>
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm font-medium text-ink/80 hover:bg-white/5 hover:text-ink"
                onClick={() => void logout()}
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              to={loginPath(returnFrom)}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink/80 hover:bg-white/5 hover:text-ink"
            >
              {accountLabel}
            </Link>
          )}
          <Link
            to="/cart"
            className="relative rounded-md px-3 py-2 text-sm font-medium text-ink/80 hover:bg-white/5 hover:text-ink"
            aria-label={cartLabel}
          >
            Cart
            <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full border border-brand/30 bg-brand/10 px-1.5 text-xs text-brand">
              {itemCount}
            </span>
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex items-center rounded-md border border-line bg-white/5 px-3 py-2 text-sm font-medium text-ink hover:border-brand/50 hover:text-brand md:hidden"
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
          className="border-t border-line bg-[#070b08] px-4 py-4 md:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            <NavLink to="/shop" className={navLinkClass}>
              Shop
            </NavLink>
            <NavLink to="/categories" className={navLinkClass}>
              Categories
            </NavLink>
            {user?.role === 'ADMIN' ? (
              <NavLink to="/admin" className={navLinkClass}>
                Admin
              </NavLink>
            ) : null}
            <NavLink
              to={user ? '/account' : loginPath(returnFrom)}
              className={navLinkClass}
            >
              {accountLabel}
            </NavLink>
            {user ? (
              <button
                type="button"
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-ink/80 hover:bg-white/5 hover:text-ink"
                onClick={() => void logout()}
              >
                Log out
              </button>
            ) : null}
            <NavLink to="/cart" className={navLinkClass}>
              Cart ({itemCount})
            </NavLink>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
