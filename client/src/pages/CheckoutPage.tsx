import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createAddress, listAddresses } from '../api/addresses.ts'
import { createOrder } from '../api/orders.ts'
import { validatePromotionCode } from '../api/promotions.ts'
import { AddressForm } from '../components/address/AddressForm.tsx'
import { useAuth } from '../components/auth/useAuth.ts'
import { useCart } from '../components/cart/useCart.ts'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { ErrorState } from '../components/ui/ErrorState.tsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { cartCheckoutBlocked } from '../lib/cartCheckout.ts'
import { formatAddressLines } from '../lib/formatAddress.ts'
import { formatAud, formatDiscountAud } from '../lib/formatPrice.ts'
import {
  getApiErrorMessage,
  isConflictError,
  isRequestAborted,
} from '../lib/http.ts'
import { formatDiscountLabel } from '../lib/promotionStatus.ts'
import { loginPath, registerPath } from '../lib/returnPath.ts'
import { emptyAddressInput, type Address, type AddressInput } from '../types/address.ts'
import type { PromotionPreview } from '../types/promotion.ts'

export function CheckoutPage() {
  const { user, status: authStatus } = useAuth()
  const { cart, status: cartStatus, refreshCart, pendingKeys } = useCart()
  const navigate = useNavigate()

  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressStatus, setAddressStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formValue, setFormValue] = useState<AddressInput>(emptyAddressInput)
  const [formError, setFormError] = useState<string | null>(null)
  const [savingAddress, setSavingAddress] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const [promoDraft, setPromoDraft] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<PromotionPreview | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoNotice, setPromoNotice] = useState<string | null>(null)
  const [applyingPromo, setApplyingPromo] = useState(false)

  useDocumentTitle('Checkout | CommerceOps')

  useEffect(() => {
    if (authStatus !== 'ready' || !user) {
      return
    }

    const controller = new AbortController()
    setAddressStatus('loading')
    listAddresses(controller.signal)
      .then((data) => {
        setAddresses(data)
        setSelectedId(data[0]?.id ?? null)
        setShowForm(data.length === 0)
        setAddressStatus('ready')
      })
      .catch((error: unknown) => {
        if (isRequestAborted(error)) {
          return
        }
        setAddressStatus('error')
      })

    return () => controller.abort()
  }, [authStatus, user])

  const blocked = useMemo(() => cartCheckoutBlocked(cart), [cart])
  const mutating = pendingKeys.length > 0
  const cartSubtotal = cart?.summary.subtotal ?? '0.00'

  useEffect(() => {
    if (!appliedPromo) {
      return
    }
    if (appliedPromo.subtotal !== cartSubtotal) {
      setAppliedPromo(null)
      setPromoNotice(null)
      setPromoError('Cart totals changed. Apply the promotion code again.')
    }
  }, [appliedPromo, cartSubtotal])

  async function handleSaveAddress() {
    setFormError(null)
    setSavingAddress(true)
    try {
      const created = await createAddress({
        ...formValue,
        addressLine2: formValue.addressLine2 || null,
        phone: formValue.phone || null,
      })
      setAddresses((current) => [created, ...current])
      setSelectedId(created.id)
      setShowForm(false)
      setFormValue(emptyAddressInput)
    } catch (caught: unknown) {
      setFormError(getApiErrorMessage(caught, 'Unable to save this address.'))
    } finally {
      setSavingAddress(false)
    }
  }

  async function handleApplyPromotion() {
    if (applyingPromo || placing) {
      return
    }

    const code = promoDraft.trim()
    if (!code) {
      setPromoError('Enter a promotion code.')
      setPromoNotice(null)
      return
    }

    setApplyingPromo(true)
    setPromoError(null)
    setPromoNotice(null)

    try {
      const preview = await validatePromotionCode(code)
      setAppliedPromo(preview)
      setPromoDraft(preview.code)
      setPromoNotice(`${preview.code} applied`)
    } catch (caught: unknown) {
      setAppliedPromo(null)
      setPromoError(
        getApiErrorMessage(caught, 'Unable to apply this promotion code.'),
      )
    } finally {
      setApplyingPromo(false)
    }
  }

  function handleRemovePromotion() {
    setAppliedPromo(null)
    setPromoDraft('')
    setPromoError(null)
    setPromoNotice(null)
  }

  async function handlePlaceOrder() {
    if (!selectedId || placing || blocked) {
      return
    }

    setPlaceError(null)
    setPlacing(true)

    try {
      const order = await createOrder(
        selectedId,
        appliedPromo?.code,
      )
      await refreshCart()
      navigate(`/orders/${order.id}`, { state: { placed: true } })
    } catch (caught: unknown) {
      const message = getApiErrorMessage(
        caught,
        isConflictError(caught)
          ? 'Some items are no longer available in the requested quantity. Review your cart before placing the order.'
          : 'Unable to place this order.',
      )
      setPlaceError(message)
      if (
        appliedPromo &&
        /promotion|minimum order/i.test(message)
      ) {
        setAppliedPromo(null)
        setPromoNotice(null)
        setPromoError(message)
      }
      if (isConflictError(caught)) {
        await refreshCart()
      }
    } finally {
      setPlacing(false)
    }
  }

  if (authStatus === 'loading' || cartStatus === 'loading' || cartStatus === 'idle') {
    return (
      <section className="page-wrap py-10 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Checkout</h1>
        <p className="mt-4 text-sm text-muted">Loading checkout…</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="page-wrap py-16 sm:py-20">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Sign in to check out
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted">
          Checkout uses your saved cart and shipping addresses.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={loginPath('/checkout')} className="btn-primary">
            Log in
          </Link>
          <Link to={registerPath('/checkout')} className="btn-secondary">
            Create account
          </Link>
        </div>
      </section>
    )
  }

  if (cart.items.length === 0) {
    return (
      <section className="page-wrap py-10 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Checkout</h1>
        <div className="mt-8">
          <EmptyState
            title="Your cart is empty."
            message="Add products before placing an order."
            action={{ label: 'Continue shopping', to: '/shop' }}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="page-wrap py-10 sm:py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Checkout</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        No payment is collected in this demo. Orders are created with a pending
        status.
      </p>

      {blocked ? (
        <p role="alert" className="mt-6 rounded-lg border border-line bg-paper px-4 py-3 text-sm text-ink">
          Some items cannot be purchased in the current quantity. Update your cart
          before placing the order.
        </p>
      ) : null}

      <div className="mt-8 grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-10">
          <section>
            <h2 className="text-lg font-semibold text-ink">1. Shipping address</h2>
            {addressStatus === 'loading' ? (
              <p className="mt-4 text-sm text-muted">Loading addresses…</p>
            ) : null}
            {addressStatus === 'error' ? (
              <div className="mt-4">
                <ErrorState message="We could not load saved addresses." />
              </div>
            ) : null}
            {addressStatus === 'ready' && addresses.length > 0 ? (
              <fieldset className="mt-4 min-w-0 space-y-3">
                <legend className="sr-only">Saved shipping addresses</legend>
                {addresses.map((address) => {
                  const selected = selectedId === address.id
                  return (
                    <label
                      key={address.id}
                      className={`block min-w-0 cursor-pointer rounded-2xl border px-4 py-4 ${
                        selected ? 'border-brand bg-paper' : 'border-line bg-paper'
                      }`}
                    >
                      <span className="flex min-w-0 items-start gap-3">
                        <input
                          type="radio"
                          name="shipping-address"
                          className="mt-1"
                          checked={selected}
                          onChange={() => setSelectedId(address.id)}
                        />
                        <span className="min-w-0 text-sm leading-6 text-ink">
                          {formatAddressLines(address).map((line) => (
                            <span key={line} className="block break-words">
                              {line}
                            </span>
                          ))}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </fieldset>
            ) : null}

            {addressStatus === 'ready' && addresses.length === 0 && !showForm ? (
              <p className="mt-4 text-sm text-muted">
                You do not have a saved shipping address yet.
              </p>
            ) : null}

            {showForm ? (
              <div className="mt-6 rounded-2xl border border-line bg-paper p-4 sm:p-5">
                <h3 className="text-base font-semibold text-ink">Add a shipping address</h3>
                <div className="mt-4">
                  <AddressForm
                    idPrefix="checkout"
                    value={formValue}
                    onChange={setFormValue}
                    onSubmit={() => void handleSaveAddress()}
                    submitting={savingAddress}
                    submitLabel="Save address"
                    error={formError}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn-secondary mt-4"
                onClick={() => setShowForm(true)}
              >
                Add another address
              </button>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink">2. Order review</h2>
            <ul className="mt-4 space-y-3">
              {cart.items.map((item) => (
                <li
                  key={item.id}
                  className="flex min-w-0 justify-between gap-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium break-words text-ink">{item.product.name}</p>
                    <p className="mt-1 text-muted">
                      {item.quantity} × {formatAud(item.product.price)}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium text-ink">
                    {formatAud(item.lineTotal)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="min-w-0 rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-lg font-semibold text-ink">3. Place order</h2>

          <div className="mt-4 min-w-0">
            <label htmlFor="checkout-promo" className="text-sm font-medium text-ink">
              Promotion code
            </label>
            {appliedPromo ? (
              <div className="mt-2 min-w-0 rounded-xl border border-line bg-canvas px-3 py-3">
                <p className="break-all text-sm font-medium text-ink">
                  {appliedPromo.code} applied
                </p>
                <p className="mt-1 text-sm text-muted">
                  {formatDiscountLabel(
                    appliedPromo.discountType,
                    appliedPromo.discountValue,
                  )}
                </p>
                <p className="mt-1 text-sm text-ink">
                  You save {formatAud(appliedPromo.discountAmount)}
                </p>
                <button
                  type="button"
                  className="btn-secondary mt-3"
                  onClick={handleRemovePromotion}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
                <input
                  id="checkout-promo"
                  className="input-field min-w-0 flex-1 uppercase"
                  value={promoDraft}
                  onChange={(event) => setPromoDraft(event.target.value)}
                  autoComplete="off"
                  disabled={applyingPromo || placing}
                  aria-invalid={promoError ? true : undefined}
                  aria-describedby={
                    promoError
                      ? 'checkout-promo-error'
                      : promoNotice
                        ? 'checkout-promo-success'
                        : undefined
                  }
                />
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  disabled={applyingPromo || placing}
                  onClick={() => void handleApplyPromotion()}
                >
                  {applyingPromo ? 'Applying…' : 'Apply'}
                </button>
              </div>
            )}
            {promoError ? (
              <p
                id="checkout-promo-error"
                role="alert"
                aria-live="polite"
                className="mt-2 text-sm text-ink"
              >
                {promoError}
              </p>
            ) : null}
            {promoNotice && !promoError ? (
              <p
                id="checkout-promo-success"
                role="status"
                aria-live="polite"
                className="mt-2 text-sm text-muted"
              >
                {promoNotice}
              </p>
            ) : null}
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Subtotal</dt>
              <dd className="font-medium text-ink">{formatAud(cart.summary.subtotal)}</dd>
            </div>
            {appliedPromo ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Discount</dt>
                <dd className="font-medium text-ink">
                  {formatDiscountAud(appliedPromo.discountAmount)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Shipping</dt>
              <dd className="text-ink">Free</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-3">
              <dt className="font-semibold text-ink">Total</dt>
              <dd className="font-semibold text-ink">
                {formatAud(
                  appliedPromo
                    ? appliedPromo.totalAfterDiscount
                    : cart.summary.subtotal,
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted">
            Standard shipping is free in this demonstration. Tax is not calculated.
          </p>
          {placeError ? (
            <p role="alert" className="mt-4 text-sm text-ink">
              {placeError}{' '}
              <Link to="/cart" className="font-medium underline-offset-2 hover:underline">
                Review cart
              </Link>
            </p>
          ) : null}
          <button
            type="button"
            className="btn-primary mt-6 w-full"
            disabled={
              placing ||
              blocked ||
              mutating ||
              !selectedId ||
              addressStatus !== 'ready'
            }
            onClick={() => void handlePlaceOrder()}
          >
            {placing ? 'Placing order…' : 'Place order'}
          </button>
        </aside>
      </div>
    </section>
  )
}
