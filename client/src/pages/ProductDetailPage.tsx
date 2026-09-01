import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getProductBySlug } from '../api/catalogue.ts'
import { useAuth } from '../components/auth/useAuth.ts'
import { useCart } from '../components/cart/useCart.ts'
import { ProductVisual } from '../components/catalogue/ProductVisual.tsx'
import { ErrorState } from '../components/ui/ErrorState.tsx'
import { ProductDetailSkeleton } from '../components/ui/Skeletons.tsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { formatAud } from '../lib/formatPrice.ts'
import { isNotFoundError, isRequestAborted } from '../lib/http.ts'
import { loginPath } from '../lib/returnPath.ts'
import { shopPath } from '../lib/shopQuery.ts'
import type { Product } from '../types/catalogue.ts'

export function ProductDetailPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { user, status: authStatus } = useAuth()
  const { addItem, pendingKeys } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>(
    'loading',
  )
  const [quantity, setQuantity] = useState(1)
  const [addError, setAddError] = useState<string | null>(null)

  useDocumentTitle(
    product ? `${product.name} | Noryx` : 'Product | Noryx',
  )

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus('loading')
      setProduct(null)
      getProductBySlug(slug, signal)
        .then((data) => {
          setProduct(data)
          setQuantity(1)
          setAddError(null)
          setStatus('ready')
        })
        .catch((error: unknown) => {
          if (isRequestAborted(error) || signal?.aborted) {
            return
          }
          setStatus(isNotFoundError(error) ? 'missing' : 'error')
        })
    },
    [slug],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  if (status === 'loading') {
    return (
      <section className="page-wrap py-10 sm:py-12">
        <ProductDetailSkeleton />
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="page-wrap py-10 sm:py-12">
        <ErrorState
          message="We couldn't load this product right now."
          onRetry={() => load()}
        />
      </section>
    )
  }

  if (status === 'missing' || !product) {
    return (
      <section className="page-wrap py-16 text-center">
        <p className="text-sm font-medium tracking-wide text-muted uppercase">
          Unavailable
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
          Product not found
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted">
          This product is not available in the live catalogue.
        </p>
        <Link to="/shop" className="btn-primary mt-8 inline-flex">
          Back to shop
        </Link>
      </section>
    )
  }

  const selected = product
  const inStock = selected.inventory.inStock
  const maxQuantity = Math.max(1, selected.inventory.quantity)
  const adding = pendingKeys.includes(`add:${selected.id}`)

  async function handleAddToCart() {
    setAddError(null)

    if (authStatus !== 'ready') {
      return
    }

    if (!user) {
      navigate(loginPath(`/products/${selected.slug}`))
      return
    }

    try {
      await addItem(selected.id, quantity)
    } catch (caught: unknown) {
      setAddError(
        caught instanceof Error ? caught.message : 'Unable to add to cart.',
      )
    }
  }

  return (
    <section className="page-wrap py-10 sm:py-12">
      <nav className="text-sm text-muted" aria-label="Breadcrumb">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link to="/shop" className="hover:text-ink">
              Shop
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              to={shopPath({
                category: product.category.slug,
                page: 1,
                sort: 'newest',
              })}
              className="hover:text-ink"
            >
              {product.category.name}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="mt-8 grid min-w-0 gap-10 lg:grid-cols-2 lg:gap-16">
        <ProductVisual
          categorySlug={product.category.slug}
          categoryName={product.category.name}
          productName={product.name}
          className="min-h-80 min-w-0 w-full rounded-xl lg:min-h-[28rem]"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-wide text-muted uppercase">
            {product.category.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-3 text-xl font-medium text-ink">
            {formatAud(product.price)}
          </p>
          <p className="mt-2 text-xs text-muted">SKU {product.sku}</p>
          <p
            className={`mt-4 text-sm font-medium ${
              inStock ? 'text-stock' : 'text-muted'
            }`}
          >
            {inStock ? 'In stock' : 'Out of stock'}
          </p>
          <p className="mt-6 max-w-prose text-sm leading-7 text-muted">
            {product.description}
          </p>

          <div className="mt-8 max-w-xs">
            <label htmlFor="quantity" className="text-sm font-medium text-ink">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              min={1}
              max={maxQuantity}
              value={quantity}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10)
                if (Number.isInteger(next) && next >= 1 && next <= maxQuantity) {
                  setQuantity(next)
                }
              }}
              className="input-field mt-1.5"
              disabled={!inStock}
            />
          </div>

          <button
            type="button"
            className="btn-primary mt-6"
            disabled={!inStock || adding || authStatus !== 'ready'}
            onClick={() => void handleAddToCart()}
          >
            {adding ? 'Adding…' : inStock ? 'Add to cart' : 'Out of stock'}
          </button>
          {addError ? (
            <p className="mt-3 max-w-sm text-sm text-ink" role="alert">
              {addError}
            </p>
          ) : (
            <p className="mt-3 max-w-sm text-sm text-muted">
              {user
                ? 'You can keep shopping after adding an item.'
                : 'Sign in to add this product to your cart.'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
