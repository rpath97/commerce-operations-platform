import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  adjustAdminInventory,
  getAdminInventory,
  listInventoryMovements,
  receiveAdminInventory,
  updateInventorySettings,
} from '../../api/adminInventory.ts'
import { StockStatusBadge } from '../../components/admin/StockStatusBadge.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { Pagination } from '../../components/ui/Pagination.tsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import {
  getApiErrorMessage,
  isNotFoundError,
  isRequestAborted,
} from '../../lib/http.ts'
import {
  formatMovementType,
  formatQuantityDelta,
} from '../../lib/inventoryStatus.ts'
import type {
  InventoryDetail,
  InventoryMovement,
  InventoryMovementType,
} from '../../types/inventory.ts'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AdminInventoryDetailPage() {
  const { productId = '' } = useParams()
  const [detail, setDetail] = useState<InventoryDetail | null>(null)
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [typeFilter, setTypeFilter] = useState<InventoryMovementType | ''>('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>(
    'loading',
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [receiveQty, setReceiveQty] = useState('')
  const [receiveNote, setReceiveNote] = useState('')
  const [receiveBusy, setReceiveBusy] = useState(false)
  const [adjustDirection, setAdjustDirection] = useState<'add' | 'remove'>('add')
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustBusy, setAdjustBusy] = useState(false)
  const [threshold, setThreshold] = useState('')
  const [thresholdBusy, setThresholdBusy] = useState(false)

  useDocumentTitle(
    detail ? `${detail.product.name} inventory | CommerceOps` : 'Inventory',
  )

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus('loading')
      Promise.all([
        getAdminInventory(productId, signal),
        listInventoryMovements(
          productId,
          {
            page,
            limit: 10,
            type: typeFilter || undefined,
          },
          signal,
        ),
      ])
        .then(([nextDetail, history]) => {
          setDetail(nextDetail)
          setThreshold(String(nextDetail.inventory.lowStockThreshold))
          setMovements(history.data)
          setTotal(history.pagination.total)
          setTotalPages(history.pagination.totalPages)
          setStatus('ready')
        })
        .catch((error: unknown) => {
          if (isRequestAborted(error)) {
            return
          }
          setStatus(isNotFoundError(error) ? 'missing' : 'error')
        })
    },
    [productId, page, typeFilter],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  async function handleReceive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const quantity = Number.parseInt(receiveQty, 10)
    if (!Number.isInteger(quantity) || quantity < 1) {
      setNotice('Enter a quantity of at least 1 to receive.')
      return
    }
    setReceiveBusy(true)
    setNotice(null)
    try {
      await receiveAdminInventory(productId, {
        quantity,
        note: receiveNote.trim() || undefined,
      })
      setReceiveQty('')
      setReceiveNote('')
      setNotice('Stock received.')
      load()
    } catch (error: unknown) {
      setNotice(getApiErrorMessage(error, 'Unable to receive stock.'))
    } finally {
      setReceiveBusy(false)
    }
  }

  async function handleAdjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const quantity = Number.parseInt(adjustQty, 10)
    if (!Number.isInteger(quantity) || quantity < 1) {
      setNotice('Enter a whole number of at least 1.')
      return
    }
    const quantityDelta = adjustDirection === 'add' ? quantity : -quantity
    setAdjustBusy(true)
    setNotice(null)
    try {
      await adjustAdminInventory(productId, {
        quantityDelta,
        reason: adjustReason.trim(),
      })
      setAdjustQty('')
      setAdjustReason('')
      setNotice('Inventory adjusted.')
      load()
    } catch (error: unknown) {
      setNotice(getApiErrorMessage(error, 'Unable to adjust inventory.'))
    } finally {
      setAdjustBusy(false)
    }
  }

  async function handleThreshold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number.parseInt(threshold, 10)
    if (!Number.isInteger(value) || value < 0) {
      setNotice('Low-stock threshold must be zero or a positive whole number.')
      return
    }
    setThresholdBusy(true)
    setNotice(null)
    try {
      await updateInventorySettings(productId, value)
      setNotice('Low-stock threshold updated.')
      load()
    } catch (error: unknown) {
      setNotice(getApiErrorMessage(error, 'Unable to update the threshold.'))
    } finally {
      setThresholdBusy(false)
    }
  }

  if (status === 'loading' && !detail) {
    return <p className="text-sm text-muted">Loading inventory…</p>
  }

  if (status === 'error') {
    return (
      <ErrorState
        message="We could not load this inventory record."
        onRetry={() => load()}
      />
    )
  }

  if (status === 'missing' || !detail) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">Inventory not found</h1>
        <Link to="/admin/inventory" className="btn-secondary mt-6 inline-flex">
          Back to inventory
        </Link>
      </section>
    )
  }

  const expectedReceive =
    Number.parseInt(receiveQty, 10) > 0
      ? detail.inventory.quantity + Number.parseInt(receiveQty, 10)
      : null
  const adjustAmount = Number.parseInt(adjustQty, 10)
  const expectedAdjust =
    Number.isInteger(adjustAmount) && adjustAmount > 0
      ? adjustDirection === 'add'
        ? detail.inventory.quantity + adjustAmount
        : detail.inventory.quantity - adjustAmount
      : null

  return (
    <section className="min-w-0">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        Inventory
      </p>
      <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight">
        {detail.product.name}
      </h1>
      <p className="mt-2 break-all text-sm text-muted">{detail.product.sku}</p>
      <p className="mt-1 text-sm text-muted">{detail.product.category.name}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="chip">
          {detail.product.isActive ? 'Active' : 'Archived'}
        </span>
        <StockStatusBadge status={detail.inventory.stockStatus} />
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <p className="text-sm text-muted">Current stock</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {detail.inventory.quantity}
        </p>
        <p className="mt-2 text-sm text-muted">
          Low-stock threshold {detail.inventory.lowStockThreshold}
        </p>
      </div>

      {notice ? (
        <p className="mt-4 text-sm" role="status" aria-live="polite">
          {notice}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <form
          className="min-w-0 space-y-3 rounded-2xl border border-line bg-paper p-5"
          onSubmit={handleReceive}
          autoComplete="off"
        >
          <h2 className="text-lg font-semibold">Receive stock</h2>
          <div>
            <label htmlFor="receive-qty" className="text-sm font-medium">
              Quantity received
            </label>
            <input
              id="receive-qty"
              className="input-field mt-1.5"
              value={receiveQty}
              onChange={(event) => setReceiveQty(event.target.value)}
              inputMode="numeric"
              required
            />
          </div>
          <div>
            <label htmlFor="receive-note" className="text-sm font-medium">
              Note
            </label>
            <input
              id="receive-note"
              className="input-field mt-1.5"
              value={receiveNote}
              onChange={(event) => setReceiveNote(event.target.value)}
            />
          </div>
          {expectedReceive !== null ? (
            <p className="text-sm text-muted">
              Expected quantity after receive: {expectedReceive}
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={receiveBusy}>
            {receiveBusy ? 'Receiving…' : 'Receive stock'}
          </button>
        </form>

        <form
          className="min-w-0 space-y-3 rounded-2xl border border-line bg-paper p-5"
          onSubmit={handleAdjust}
          autoComplete="off"
        >
          <h2 className="text-lg font-semibold">Adjust stock</h2>
          <fieldset>
            <legend className="text-sm font-medium">Adjustment</legend>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="adjust-direction"
                  checked={adjustDirection === 'add'}
                  onChange={() => setAdjustDirection('add')}
                />
                Add stock
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="adjust-direction"
                  checked={adjustDirection === 'remove'}
                  onChange={() => setAdjustDirection('remove')}
                />
                Remove stock
              </label>
            </div>
          </fieldset>
          <div>
            <label htmlFor="adjust-qty" className="text-sm font-medium">
              Quantity
            </label>
            <input
              id="adjust-qty"
              className="input-field mt-1.5"
              value={adjustQty}
              onChange={(event) => setAdjustQty(event.target.value)}
              inputMode="numeric"
              required
            />
          </div>
          <div>
            <label htmlFor="adjust-reason" className="text-sm font-medium">
              Reason
            </label>
            <input
              id="adjust-reason"
              className="input-field mt-1.5"
              value={adjustReason}
              onChange={(event) => setAdjustReason(event.target.value)}
              required
              minLength={3}
            />
          </div>
          {expectedAdjust !== null ? (
            <p className="text-sm text-muted">
              Expected quantity after adjustment: {expectedAdjust}
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={adjustBusy}>
            {adjustBusy ? 'Saving…' : 'Save adjustment'}
          </button>
        </form>

        <form
          className="min-w-0 space-y-3 rounded-2xl border border-line bg-paper p-5"
          onSubmit={handleThreshold}
          autoComplete="off"
        >
          <h2 className="text-lg font-semibold">Low-stock threshold</h2>
          <div>
            <label htmlFor="threshold" className="text-sm font-medium">
              Threshold
            </label>
            <input
              id="threshold"
              className="input-field mt-1.5"
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
              inputMode="numeric"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={thresholdBusy}>
            {thresholdBusy ? 'Updating…' : 'Update threshold'}
          </button>
        </form>
      </div>

      <div className="mt-10">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-semibold">Movement history</h2>
          <div>
            <label htmlFor="movement-type" className="text-sm font-medium">
              Type
            </label>
            <select
              id="movement-type"
              className="input-field mt-1.5"
              value={typeFilter}
              onChange={(event) => {
                setPage(1)
                setTypeFilter(event.target.value as InventoryMovementType | '')
              }}
            >
              <option value="">All types</option>
              <option value="INITIAL_STOCK">Initial stock</option>
              <option value="RECEIPT">Stock received</option>
              <option value="ADJUSTMENT">Manual adjustment</option>
              <option value="ORDER_PLACED">Order placed</option>
              <option value="ORDER_CANCELLED">Order cancelled</option>
            </select>
          </div>
        </div>

        {movements.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No inventory movements have been recorded yet.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {movements.map((movement) => (
              <li
                key={movement.id}
                className="min-w-0 rounded-2xl border border-line bg-paper p-4"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <p className="font-medium">{formatMovementType(movement.type)}</p>
                  <p className="tabular-nums font-semibold">
                    {formatQuantityDelta(movement.quantityDelta)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(movement.createdAt)}
                </p>
                <p className="mt-2 text-sm">
                  Before {movement.quantityBefore} → After {movement.quantityAfter}
                </p>
                {movement.note ? (
                  <p className="mt-1 break-words text-sm text-muted">
                    {movement.note}
                  </p>
                ) : null}
                {movement.actor ? (
                  <p className="mt-1 break-all text-sm text-muted">
                    {movement.actor.firstName} {movement.actor.lastName} ·{' '}
                    {movement.actor.email}
                  </p>
                ) : null}
                {movement.referenceType === 'Order' && movement.referenceId ? (
                  <Link
                    to={`/admin/orders/${movement.referenceId}`}
                    className="mt-3 inline-flex text-sm font-medium text-brand"
                  >
                    View order
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <Pagination
          page={page}
          totalPages={Math.max(1, totalPages)}
          total={total}
          itemName="movements"
          onPageChange={setPage}
        />
      </div>

      <Link to="/admin/inventory" className="btn-secondary mt-8 inline-flex">
        Back to inventory
      </Link>
    </section>
  )
}
