import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'
import { useCart } from '../cart/useCart.ts'
import { formatAud } from '../../lib/formatPrice.ts'
import { loginPath } from '../../lib/returnPath.ts'
import type { Product } from '../../types/catalogue.ts'
import { ProductVisual } from './ProductVisual.tsx'

type ProductCardProps = {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const inStock = product.inventory.inStock
  const { user, status: authStatus } = useAuth()
  const { addItem, pendingKeys } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [actionError, setActionError] = useState<string | null>(null)
  const adding = pendingKeys.includes(`add:${product.id}`)

  async function handleAdd() {
    setActionError(null)

    if (authStatus !== 'ready') {
      return
    }

    if (!user) {
      navigate(loginPath(`${location.pathname}${location.search}`))
      return
    }

    try {
      await addItem(product.id, 1)
    } catch (caught: unknown) {
      setActionError(
        caught instanceof Error ? caught.message : 'Unable to add to cart.',
      )
    }
  }

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-sm transition hover:border-brand/25 hover:shadow-md">
      <Link
        to={`/products/${product.slug}`}
        className="block min-w-0 overflow-hidden focus-visible:outline-none"
      >
        <ProductVisual
          categorySlug={product.category.slug}
          categoryName={product.category.name}
          productName={product.name}
          className="aspect-[4/3]"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          {product.category.name}
        </p>
        <h3 className="mt-1 text-base font-semibold break-words text-ink">
          <Link
            to={`/products/${product.slug}`}
            className="rounded-sm hover:underline"
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-2 text-sm font-medium text-ink">
          {formatAud(product.price)}
        </p>
        <p
          className={`mt-2 text-xs font-medium ${
            inStock ? 'text-stock' : 'text-muted'
          }`}
        >
          {inStock ? 'In stock' : 'Out of stock'}
        </p>
        {actionError ? (
          <p className="mt-2 text-xs text-ink" role="alert">
            {actionError}
          </p>
        ) : null}
        <div className="mt-auto flex min-w-0 flex-col gap-2 pt-4">
          <button
            type="button"
            className="btn-primary w-full justify-center"
            disabled={!inStock || adding || authStatus !== 'ready'}
            onClick={() => void handleAdd()}
          >
            {adding ? 'Adding…' : inStock ? 'Add to cart' : 'Out of stock'}
          </button>
          <Link
            to={`/products/${product.slug}`}
            className="btn-secondary w-full justify-center"
          >
            View product
          </Link>
        </div>
      </div>
    </article>
  )
}
