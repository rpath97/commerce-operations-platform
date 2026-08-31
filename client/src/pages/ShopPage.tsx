import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listCategories, listProducts } from '../api/catalogue.ts'
import { ActiveFilterChips, buildFilterChips } from '../components/catalogue/ActiveFilterChips.tsx'
import { ProductGrid } from '../components/catalogue/ProductGrid.tsx'
import { ShopFilters } from '../components/catalogue/ShopFilters.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { ErrorState } from '../components/ui/ErrorState.tsx'
import { Pagination } from '../components/ui/Pagination.tsx'
import { ProductGridSkeleton } from '../components/ui/Skeletons.tsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { isRequestAborted } from '../lib/http.ts'
import {
  clearShopFilters,
  hasActiveFilters,
  parseShopQuery,
  toShopSearchParams,
  shopPriceRangeError,
  SORT_LABELS,
  PRODUCT_SORTS,
} from '../lib/shopQuery.ts'
import type {
  Category,
  Pagination as PaginationMeta,
  Product,
  ProductSort,
} from '../types/catalogue.ts'
import axios from 'axios'

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => parseShopQuery(searchParams), [searchParams])
  const priceRangeError = shopPriceRangeError(query)
  useDocumentTitle(
    query.search
      ? `Search · ${query.search} | CommerceOps`
      : query.category
        ? `Shop · ${query.category} | CommerceOps`
        : 'Shop | CommerceOps',
  )

  const [products, setProducts] = useState<Product[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState(
    "We couldn't load products right now.",
  )
  const [searchDraft, setSearchDraft] = useState(query.search ?? '')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    setSearchDraft(query.search ?? '')
  }, [query.search])

  const loadProducts = useCallback(
    (signal?: AbortSignal) => {
      if (priceRangeError) {
        setProducts([])
        setPagination(null)
        setStatus('ready')
        return
      }

      setStatus('loading')
      listProducts(
        {
          page: query.page,
          limit: 12,
          sort: query.sort,
          category: query.category,
          search: query.search,
          minPrice: query.minPrice,
          maxPrice: query.maxPrice,
          inStock: query.inStock,
        },
        signal,
      )
        .then((result) => {
          setProducts(result.data)
          setPagination(result.pagination)
          setStatus('ready')
        })
        .catch((error: unknown) => {
          if (isRequestAborted(error) || signal?.aborted) {
            return
          }
          setLoadError(
            axios.isAxiosError(error) && error.response?.status === 400
              ? 'Those filters could not be applied. Check the values and try again.'
              : "We couldn't load products right now.",
          )
          setStatus('error')
        })
    },
    [
      query.page,
      query.sort,
      query.category,
      query.search,
      query.minPrice,
      query.maxPrice,
      query.inStock,
      priceRangeError,
    ],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadProducts(controller.signal)
    return () => controller.abort()
  }, [loadProducts])

  useEffect(() => {
    const controller = new AbortController()
    listCategories(controller.signal)
      .then(setCategories)
      .catch(() => {
        if (!controller.signal.aborted) {
          setCategories([])
        }
      })
    return () => controller.abort()
  }, [])

  function updateQuery(next: Partial<typeof query>, resetPage = true) {
    const merged = {
      ...query,
      ...next,
      page: resetPage ? 1 : (next.page ?? query.page),
    }
    setSearchParams(toShopSearchParams(merged))
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const search = searchDraft.trim()
    updateQuery({ search: search.length > 0 ? search : undefined })
  }

  const activeCategoryName = categories.find(
    (category) => category.slug === query.category,
  )?.name

  const chips = buildFilterChips(query, activeCategoryName, (next) =>
    updateQuery(next),
  )
  const filtersActive = hasActiveFilters(query)

  const resultLabel = pagination
    ? formatResultSummary(pagination, query.search)
    : null

  return (
    <section className="page-wrap min-w-0 py-10 sm:py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Shop</h1>
        <p className="mt-2 text-sm text-muted">
          {activeCategoryName
            ? `Showing the ${activeCategoryName} range.`
            : 'Browse the full catalogue.'}
        </p>
      </header>

      <div className="mt-8 min-w-0 lg:grid lg:grid-cols-[minmax(0,16.5rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="lg:hidden">
          <button
            type="button"
            className="btn-secondary min-h-11 w-full"
            aria-expanded={filtersOpen}
            aria-controls="shop-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            {filtersOpen ? 'Hide filters' : 'Filters'}
          </button>
        </div>

        <aside
          id="shop-filters"
          className={`mt-4 min-w-0 rounded-2xl border border-line bg-paper p-5 lg:mt-0 ${
            filtersOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          <h2 className="text-base font-semibold text-ink">Filters</h2>
          <div className="mt-6">
            <ShopFilters
              query={query}
              categories={categories}
              onApply={(next) => updateQuery(next)}
            />
          </div>
        </aside>

        <div className="mt-8 min-w-0 lg:mt-0">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <form
              onSubmit={handleSearch}
              className="flex w-full min-w-0 max-w-md flex-col gap-2 sm:flex-row sm:items-end"
            >
              <div className="min-w-0 flex-1">
                <label htmlFor="product-search" className="text-sm font-medium text-ink">
                  Search
                </label>
                <div className="mt-1.5 flex min-w-0 gap-2">
                  <input
                    id="product-search"
                    type="search"
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder="Name, description, or SKU"
                    className="input-field min-h-11 min-w-0 flex-1"
                  />
                  {searchDraft || query.search ? (
                    <button
                      type="button"
                      className="btn-secondary min-h-11 shrink-0"
                      onClick={() => {
                        setSearchDraft('')
                        updateQuery({ search: undefined })
                      }}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
              <button type="submit" className="btn-secondary min-h-11">
                Search
              </button>
            </form>

            <div className="w-full min-w-0 max-w-xs">
              <label htmlFor="product-sort" className="text-sm font-medium text-ink">
                Sort
              </label>
              <select
                id="product-sort"
                className="input-field mt-1.5 min-h-11"
                value={query.sort}
                onChange={(event) =>
                  updateQuery({ sort: event.target.value as ProductSort })
                }
              >
                {PRODUCT_SORTS.map((sort) => (
                  <option key={sort} value={sort}>
                    {SORT_LABELS[sort]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <ActiveFilterChips
              chips={chips}
              onClearAll={() => updateQuery(clearShopFilters(query))}
            />
            {priceRangeError ? (
              <p className="text-sm text-brand" role="alert">
                {priceRangeError}
              </p>
            ) : null}
            {resultLabel && status === 'ready' && !priceRangeError ? (
              <p className="text-sm text-muted">{resultLabel}</p>
            ) : null}
          </div>

          <div className="mt-6">
            {status === 'loading' ? <ProductGridSkeleton /> : null}
            {status === 'error' ? (
              <ErrorState
                message={loadError}
                onRetry={() => loadProducts()}
              />
            ) : null}
            {status === 'ready' && products.length === 0 && !priceRangeError ? (
              <EmptyState
                title="No products match your filters"
                message="Try a different search, category, or price range."
                action={
                  filtersActive
                    ? {
                        label: 'Clear filters',
                        onClick: () => updateQuery(clearShopFilters(query)),
                      }
                    : { label: 'Browse all products', to: '/shop' }
                }
              />
            ) : null}
            {status === 'ready' && products.length > 0 ? (
              <>
                <ProductGrid products={products} />
                {pagination ? (
                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    total={pagination.total}
                    onPageChange={(page) => updateQuery({ page }, false)}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function formatResultSummary(
  pagination: PaginationMeta,
  search?: string,
): string {
  if (pagination.total === 0) {
    return search ? `0 results for “${search}”` : '0 products'
  }

  const start = (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.total)
  const range = `Showing ${start}–${end} of ${pagination.total}`
  return search ? `${range} for “${search}”` : range
}
