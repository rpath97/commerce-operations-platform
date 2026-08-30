import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listCategories, listProducts } from '../api/catalogue.ts'
import { ProductGrid } from '../components/catalogue/ProductGrid.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { ErrorState } from '../components/ui/ErrorState.tsx'
import { Pagination } from '../components/ui/Pagination.tsx'
import { ProductGridSkeleton } from '../components/ui/Skeletons.tsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { isRequestAborted } from '../lib/http.ts'
import {
  parseShopQuery,
  toShopSearchParams,
  shopPath,
  SORT_LABELS,
  PRODUCT_SORTS,
} from '../lib/shopQuery.ts'
import type {
  Category,
  Pagination as PaginationMeta,
  Product,
  ProductSort,
} from '../types/catalogue.ts'

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => parseShopQuery(searchParams), [searchParams])
  useDocumentTitle(
    query.category ? `Shop · ${query.category} | CommerceOps` : 'Shop | CommerceOps',
  )

  const [products, setProducts] = useState<Product[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [searchDraft, setSearchDraft] = useState(query.search ?? '')

  useEffect(() => {
    setSearchDraft(query.search ?? '')
  }, [query.search])

  const loadProducts = useCallback(
    (signal?: AbortSignal) => {
      setStatus('loading')
      listProducts(
        {
          page: query.page,
          limit: 12,
          sort: query.sort,
          category: query.category,
          search: query.search,
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
          setStatus('error')
        })
    },
    [query.page, query.sort, query.category, query.search],
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

  function updateQuery(next: Partial<typeof query>, resetPage = false) {
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
    updateQuery({ search: search.length > 0 ? search : undefined }, true)
  }

  const activeCategoryName = categories.find(
    (category) => category.slug === query.category,
  )?.name

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

      <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <form
          onSubmit={handleSearch}
          className="flex w-full min-w-0 max-w-md flex-col gap-2 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="product-search" className="text-sm font-medium text-ink">
              Search
            </label>
            <input
              id="product-search"
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Name, description, or SKU"
              className="input-field mt-1.5"
            />
          </div>
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>

        <div className="w-full min-w-0 max-w-xs">
          <label htmlFor="product-sort" className="text-sm font-medium text-ink">
            Sort
          </label>
          <select
            id="product-sort"
            className="input-field mt-1.5"
            value={query.sort}
            onChange={(event) =>
              updateQuery({ sort: event.target.value as ProductSort }, true)
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

      {categories.length > 0 ? (
        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Categories">
          <li>
            <Link
              to={shopPath({ ...query, category: undefined, page: 1 })}
              className={`chip ${query.category ? '' : 'chip-active'}`}
              aria-current={query.category ? undefined : 'page'}
            >
              All
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
                className={`chip ${
                  query.category === category.slug ? 'chip-active' : ''
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
      ) : null}

      <div className="mt-8">
        {status === 'loading' ? <ProductGridSkeleton /> : null}
        {status === 'error' ? (
          <ErrorState
            message="We couldn't load products right now."
            onRetry={() => loadProducts()}
          />
        ) : null}
        {status === 'ready' && products.length === 0 ? (
          <EmptyState
            title="No products match your current selection."
            message="Try another category, clear search, or browse the full catalogue."
            action={{ to: '/shop', label: 'Clear filters' }}
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
                onPageChange={(page) => updateQuery({ page })}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
