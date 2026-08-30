import { Link } from 'react-router-dom'
import { formatAud } from '../../lib/formatPrice.ts'
import type { Product } from '../../types/catalogue.ts'
import { ProductVisual } from './ProductVisual.tsx'

type ProductCardProps = {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const inStock = product.inventory.inStock

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-sm transition hover:border-brand/25 hover:shadow-md">
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
        <div className="mt-auto pt-4">
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
