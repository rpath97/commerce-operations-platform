import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listAdminOrders } from '../../api/adminOrders.ts'
import { OrderStatusBadge } from '../../components/admin/OrderStatusBadge.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { Pagination } from '../../components/ui/Pagination.tsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { formatAud } from '../../lib/formatPrice.ts'
import { isRequestAborted } from '../../lib/http.ts'
import { formatOrderStatus } from '../../lib/orderStatus.ts'
import type { AdminOrderSummary } from '../../types/admin.ts'
import type { OrderStatus } from '../../types/order.ts'

const STATUS_FILTERS: Array<OrderStatus | ''> = [
  '',
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AdminOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const search = searchParams.get('search') ?? ''
  const statusFilter = (searchParams.get('status') ?? '') as OrderStatus | ''
  const [searchDraft, setSearchDraft] = useState(search)
  const [orders, setOrders] = useState<AdminOrderSummary[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useDocumentTitle('Orders | Admin | Noryx')

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus('loading')
      listAdminOrders(
        {
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter || undefined,
        },
        signal,
      )
        .then((result) => {
          setOrders(result.data)
          setTotal(result.pagination.total)
          setTotalPages(result.pagination.totalPages)
          setStatus('ready')
        })
        .catch((error: unknown) => {
          if (isRequestAborted(error)) {
            return
          }
          setStatus('error')
        })
    },
    [page, search, statusFilter],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    setSearchDraft(search)
  }, [search])

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(next)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    if (!next.page) {
      params.delete('page')
    }
    setSearchParams(params)
  }

  return (
    <section className="min-w-0">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        Fulfilment
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        Orders
      </h1>

      <form
        className="mt-6 grid min-w-0 gap-3 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          updateParams({ search: searchDraft.trim(), page: '' })
        }}
      >
        <div className="min-w-0">
          <label htmlFor="admin-order-search" className="text-sm font-medium">
            Search orders
          </label>
          <input
            id="admin-order-search"
            className="input-field mt-1.5"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            autoComplete="off"
            placeholder="Order number, email, or name"
          />
        </div>
        <div>
          <label htmlFor="admin-order-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="admin-order-status"
            className="input-field mt-1.5"
            value={statusFilter}
            onChange={(event) =>
              updateParams({ status: event.target.value, page: '' })
            }
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value || 'all'} value={value}>
                {value ? formatOrderStatus(value) : 'All statuses'}
              </option>
            ))}
          </select>
        </div>
      </form>

      {status === 'loading' ? (
        <p className="mt-8 text-sm text-muted">Loading orders…</p>
      ) : null}

      {status === 'error' ? (
        <div className="mt-8">
          <ErrorState message="We could not load orders." onRetry={() => load()} />
        </div>
      ) : null}

      {status === 'ready' && orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No orders"
            message="No orders match this search or filter."
          />
        </div>
      ) : null}

      {status === 'ready' && orders.length > 0 ? (
        <>
          <ul className="mt-8 grid gap-3 xl:hidden">
            {orders.map((order) => (
              <li
                key={order.id}
                className="min-w-0 rounded-lg border border-line bg-paper p-4"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <p className="min-w-0 truncate font-medium">
                    {order.orderNumber}
                  </p>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="mt-2 break-words text-sm text-muted">
                  {order.customer.firstName} {order.customer.lastName}
                </p>
                <p className="break-all text-sm text-muted">{order.customer.email}</p>
                <p className="mt-2 text-sm">
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

          <div className="mt-8 hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-3 pr-4 font-medium">Order number</th>
                  <th className="py-3 pr-4 font-medium">Customer</th>
                  <th className="py-3 pr-4 font-medium">Date</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Items</th>
                  <th className="py-3 pr-4 font-medium">Order total</th>
                  <th className="py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-line">
                    <td className="py-3 pr-4 font-medium">{order.orderNumber}</td>
                    <td className="max-w-xs py-3 pr-4">
                      <span className="block truncate">
                        {order.customer.firstName} {order.customer.lastName}
                      </span>
                      <span className="block truncate text-muted">
                        {order.customer.email}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="py-3 pr-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{order.itemCount}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatAud(order.total)}
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

          <Pagination
            page={page}
            totalPages={Math.max(1, totalPages)}
            total={total}
            itemName="orders"
            onPageChange={(nextPage) =>
              updateParams({ page: String(nextPage) })
            }
          />
        </>
      ) : null}
    </section>
  )
}
