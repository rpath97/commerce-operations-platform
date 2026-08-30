import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { describeMoneyInput, describePriceRange } from '../../lib/moneyInput.ts'
import { shopPath, type ShopQuery } from '../../lib/shopQuery.ts'
import type { Category } from '../../types/catalogue.ts'

type ShopFiltersProps = {
  query: ShopQuery
  categories: Category[]
  onApply: (next: Partial<ShopQuery>) => void
}

export function ShopFilters({ query, categories, onApply }: ShopFiltersProps) {
  const [minDraft, setMinDraft] = useState(query.minPrice ?? '')
  const [maxDraft, setMaxDraft] = useState(query.maxPrice ?? '')
  const [priceError, setPriceError] = useState<string | undefined>()

  useEffect(() => {
    setMinDraft(query.minPrice ?? '')
    setMaxDraft(query.maxPrice ?? '')
    setPriceError(describePriceRange(query.minPrice, query.maxPrice))
  }, [query.minPrice, query.maxPrice])

  function handlePriceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const minMessage = describeMoneyInput(minDraft)
    const maxMessage = describeMoneyInput(maxDraft)
    if (minMessage || maxMessage) {
      setPriceError(minMessage ?? maxMessage)
      return
    }

    const minPrice = minDraft.trim() || undefined
    const maxPrice = maxDraft.trim() || undefined
    const rangeMessage = describePriceRange(minPrice, maxPrice)
    if (rangeMessage) {
      setPriceError(rangeMessage)
      return
    }

    setPriceError(undefined)
    onApply({ minPrice, maxPrice })
  }

  return (
    <div className="min-w-0 space-y-8">
      <fieldset className="min-w-0">
        <legend className="text-sm font-semibold text-ink">Category</legend>
        <ul className="mt-3 space-y-1">
          <li>
            <Link
              to={shopPath({ ...query, category: undefined, page: 1 })}
              className={`block rounded-md px-3 py-2.5 text-sm ${
                query.category
                  ? 'text-ink/80 hover:bg-stone-100'
                  : 'bg-stone-100 font-medium text-brand'
              }`}
              aria-current={query.category ? undefined : 'page'}
            >
              All products
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                to={shopPath({
                  ...query,
                  category: category.slug,
                  page: 1,
                })}
                className={`block rounded-md px-3 py-2.5 text-sm ${
                  query.category === category.slug
                    ? 'bg-stone-100 font-medium text-brand'
                    : 'text-ink/80 hover:bg-stone-100'
                }`}
                aria-current={
                  query.category === category.slug ? 'page' : undefined
                }
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </fieldset>

      <form onSubmit={handlePriceSubmit} className="min-w-0">
        <fieldset className="min-w-0">
          <legend className="text-sm font-semibold text-ink">Price (A$)</legend>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label htmlFor="min-price" className="text-xs font-medium text-muted">
                Minimum
              </label>
              <input
                id="min-price"
                inputMode="decimal"
                autoComplete="off"
                value={minDraft}
                onChange={(event) => setMinDraft(event.target.value)}
                placeholder="0"
                className="input-field mt-1.5 min-h-11 min-w-0"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="max-price" className="text-xs font-medium text-muted">
                Maximum
              </label>
              <input
                id="max-price"
                inputMode="decimal"
                autoComplete="off"
                value={maxDraft}
                onChange={(event) => setMaxDraft(event.target.value)}
                placeholder="Any"
                className="input-field mt-1.5 min-h-11 min-w-0"
              />
            </div>
          </div>
          {priceError ? (
            <p className="mt-2 break-words text-sm text-brand" role="alert">
              {priceError}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Use whole dollars or two decimal places. Apply to update results.
            </p>
          )}
          <button type="submit" className="btn-secondary mt-3 min-h-11 w-full">
            Apply price
          </button>
        </fieldset>
      </form>

      <fieldset className="min-w-0">
        <legend className="text-sm font-semibold text-ink">Availability</legend>
        <div className="mt-3 space-y-2">
          {(
            [
              { value: 'all', label: 'All' },
              { value: 'true', label: 'In stock' },
              { value: 'false', label: 'Out of stock' },
            ] as const
          ).map((option) => {
            const checked =
              option.value === 'all'
                ? query.inStock === undefined
                : option.value === 'true'
                  ? query.inStock === true
                  : query.inStock === false

            return (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1 text-sm text-ink"
              >
                <input
                  type="radio"
                  name="in-stock-filter"
                  checked={checked}
                  onChange={() =>
                    onApply({
                      inStock:
                        option.value === 'all'
                          ? undefined
                          : option.value === 'true',
                    })
                  }
                />
                {option.label}
              </label>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
