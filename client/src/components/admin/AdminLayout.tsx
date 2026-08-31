import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap ${
    isActive
      ? 'bg-brand text-[#f8faf8]'
      : 'text-ink/80 hover:bg-stone-100 hover:text-ink'
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
      <aside className="hidden w-56 shrink-0 border-r border-line bg-paper lg:flex lg:flex-col">
        <div className="border-b border-line px-4 py-5">
          <p className="font-display text-base font-semibold text-ink">
            CommerceOps
          </p>
          <p className="mt-1 text-xs text-muted">Admin Console</p>
        </div>
        <div className="flex-1 px-3 py-4">{nav}</div>
        <div className="border-t border-line px-3 py-4">
          <Link
            to="/"
            className="block rounded-md px-3 py-2 text-sm font-medium text-ink/80 hover:bg-stone-100"
          >
            Back to storefront
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line bg-paper">
          <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 lg:hidden">
              <p className="truncate text-sm font-semibold text-ink">
                CommerceOps Admin
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
                className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink/80 hover:bg-stone-100 sm:inline"
              >
                Account
              </Link>
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm font-medium text-ink/80 hover:bg-stone-100"
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
                className="rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-ink/80 hover:bg-stone-100"
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
