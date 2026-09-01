import {
  BadgePercent,
  ChartNoAxesCombined,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingBag,
  Store,
  UserRound,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'

type AdminNavItem = {
  label: string
  to: string
  end?: boolean
  icon: LucideIcon
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: 'Overview', to: '/admin', end: true, icon: LayoutDashboard },
  { label: 'Products', to: '/admin/products', icon: Package },
  { label: 'Categories', to: '/admin/categories', icon: FolderTree },
  { label: 'Inventory', to: '/admin/inventory', icon: Warehouse },
  { label: 'Orders', to: '/admin/orders', icon: ShoppingBag },
  { label: 'Promotions', to: '/admin/promotions', icon: BadgePercent },
  { label: 'Analytics', to: '/admin/analytics', icon: ChartNoAxesCombined },
]

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
    isActive
      ? 'bg-brand text-[#050805]'
      : 'text-ink/75 hover:bg-white/5 hover:text-brand'
  }`

function AdminNavigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav aria-label={mobile ? 'Admin mobile' : 'Admin'}>
      <ul className={mobile ? 'flex min-w-max gap-1' : 'flex flex-col gap-1'}>
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={navLinkClass}>
                <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
                {item.label}
              </NavLink>
            </li>
          )
        })}
        {mobile ? (
          <li>
            <Link
              to="/"
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-ink/75 transition-colors hover:bg-white/5 hover:text-brand"
            >
              <Store aria-hidden="true" size={17} strokeWidth={1.8} />
              Storefront
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}

export function AdminLayout() {
  const { user, logout } = useAuth()

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
            Admin console
          </p>
        </div>
        <div className="flex-1 px-3 py-4">
          <AdminNavigation />
        </div>
        <div className="border-t border-line px-3 py-4">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-ink/75 transition-colors hover:bg-white/5 hover:text-brand"
          >
            <Store aria-hidden="true" size={17} strokeWidth={1.8} />
            Back to storefront
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line bg-[#070b08]">
          <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink lg:hidden">
                Noryx Admin
              </p>
              <p className="hidden truncate text-sm text-muted lg:block">
                {user ? `${user.firstName} ${user.lastName}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                to="/account"
                className="hidden items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-ink/75 transition-colors hover:bg-white/5 hover:text-brand sm:inline-flex"
              >
                <UserRound aria-hidden="true" size={16} strokeWidth={1.8} />
                Account
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-ink/75 transition-colors hover:bg-white/5 hover:text-brand"
                onClick={() => void logout()}
              >
                <LogOut aria-hidden="true" size={16} strokeWidth={1.8} />
                Log out
              </button>
            </div>
          </div>
          <div className="overflow-x-auto border-t border-line px-2 py-2 lg:hidden">
            <AdminNavigation mobile />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
