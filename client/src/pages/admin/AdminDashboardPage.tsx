import {
  AlertTriangle,
  Archive,
  ArrowUpRight,
  Boxes,
  FolderTree,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminDashboard } from '../../api/adminDashboard.ts'
import { OrderStatusBadge } from '../../components/admin/OrderStatusBadge.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { formatAud } from '../../lib/formatPrice.ts'
import { isRequestAborted } from '../../lib/http.ts'
import type { AdminDashboard } from '../../types/admin.ts'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function DashboardSkeleton() {
  return (
    <div aria-label="Loading operations overview" className="animate-pulse">
      <div className="h-3 w-24 rounded bg-white/10" />
      <div className="mt-4 h-8 w-64 max-w-full rounded bg-white/10" />
      <div className="mt-3 h-4 w-[32rem] max-w-full rounded bg-white/10" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-36 rounded-lg border border-line bg-paper"
          />
        ))}
      </div>
      <div className="mt-8 h-72 rounded-lg border border-line bg-paper" />
    </div>
  )
}

export function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useDocumentTitle('Overview | Admin | Noryx')

  const load = useCallback((signal?: AbortSignal) => {
    setStatus('loading')
    getAdminDashboard(signal)
      .then((data) => {
        setDashboard(data)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (isRequestAborted(error)) {
          return
        }
        setStatus('error')
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  if (status === 'loading') {
    return <DashboardSkeleton />
  }

  if (status === 'error' || !dashboard) {
    return (
      <ErrorState
        message="We could not load the admin overview."
        onRetry={() => load()}
      />
    )
  }

  const priorityMetrics = [
    {
      label: 'Open orders',
      value: dashboard.counts.openOrders,
      detail: 'Pending fulfilment action',
      to: '/admin/orders',
      icon: ShoppingBag,
      urgent: dashboard.counts.openOrders > 0,
    },
    {
      label: 'Low stock',
      value: dashboard.counts.lowStockProducts,
      detail: 'Active products at threshold',
      to: '/admin/inventory?stockStatus=low-stock',
      icon: AlertTriangle,
      urgent: dashboard.counts.lowStockProducts > 0,
    },
    {
      label: 'Active products',
      value: dashboard.counts.activeProducts,
      detail: 'Available in the catalogue',
      to: '/admin/products?status=active',
      icon: PackageCheck,
      urgent: false,
    },
    {
      label: 'Customers',
      value: dashboard.counts.customers,
      detail: 'Registered customer accounts',
      to: '/admin/analytics',
      icon: Users,
      urgent: false,
    },
  ]

  const supportingMetrics = [
    {
      label: 'Total orders',
      value: dashboard.counts.totalOrders,
      icon: Boxes,
    },
    {
      label: 'Categories',
      value: dashboard.counts.categories,
      icon: FolderTree,
    },
    {
      label: 'Archived products',
      value: dashboard.counts.archivedProducts,
      icon: Archive,
    },
  ]

  return (
    <section className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            Operations overview
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Noryx control centre
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Current catalogue, customer, inventory, and order data from the
            connected operations API.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary gap-2"
          onClick={() => load()}
        >
          <RefreshCw aria-hidden="true" size={16} strokeWidth={1.8} />
          Refresh data
        </button>
      </div>

      <section aria-labelledby="priority-metrics-heading" className="mt-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2
              id="priority-metrics-heading"
              className="text-base font-semibold text-ink"
            >
              Operational pulse
            </h2>
            <p className="mt-1 text-sm text-muted">
              The areas most likely to need attention now.
            </p>
          </div>
          <span className="hidden items-center gap-2 text-xs font-medium text-muted sm:inline-flex">
            <span className="h-2 w-2 bg-brand" aria-hidden="true" />
            API connected
          </span>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {priorityMetrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div
                key={metric.label}
                className={`group relative min-w-0 overflow-hidden rounded-lg border bg-paper p-4 transition-colors ${
                  metric.urgent
                    ? 'border-brand/45 hover:border-brand'
                    : 'border-line hover:border-brand/45'
                }`}
              >
                <div
                  className={`absolute inset-y-0 left-0 w-0.5 ${
                    metric.urgent ? 'bg-brand' : 'bg-line'
                  }`}
                  aria-hidden="true"
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <dt className="text-sm font-medium text-muted">
                      {metric.label}
                    </dt>
                    <dd className="mt-3 text-3xl font-semibold tracking-tight text-ink tabular-nums">
                      {metric.value}
                    </dd>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-line bg-canvas text-brand">
                    <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted">
                  {metric.detail}
                </p>
                <Link
                  to={metric.to}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ink transition-colors hover:text-brand"
                  aria-label={`View ${metric.label.toLowerCase()}`}
                >
                  View details
                  <ArrowUpRight
                    aria-hidden="true"
                    size={14}
                    strokeWidth={1.8}
                  />
                </Link>
              </div>
            )
          })}
        </dl>
      </section>

      <div className="mt-7 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section
          aria-labelledby="recent-orders-heading"
          className="min-w-0 rounded-lg border border-line bg-paper"
        >
          <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-4 sm:px-5">
            <div>
              <h2
                id="recent-orders-heading"
                className="text-base font-semibold text-ink"
              >
                Recent orders
              </h2>
              <p className="mt-1 text-xs text-muted">
                Latest five orders. Order totals are not revenue.
              </p>
            </div>
            <Link
              to="/admin/orders"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand"
            >
              View all
              <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.8} />
            </Link>
          </div>

          {dashboard.recentOrders.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted sm:px-5">
              No orders yet.
            </p>
          ) : (
            <ul className="divide-y divide-line md:hidden">
              {dashboard.recentOrders.map((order) => (
                <li key={order.id} className="min-w-0 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="truncate font-semibold text-ink hover:text-brand"
                      >
                        {order.orderNumber}
                      </Link>
                      <p className="mt-1 truncate text-sm text-muted">
                        {order.customer.firstName} {order.customer.lastName}
                      </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span>{order.itemCount} items</span>
                    <span className="font-medium text-ink tabular-nums">
                      {formatAud(order.total)}
                    </span>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {dashboard.recentOrders.length > 0 ? (
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-canvas/55 text-xs text-muted uppercase">
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Order
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Items
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Total
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Placed
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dashboard.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-white/[0.025]">
                      <td className="px-5 py-3.5 font-semibold text-ink">
                        {order.orderNumber}
                      </td>
                      <td className="max-w-xs px-4 py-3.5">
                        <span className="block truncate text-ink">
                          {order.customer.firstName} {order.customer.lastName}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {order.customer.email}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {order.itemCount}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-ink tabular-nums">
                        {formatAud(order.total)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-1 font-semibold text-brand"
                          aria-label={`View order ${order.orderNumber}`}
                        >
                          View
                          <ArrowUpRight
                            aria-hidden="true"
                            size={14}
                            strokeWidth={1.8}
                          />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <aside className="min-w-0 space-y-4" aria-label="Overview summary">
          <section className="rounded-lg border border-line bg-paper p-4">
            <h2 className="text-sm font-semibold text-ink">
              Platform totals
            </h2>
            <dl className="mt-3 divide-y divide-line">
              {supportingMetrics.map((metric) => {
                const Icon = metric.icon
                return (
                  <div
                    key={metric.label}
                    className="flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-1"
                  >
                    <dt className="flex min-w-0 items-center gap-2 text-sm text-muted">
                      <Icon
                        aria-hidden="true"
                        className="shrink-0 text-brand"
                        size={16}
                        strokeWidth={1.8}
                      />
                      <span className="truncate">{metric.label}</span>
                    </dt>
                    <dd className="font-semibold text-ink tabular-nums">
                      {metric.value}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </section>

          <section className="border border-brand/35 bg-brand/[0.055] p-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">
              Quick actions
            </p>
            <div className="mt-3 grid gap-2">
              <Link
                to="/admin/products/new"
                className="btn-primary justify-between gap-3"
              >
                Add product
                <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
              </Link>
              <Link
                to="/admin/inventory"
                className="btn-secondary justify-between gap-3"
              >
                Update inventory
                <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
              </Link>
              <Link
                to="/admin/promotions/new"
                className="btn-secondary justify-between gap-3"
              >
                Create promotion
                <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}
