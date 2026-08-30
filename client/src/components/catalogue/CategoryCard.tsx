import { Link } from 'react-router-dom'
import { shopPath } from '../../lib/shopQuery.ts'
import type { Category } from '../../types/catalogue.ts'
import { ProductVisual } from './ProductVisual.tsx'

type CategoryCardProps = {
  category: Category
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      to={shopPath({
        category: category.slug,
        page: 1,
        sort: 'newest',
      })}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-sm transition hover:border-brand/25 hover:shadow-md"
    >
      <ProductVisual
        categorySlug={category.slug}
        categoryName={category.name}
        productName={category.name}
        className="h-40"
      />
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold text-ink group-hover:underline">
          {category.name}
        </h3>
        {category.description ? (
          <p className="mt-2 line-clamp-3 text-sm text-muted">
            {category.description}
          </p>
        ) : null}
        <p className="mt-4 text-sm font-medium text-brand">Shop this range</p>
      </div>
    </Link>
  )
}
