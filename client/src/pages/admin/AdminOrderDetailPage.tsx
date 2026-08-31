import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAdminOrder, updateAdminOrderStatus } from '../../api/adminOrders.ts'
import { OrderStatusBadge } from '../../components/admin/OrderStatusBadge.tsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { formatAddressLines } from '../../lib/formatAddress.ts'
import { formatAud, formatDiscountAud } from '../../lib/formatPrice.ts'
import {
  getApiErrorMessage,
  isConflictError,
  isNotFoundError,
  isRequestAborted,
} from '../../lib/http.ts'
import {
  formatStatusAction,
  getNextAdminStatuses,
} from '../../lib/orderStatus.ts'
import type { AdminOrderDetail } from '../../types/admin.ts'
import type { OrderStatus } from '../../types/order.ts'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AdminOrderDetailPage() {
  const { orderId = '' } = useParams()
  const [order, setOrder] = useState<AdminOrderDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>(
    'loading',
  )
  const [busyStatus, setBusyStatus] = useState<OrderStatus | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  useDocumentTitle(
    order ? `${order.orderNumber} | Admin | CommerceOps` : 'Order | Admin',
  )

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus('loading')
      getAdminOrder(orderId, signal)
        .then((data) => {
          setOrder(data)
          setStatus('ready')
        })
        .catch((error: unknown) => {
          if (isRequestAborted(error)) {
            return
          }
          setStatus(isNotFoundError(error) ? 'missing' : 'error')
        })
    },
    [orderId],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  async function applyStatus(next: OrderStatus) {
    setBusyStatus(next)
    setNotice(null)
    try {
      const updated = await updateAdminOrderStatus(orderId, next)
      setOrder(updated)
      setCancelOpen(false)
    } catch (error: unknown) {
      if (isConflictError(error)) {
        setNotice(
          getApiErrorMessage(
            error,
            'This status change is no longer valid for the order.',
          ),
        )
      } else {
        setNotice(getApiErrorMessage(error, 'Unable to update this order.'))
      }
    } finally {
      setBusyStatus(null)
    }
  }

  if (status === 'loading') {
    return <p className="text-sm text-muted">Loading order…</p>
  }

  if (status === 'error') {
    return (
      <ErrorState message="We could not load this order." onRetry={() => load()} />
    )
  }

  if (status === 'missing' || !order) {
    return (
      <section>
        <h1 className="text-2xl font-semibold text-ink">Order not found</h1>
        <Link to="/admin/orders" className="btn-secondary mt-6 inline-flex">
          Back to orders
        </Link>
      </section>
    )
  }

  const nextStatuses = getNextAdminStatuses(order.status)
  const showDiscount = order.discountAmount !== '0.00'

  return (
    <section className="min-w-0">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        Orders
      </p>
      <div className="mt-2 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 break-all text-2xl font-semibold tracking-tight text-ink">
          {order.orderNumber}
        </h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-2 text-sm text-muted">
        Created {formatDate(order.createdAt)}
      </p>

      {notice ? (
        <p className="mt-4 text-sm" role="alert">
          {notice}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-lg font-semibold">Customer</h2>
          <p className="mt-3 break-words">
            {order.customer.firstName} {order.customer.lastName}
          </p>
          <p className="mt-1 break-all text-sm text-muted">{order.customer.email}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-lg font-semibold">Shipping address</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {formatAddressLines(order.shippingAddress).map((line) => (
              <li key={line} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 min-w-0 rounded-2xl border border-line bg-paper p-5">
        <h2 className="text-lg font-semibold">Items</h2>
        <ul className="mt-4 divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex min-w-0 flex-wrap justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="break-words font-medium">{item.productName}</p>
                <p className="break-all text-sm text-muted">{item.sku}</p>
                <p className="text-sm text-muted">
                  {item.quantity} × {formatAud(item.unitPrice)}
                </p>
              </div>
              <p className="tabular-nums">{formatAud(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatAud(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Shipping</dt>
            <dd className="tabular-nums">{formatAud(order.shippingAmount)}</dd>
          </div>
          {order.promotionCode ? (
            <div className="flex justify-between gap-4">
              <dt>Promotion</dt>
              <dd className="break-all">{order.promotionCode}</dd>
            </div>
          ) : null}
          {showDiscount ? (
            <div className="flex justify-between gap-4">
              <dt>Discount</dt>
              <dd className="tabular-nums">
                {formatDiscountAud(order.discountAmount)}
              </dd>
            </div>
          ) : (
            <div className="flex justify-between gap-4 text-muted">
              <dt>Discount</dt>
              <dd className="tabular-nums">{formatAud(order.discountAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 font-semibold">
            <dt>Order total</dt>
            <dd className="tabular-nums">{formatAud(order.total)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 min-w-0 rounded-2xl border border-line bg-paper p-5">
        <h2 className="text-lg font-semibold">Update status</h2>
        {nextStatuses.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            This order has no further status actions.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            {nextStatuses.map((next) =>
              next === 'CANCELLED' ? (
                <button
                  key={next}
                  type="button"
                  className="btn-secondary"
                  disabled={busyStatus !== null}
                  onClick={() => setCancelOpen(true)}
                >
                  {formatStatusAction(next)}
                </button>
              ) : (
                <button
                  key={next}
                  type="button"
                  className="btn-primary"
                  disabled={busyStatus !== null}
                  onClick={() => void applyStatus(next)}
                >
                  {busyStatus === next ? 'Updating…' : formatStatusAction(next)}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      <Link to="/admin/orders" className="btn-secondary mt-8 inline-flex">
        Back to orders
      </Link>

      {cancelOpen ? (
        <ConfirmDialog
          title="Cancel this order?"
          message="Inventory for product-linked items will be returned to stock."
          confirmLabel="Cancel order"
          cancelLabel="Keep order"
          busy={busyStatus === 'CANCELLED'}
          onConfirm={() => void applyStatus('CANCELLED')}
          onCancel={() => setCancelOpen(false)}
        />
      ) : null}
    </section>
  )
}
