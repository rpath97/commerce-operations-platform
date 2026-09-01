import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ProductVisual } from '../components/catalogue/ProductVisual.tsx'
import { ErrorState } from '../components/ui/ErrorState.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { useAuth } from '../components/auth/useAuth.ts'
import { useCart } from '../components/cart/useCart.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { cartCheckoutBlocked } from '../lib/cartCheckout.ts'
import { formatAud } from '../lib/formatPrice.ts'
import { loginPath, registerPath } from '../lib/returnPath.ts'
import type { CartItem } from '../types/cart.ts'

function itemWarning(item: CartItem): string | null {
  if (!item.product.isActive) {
    return 'This product is no longer available.'
  }

  if (item.product.availableQuantity <= 0) {
    return 'Out of stock'
  }

  if (item.quantity > item.product.availableQuantity) {
    return `Only ${item.product.availableQuantity} available`
  }

  return null
}

function CartSkeleton() {
  return (
    <div
      className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]"
      aria-busy="true"
      aria-label="Loading cart"
    >
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-lg bg-white/10" />
        <div className="h-28 animate-pulse rounded-lg bg-white/10" />
      </div>
      <div className="h-48 animate-pulse rounded-lg bg-white/10" />
    </div>
  )
}

function CartLine({
  item,
  busy,
  onDecrease,
  onIncrease,
  onRemove,
}: {
  item: CartItem
  busy: boolean
  onDecrease: () => void
  onIncrease: () => void
  onRemove: () => void
}) {
  const warning = itemWarning(item)
  const canChange = item.product.isActive && item.product.availableQuantity > 0
  const atMax =
    !canChange || item.quantity >= item.product.availableQuantity

  return (
    <article className="grid min-w-0 gap-4 rounded-lg border border-line bg-paper p-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start">
      <Link to={`/products/${item.product.slug}`} className="min-w-0">
        <ProductVisual
          categorySlug={item.product.category.slug}
          categoryName={item.product.category.name}
          productName={item.product.name}
          className="aspect-square rounded-xl"
        />
      </Link>
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          {item.product.category.name}
        </p>
        <h2 className="mt-1 text-base font-semibold break-words text-ink">
          <Link to={`/products/${item.product.slug}`} className="hover:underline">
            {item.product.name}
          </Link>
        </h2>
        <p className="mt-1 text-xs text-muted">SKU {item.product.sku}</p>
        <p className="mt-2 text-sm text-ink">{formatAud(item.product.price)} each</p>
        {warning ? (
          <p className="mt-2 text-sm font-medium text-ink" role="status">
            {warning}
          </p>
        ) : null}

        <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary h-10 w-10 px-0"
              aria-label={`Decrease quantity of ${item.product.name}`}
              disabled={busy || item.quantity <= 1}
              onClick={onDecrease}
            >
              −
            </button>
            <span className="min-w-8 text-center text-sm font-medium" aria-live="polite">
              {item.quantity}
            </span>
            <button
              type="button"
              className="btn-secondary h-10 w-10 px-0"
              aria-label={`Increase quantity of ${item.product.name}`}
              disabled={busy || atMax}
              onClick={onIncrease}
            >
              +
            </button>
          </div>
          <p className="text-sm font-semibold text-ink">
            {formatAud(item.lineTotal)}
          </p>
        </div>

        <button
          type="button"
          className="mt-3 text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-45"
          disabled={busy}
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </article>
  )
}

