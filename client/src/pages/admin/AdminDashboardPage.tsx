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

export function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useDocumentTitle('Overview | Admin | CommerceOps')

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
    return <p className="text-sm text-muted">Loading overview…</p>
  }

  if (status === 'error' || !dashboard) {
    return (
      <ErrorState
        message="We could not load the admin overview."
        onRetry={() => load()}
      />
    )
  }

  const cards = [
    { label: 'Customers', value: dashboard.counts.customers },
    { label: 'Active products', value: dashboard.counts.activeProducts },
    { label: 'Archived products', value: dashboard.counts.archivedProducts },
    { label: 'Categories', value: dashboard.counts.categories },
    { label: 'Total orders', value: dashboard.counts.totalOrders },
    { label: 'Open orders', value: dashboard.counts.openOrders },
    { label: 'Low stock', value: dashboard.counts.lowStockProducts },
  ]

  return (
    <section className="min-w-0">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        Overview
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Operations snapshot
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Counts for catalogue, customers, and orders that still need action.
        Order totals are not revenue.
      </p>

      <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => (
          <li
            key={card.label}
            className="min-w-0 rounded-2xl border border-line bg-paper px-4 py-4"
          >
            <p className="text-sm text-muted">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
              {card.value}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/admin/inventory" className="btn-secondary inline-flex">
          Manage inventory
        </Link>
        <Link to="/admin/promotions" className="btn-secondary inline-flex">
          Manage promotions
        </Link>
        <Link to="/admin/analytics" className="btn-primary inline-flex">
          View analytics
        </Link>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-ink">Recent orders</h2>
        {dashboard.recentOrders.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No orders yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 xl:hidden">
            {dashboard.recentOrders.map((order) => (
              <li
                key={order.id}
                className="min-w-0 rounded-2xl border border-line bg-paper p-4"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <p className="min-w-0 truncate font-medium text-ink">
                    {order.orderNumber}
                  </p>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="mt-2 break-words text-sm text-muted">
                  {order.customer.firstName} {order.customer.lastName}
                  <span className="block break-all">{order.customer.email}</span>
                </p>
                <p className="mt-2 text-sm text-muted">
                  {order.itemCount} items · Order total {formatAud(order.total)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(order.createdAt)}
                </p>
                <Link
                  to={`/admin/orders/${order.id}`}
                  className="btn-secondary mt-4 inline-flex"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}

        {dashboard.recentOrders.length > 0 ? (
          <div className="mt-4 hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-3 pr-4 font-medium">Order</th>
                  <th className="py-3 pr-4 font-medium">Customer</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Items</th>
                  <th className="py-3 pr-4 font-medium">Order total</th>
                  <th className="py-3 pr-4 font-medium">Date</th>
                  <th className="py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-line">
                    <td className="py-3 pr-4 font-medium text-ink">
                      {order.orderNumber}
                    </td>
                    <td className="max-w-xs py-3 pr-4">
                      <span className="block truncate">
                        {order.customer.firstName} {order.customer.lastName}
                      </span>
                      <span className="block truncate text-muted">
                        {order.customer.email}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{order.itemCount}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatAud(order.total)}
                    </td>
                    <td className="py-3 pr-4 text-muted">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="py-3">
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="font-medium text-brand"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  )
}
