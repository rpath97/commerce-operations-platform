import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listOrders } from '../api/orders.ts'
import { useAuth } from '../components/auth/useAuth.ts'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { ErrorState } from '../components/ui/ErrorState.tsx'
import { Pagination } from '../components/ui/Pagination.tsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { formatAud } from '../lib/formatPrice.ts'
import { isRequestAborted, isUnauthorizedError } from '../lib/http.ts'
import { formatOrderStatus } from '../lib/orderStatus.ts'
import { loginPath, registerPath } from '../lib/returnPath.ts'
import type { OrderSummary } from '../types/order.ts'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function OrdersPage() {
  const { user, status: authStatus } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useDocumentTitle('Orders | CommerceOps')

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!user) {
        return
      }
      setStatus('loading')
      listOrders(page, 10, signal)
        .then((result) => {
          setOrders(result.data)
          setTotal(result.pagination.total)
          setTotalPages(Math.max(1, result.pagination.totalPages))
          setStatus('ready')
        })
        .catch((error: unknown) => {
          if (isRequestAborted(error) || isUnauthorizedError(error)) {
            return
          }
          setStatus('error')
        })
    },
    [user, page],
  )

  useEffect(() => {
    if (authStatus !== 'ready' || !user) {
      return
    }
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [authStatus, user, load])

  if (authStatus === 'loading') {
    return (
      <section className="page-wrap py-10 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Orders</h1>
        <p className="mt-4 text-sm text-muted">Loading orders…</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="page-wrap py-16 sm:py-20">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Sign in to view orders
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted">
          Order history is saved to your customer account.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={loginPath('/orders')} className="btn-primary">
            Log in
          </Link>
          <Link to={registerPath('/orders')} className="btn-secondary">
            Create account
          </Link>
        </div>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="page-wrap py-10 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Orders</h1>
        <div className="mt-8">
          <ErrorState message="We could not load your orders." onRetry={() => load()} />
        </div>
      </section>
    )
  }

  if (status === 'ready' && orders.length === 0) {
    return (
      <section className="page-wrap py-10 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Orders</h1>
        <div className="mt-8">
          <EmptyState
            title="No orders yet."
            message="When you place an order, it will appear here."
            action={{ label: 'Start shopping', to: '/shop' }}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="page-wrap py-10 sm:py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Orders</h1>
      {status === 'loading' ? (
        <p className="mt-6 text-sm text-muted">Loading orders…</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="min-w-0 rounded-2xl border border-line bg-paper p-5"
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-all text-ink">
                    {order.orderNumber}
                  </p>
                  <p className="mt-1 text-sm text-muted">{formatDate(order.createdAt)}</p>
                  <p className="mt-2 text-sm text-ink">
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs font-medium">
                      {formatOrderStatus(order.status)}
                    </span>
                    <span className="ml-3 text-muted">
                      {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink">
                    {formatAud(order.total)}
                  </p>
                  <Link
                    to={`/orders/${order.id}`}
                    className="mt-3 inline-flex text-sm font-medium text-ink underline-offset-2 hover:underline"
                  >
                    View order
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={(next) => setSearchParams({ page: String(next) })}
        itemName="orders"
      />
    </section>
  )
}