export function CartPage() {
  const { user, status: authStatus } = useAuth()
  const {
    cart,
    status,
    error,
    pendingKeys,
    refreshCart,
    updateQuantity,
    removeItem,
    clearItems,
  } = useCart()
  const [lineError, setLineError] = useState<string | null>(null)

  useDocumentTitle('Cart | Noryx')

  if (authStatus === 'loading' || status === 'loading' || status === 'idle') {
    return (
      <section className="page-wrap py-10 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Cart</h1>
        <div className="mt-8">
          <CartSkeleton />
        </div>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="page-wrap py-16 sm:py-20">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Sign in to view your cart
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted">
          Shopping carts are saved to your account so they stay available on
          this device and after you sign back in.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={loginPath('/cart')} className="btn-primary">
            Log in
          </Link>
          <Link to={registerPath('/cart')} className="btn-secondary">
            Create account
          </Link>
          <Link to="/shop" className="btn-secondary">
            Continue shopping
          </Link>
        </div>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="page-wrap py-10 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Cart</h1>
        <div className="mt-8">
          <ErrorState
            message={error ?? 'We could not load your cart.'}
            onRetry={() => void refreshCart()}
          />
        </div>
      </section>
    )
  }

  if (cart.items.length === 0) {
    return (
      <section className="page-wrap py-10 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Cart</h1>
        <div className="mt-8">
          <EmptyState
            title="Your cart is empty."
            message="Browse the catalogue and add products when you are ready."
            action={{ label: 'Continue shopping', to: '/shop' }}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="page-wrap py-10 sm:py-12">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Cart</h1>
        <button
          type="button"
          className="text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-45"
          disabled={pendingKeys.includes('clear')}
          onClick={() => {
            setLineError(null)
            void clearItems().catch((caught: unknown) => {
              setLineError(
                caught instanceof Error ? caught.message : 'Unable to clear cart.',
              )
            })
          }}
        >
          Clear cart
        </button>
      </div>

      {lineError ? (
        <p role="alert" className="mt-4 text-sm text-ink">
          {lineError}
        </p>
      ) : null}

      <div className="mt-8 grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {cart.items.map((item) => {
            const busy =
              pendingKeys.includes(`update:${item.id}`) ||
              pendingKeys.includes(`remove:${item.id}`)

            return (
              <CartLine
                key={item.id}
                item={item}
                busy={busy}
                onDecrease={() => {
                  setLineError(null)
                  void updateQuantity(item.id, item.quantity - 1).catch(
                    (caught: unknown) => {
                      setLineError(
                        caught instanceof Error
                          ? caught.message
                          : 'Unable to update quantity.',
                      )
                    },
                  )
                }}
                onIncrease={() => {
                  setLineError(null)
                  void updateQuantity(item.id, item.quantity + 1).catch(
                    (caught: unknown) => {
                      setLineError(
                        caught instanceof Error
                          ? caught.message
                          : 'Unable to update quantity.',
                      )
                    },
                  )
                }}
                onRemove={() => {
                  setLineError(null)
                  void removeItem(item.id).catch((caught: unknown) => {
                    setLineError(
                      caught instanceof Error
                        ? caught.message
                        : 'Unable to remove item.',
                    )
                  })
                }}
              />
            )
          })}
        </div>

        <aside className="min-w-0 rounded-lg border border-line bg-paper p-5">
          <h2 className="text-lg font-semibold text-ink">Order summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Items</dt>
              <dd className="font-medium text-ink">{cart.summary.itemCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Subtotal</dt>
              <dd className="font-medium text-ink">
                {formatAud(cart.summary.subtotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Shipping</dt>
              <dd className="text-right text-ink">Free standard shipping</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-3">
              <dt className="font-semibold text-ink">Total</dt>
              <dd className="font-semibold text-ink">
                {formatAud(cart.summary.subtotal)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">
            Tax is not calculated. No payment is collected at checkout.
          </p>
          {cartCheckoutBlocked(cart) ? (
            <p className="mt-4 text-sm text-ink" role="status">
              Update unavailable items before checking out.
            </p>
          ) : null}
          {cartCheckoutBlocked(cart) || pendingKeys.length > 0 ? (
            <button type="button" className="btn-primary mt-6 w-full" disabled>
              Proceed to checkout
            </button>
          ) : (
            <Link to="/checkout" className="btn-primary mt-6 w-full">
              Proceed to checkout
            </Link>
          )}
        </aside>
      </div>
    </section>
  )
}
