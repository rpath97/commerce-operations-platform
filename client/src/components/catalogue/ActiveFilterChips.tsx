import { formatAud } from '../../lib/formatPrice.ts'
import { type ShopQuery } from '../../lib/shopQuery.ts'

type FilterChip = {
  key: string
  label: string
  onRemove: () => void
}

type ActiveFilterChipsProps = {
  chips: FilterChip[]
  onClearAll: () => void
}

export function ActiveFilterChips({ chips, onClearAll }: ActiveFilterChipsProps) {
  if (chips.length === 0) {
    return null
  }

  return (
    <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
      <p className="sr-only">Active filters</p>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="chip max-w-full min-h-11 min-w-0 gap-2"
          onClick={chip.onRemove}
        >
          <span className="min-w-0 truncate">{chip.label}</span>
          <span aria-hidden="true" className="text-muted">
            ×
          </span>
          <span className="sr-only">Remove {chip.label}</span>
        </button>
      ))}
      <button type="button" className="text-sm font-medium text-brand" onClick={onClearAll}>
        Clear all filters
      </button>
    </div>
  )
}

export function buildFilterChips(
  query: ShopQuery,
  categoryName: string | undefined,
  remove: (next: Partial<ShopQuery>) => void,
): FilterChip[] {
  const chips: FilterChip[] = []

  if (query.search) {
    chips.push({
      key: 'search',
      label: `Search: ${query.search}`,
      onRemove: () => remove({ search: undefined }),
    })
  }
  if (query.category) {
    chips.push({
      key: 'category',
      label: categoryName ?? query.category,
      onRemove: () => remove({ category: undefined }),
    })
  }
  if (query.minPrice) {
    chips.push({
      key: 'minPrice',
      label: `${formatAud(query.minPrice)} minimum`,
      onRemove: () => remove({ minPrice: undefined }),
    })
  }
  if (query.maxPrice) {
    chips.push({
      key: 'maxPrice',
      label: `${formatAud(query.maxPrice)} maximum`,
      onRemove: () => remove({ maxPrice: undefined }),
    })
  }
  if (query.inStock === true) {
    chips.push({
      key: 'inStock',
      label: 'In stock',
      onRemove: () => remove({ inStock: undefined }),
    })
  }
  if (query.inStock === false) {
    chips.push({
      key: 'outOfStock',
      label: 'Out of stock',
      onRemove: () => remove({ inStock: undefined }),
    })
  }

  return chips
}
