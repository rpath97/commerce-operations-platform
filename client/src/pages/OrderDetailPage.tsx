import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getOrder } from '../api/orders.ts'
import { useAuth } from '../components/auth/useAuth.ts'
import { ErrorState } from '../components/ui/ErrorState.tsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { formatAddressLines } from '../lib/formatAddress.ts'
import { formatAud, formatDiscountAud } from '../lib/formatPrice.ts'
import {
  isNotFoundError,
  isRequestAborted,
  isUnauthorizedError,
} from '../lib/http.ts'
import { formatOrderStatus } from '../lib/orderStatus.ts'
import { loginPath } from '../lib/returnPath.ts'
import type { OrderDetail } from '../types/order.ts'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function OrderDetailPage() {
  const { orderId = '' } = useParams()
  const location = useLocation()
  const placed = Boolean(
    (location.state as { placed?: boolean } | null)?.placed,
  )
  const { user, status: authStatus } = useAuth()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>(
    'loading',
  )

  useDocumentTitle(
    order ? `${order.orderNumber} | CommerceOps` : 'Order | CommerceOps',
  )

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!user) {
        return
      }
      setStatus('loading')
      getOrder(orderId, signal)
        .then((data) => {
          setOrder(data)
          setStatus('ready')
        })
        .catch((error: unknown) => {
          if (isRequestAborted(error) || isUnauthorizedError(error)) {
            return
          }
          setStatus(isNotFoundError(error) ? 'missing' : 'error')
        })
    },
    [orderId, user],
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
        <p className="text-sm text-muted">Loading order…</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="page-wrap py-16 sm:py-20">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Sign in to view this order
        </h1>
        <Link to={loginPath(`/orders/${orderId}`)} className="btn-primary mt-8 inline-flex">
          Log in
        </Link>
      </section>
    )
  }

  if (status === 'loading') {
    return (
      <section className="page-wrap py-10 sm:py-12">
        <p className="text-sm text-muted">Loading order…</p>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="page-wrap py-10 sm:py-12">
        <ErrorState message="We could not load this order." onRetry={() => load()} />
      </section>
    )
  }

  if (status === 'missing' || !order) {
    return (
      <section className="page-wrap py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Order not found
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted">
          This order is not available on your account.
        </p>
        <Link to="/orders" className="btn-primary mt-8 inline-flex">
          Back to orders
        </Link>
      </section>
    )
  }

  return (
    <section className="page-wrap py-10 sm:py-12">
      {placed ? (
        <p
          role="status"
          className="rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink"
        >
          Your order has been placed. No payment was collected.
        </p>
      ) : null}

      <p className="mt-6 text-sm font-medium tracking-wide text-muted uppercase">
        {placed ? 'Order placed' : 'Order details'}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight break-all text-ink">
        {order.orderNumber}
      </h1>
      <p className="mt-3 text-sm text-muted">{formatDate(order.createdAt)}</p>
      <p className="mt-3">
        <span className="rounded-full border border-line px-2.5 py-1 text-sm font-medium text-ink">
          {formatOrderStatus(order.status)}
        </span>
      </p>

      <div className="mt-10 grid min-w-0 gap-8 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-base font-semibold text-ink">Shipping address</h2>
          <p className="mt-3 text-sm leading-6 break-words text-ink">
            {formatAddressLines(order.shippingAddress).map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
        </section>

        <section className="min-w-0 rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-base font-semibold text-ink">Summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Subtotal</dt>
              <dd>{formatAud(order.subtotal)}</dd>
            </div>
            {order.promotionCode && order.discountAmount !== '0.00' ? (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Promotion</dt>
                  <dd className="break-all">{order.promotionCode}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Discount</dt>
                  <dd>{formatDiscountAud(order.discountAmount)}</dd>
                </div>
              </>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Shipping</dt>
              <dd>Free</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-2 font-semibold">
              <dt>Total</dt>
              <dd>{formatAud(order.total)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="mt-8 min-w-0">
        <h2 className="text-base font-semibold text-ink">Items</h2>
        <ul className="mt-4 space-y-3">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 justify-between gap-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium break-words text-ink">{item.productName}</p>
                <p className="mt-1 text-muted">
                  SKU {item.sku} · {item.quantity} × {formatAud(item.unitPrice)}
                </p>
              </div>
              <p className="shrink-0 font-medium">{formatAud(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
      </section>

      <Link to="/orders" className="btn-secondary mt-10 inline-flex">
        All orders
      </Link>
    </section>
  )
}
