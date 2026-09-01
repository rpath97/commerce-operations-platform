import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
    isActive
      ? 'bg-brand text-[#050805]'
      : 'text-ink/75 hover:bg-white/5 hover:text-brand'
  }`

export function AdminLayout() {
  const { user, logout } = useAuth()

  const nav = (
    <nav aria-label="Admin">
      <ul className="flex flex-col gap-1">
        <li>
          <NavLink to="/admin" end className={navLinkClass}>
            Overview
          </NavLink>
        </li>
        <li>
          <NavLink to="/admin/products" className={navLinkClass}>
            Products
          </NavLink>
        </li>
        <li>
          <NavLink to="/admin/categories" className={navLinkClass}>
            Categories
          </NavLink>
        </li>
        <li>
          <NavLink to="/admin/inventory" className={navLinkClass}>
            Inventory
          </NavLink>
        </li>
        <li>
          <NavLink to="/admin/orders" className={navLinkClass}>
            Orders
          </NavLink>
        </li>
        <li>
          <NavLink to="/admin/promotions" className={navLinkClass}>
            Promotions
          </NavLink>
        </li>
        <li>
          <NavLink to="/admin/analytics" className={navLinkClass}>
            Analytics
          </NavLink>
        </li>
      </ul>
    </nav>
  )

  return (
    <div className="flex min-h-screen min-w-0 bg-canvas">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-[#050805] lg:flex lg:flex-col">
        <div className="border-b border-line px-4 py-5">
          <img
            src="/noryx-logo.png"
            alt="Noryx"
            className="h-10 w-auto max-w-[170px] object-contain"
          />
          <p className="mt-2 text-xs font-medium tracking-[0.18em] text-brand uppercase">
            Admin Console
          </p>
        </div>
        <div className="flex-1 px-3 py-4">{nav}</div>
        <div className="border-t border-line px-3 py-4">
          <Link
            to="/"
            className="block rounded-md px-3 py-2 text-sm font-medium text-ink/75 hover:bg-white/5 hover:text-brand"
          >
            Back to storefront
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line bg-[#070b08]">
          <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 lg:hidden">
              <p className="truncate text-sm font-semibold text-ink">
                Noryx Admin
              </p>
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm text-muted">
                {user ? `${user.firstName} ${user.lastName}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                to="/account"
                className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink/75 hover:bg-white/5 hover:text-brand sm:inline"
              >
                Account
              </Link>
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm font-medium text-ink/75 hover:bg-white/5 hover:text-brand"
                onClick={() => void logout()}
              >
                Log out
              </button>
            </div>
          </div>
          <div className="overflow-x-auto border-t border-line px-2 py-2 lg:hidden">
            <nav className="flex min-w-0 gap-1" aria-label="Admin mobile">
              <NavLink to="/admin" end className={navLinkClass}>
                Overview
              </NavLink>
              <NavLink to="/admin/products" className={navLinkClass}>
                Products
              </NavLink>
              <NavLink to="/admin/categories" className={navLinkClass}>
                Categories
              </NavLink>
              <NavLink to="/admin/inventory" className={navLinkClass}>
                Inventory
              </NavLink>
              <NavLink to="/admin/orders" className={navLinkClass}>
                Orders
              </NavLink>
              <NavLink to="/admin/promotions" className={navLinkClass}>
                Promotions
              </NavLink>
              <NavLink to="/admin/analytics" className={navLinkClass}>
                Analytics
              </NavLink>
              <Link
                to="/"
                className="rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-ink/75 hover:bg-white/5 hover:text-brand"
              >
                Storefront
              </Link>
            </nav>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
