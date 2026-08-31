import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listAdminCategories } from '../../api/adminCategories.ts'
import { listAdminInventory } from '../../api/adminInventory.ts'
import { StockStatusBadge } from '../../components/admin/StockStatusBadge.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { Pagination } from '../../components/ui/Pagination.tsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { isRequestAborted } from '../../lib/http.ts'
import type { AdminCategory } from '../../types/admin.ts'
import type {
  InventoryListItem,
  InventoryProductStatus,
  InventorySort,
  InventoryStockFilter,
  InventorySummary,
} from '../../types/inventory.ts'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AdminInventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const search = searchParams.get('search') ?? ''
  const stockStatus = (searchParams.get('stockStatus') ?? 'all') as InventoryStockFilter
  const productStatus = (searchParams.get('productStatus') ?? 'all') as InventoryProductStatus
  const category = searchParams.get('category') ?? ''
  const sort = (searchParams.get('sort') ?? 'updated-desc') as InventorySort

  const [items, setItems] = useState<InventoryListItem[]>([])
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [searchDraft, setSearchDraft] = useState(search)

  useDocumentTitle('Inventory | CommerceOps')

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus('loading')
      Promise.all([
        listAdminInventory(
          {
            page,
            limit: 20,
            search: search || undefined,
            category: category || undefined,
            stockStatus,
            productStatus,
            sort,
          },
          signal,
        ),
        listAdminCategories(signal),
      ])
        .then(([result, nextCategories]) => {
          setItems(result.data)
          setSummary(result.summary)
          setTotal(result.pagination.total)
          setTotalPages(result.pagination.totalPages)
          setCategories(nextCategories)
          setStatus('ready')
        })
        .catch((error: unknown) => {
          if (isRequestAborted(error)) {
            return
          }
          setStatus('error')
        })
    },
    [page, search, category, stockStatus, productStatus, sort],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    setSearchDraft(search)
  }, [search])

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(next)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    if (!next.page) {
      params.delete('page')
    }
    setSearchParams(params)
  }

  const cards = summary
    ? [
        { label: 'Total products', value: summary.totalProducts },
        { label: 'Healthy stock', value: summary.healthy },
        { label: 'Low stock', value: summary.lowStock },
        { label: 'Out of stock', value: summary.outOfStock },
      ]
    : []

  return (
    <section className="min-w-0">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        Operations
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        Inventory
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Current stock levels and stock state. Receiving and adjustments are
        recorded in movement history.
      </p>

      {cards.length > 0 ? (
        <ul className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((card) => (
            <li
              key={card.label}
              className="min-w-0 rounded-2xl border border-line bg-paper px-4 py-4"
            >
              <p className="text-sm text-muted">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{card.value}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="mt-8 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault()
          updateParams({ search: searchDraft.trim(), page: '' })
        }}
      >
        <div className="min-w-0">
          <label htmlFor="inv-search" className="text-sm font-medium">
            Search
          </label>
          <input
            id="inv-search"
            className="input-field mt-1.5"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="inv-category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="inv-category"
            className="input-field mt-1.5"
            value={category}
            onChange={(event) =>
              updateParams({ category: event.target.value, page: '' })
            }
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="inv-stock" className="text-sm font-medium">
            Stock status
          </label>
          <select
            id="inv-stock"
            className="input-field mt-1.5"
            value={stockStatus}
            onChange={(event) =>
              updateParams({ stockStatus: event.target.value, page: '' })
            }
          >
            <option value="all">All stock states</option>
            <option value="healthy">Healthy</option>
            <option value="low-stock">Low stock</option>
            <option value="out-of-stock">Out of stock</option>
          </select>
        </div>
        <div>
          <label htmlFor="inv-product" className="text-sm font-medium">
            Product status
          </label>
          <select
            id="inv-product"
            className="input-field mt-1.5"
            value={productStatus}
            onChange={(event) =>
              updateParams({ productStatus: event.target.value, page: '' })
            }
          >
            <option value="all">All products</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label htmlFor="inv-sort" className="text-sm font-medium">
            Sort
          </label>
          <select
            id="inv-sort"
            className="input-field mt-1.5"
            value={sort}
            onChange={(event) =>
              updateParams({ sort: event.target.value, page: '' })
            }
          >
            <option value="updated-desc">Recently updated</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="quantity-asc">Quantity low–high</option>
            <option value="quantity-desc">Quantity high–low</option>
          </select>
        </div>
      </form>

      {status === 'loading' ? (
        <p className="mt-8 text-sm text-muted">Loading inventory…</p>
      ) : null}

      {status === 'error' ? (
        <div className="mt-8">
          <ErrorState
            message="We could not load inventory."
            onRetry={() => load()}
          />
        </div>
      ) : null}

      {status === 'ready' && items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No inventory records"
            message="No products match these inventory filters."
          />
        </div>
      ) : null}

      {status === 'ready' && items.length > 0 ? (
        <>
          <ul className="mt-8 grid gap-3 xl:hidden">
            {items.map((item) => (
              <li
                key={item.product.id}
                className="min-w-0 rounded-2xl border border-line bg-paper p-4"
              >
                <p className="break-words font-medium">{item.product.name}</p>
                <p className="mt-1 break-all text-sm text-muted">{item.product.sku}</p>
                <p className="mt-1 text-sm text-muted">{item.product.category.name}</p>
                <p className="mt-2 text-sm tabular-nums">
                  Quantity {item.inventory.quantity}
                </p>
                <p className="text-sm text-muted">
                  Threshold {item.inventory.lowStockThreshold}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StockStatusBadge status={item.inventory.stockStatus} />
                  <span className="chip">
                    {item.product.isActive ? 'Active' : 'Archived'}
                  </span>
                </div>
                <Link
                  to={`/admin/inventory/${item.product.id}`}
                  className="btn-secondary mt-4 inline-flex"
                >
                  Manage
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-3 pr-4 font-medium">Product</th>
                  <th className="py-3 pr-4 font-medium">SKU</th>
                  <th className="py-3 pr-4 font-medium">Category</th>
                  <th className="py-3 pr-4 font-medium">Quantity</th>
                  <th className="py-3 pr-4 font-medium">Threshold</th>
                  <th className="py-3 pr-4 font-medium">Stock state</th>
                  <th className="py-3 pr-4 font-medium">Product status</th>
                  <th className="py-3 pr-4 font-medium">Last updated</th>
                  <th className="py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.product.id} className="border-b border-line align-top">
                    <td className="max-w-xs py-3 pr-4 font-medium break-words">
                      {item.product.name}
                    </td>
                    <td className="max-w-[10rem] py-3 pr-4 break-all">
                      {item.product.sku}
                    </td>
                    <td className="py-3 pr-4">{item.product.category.name}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {item.inventory.quantity}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {item.inventory.lowStockThreshold}
                    </td>
                    <td className="py-3 pr-4">
                      <StockStatusBadge status={item.inventory.stockStatus} />
                    </td>
                    <td className="py-3 pr-4">
                      <span className="chip">
                        {item.product.isActive ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted">
                      {formatDate(item.inventory.updatedAt)}
                    </td>
                    <td className="py-3">
                      <Link
                        to={`/admin/inventory/${item.product.id}`}
                        className="font-medium text-brand"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={Math.max(1, totalPages)}
            total={total}
            itemName="products"
            onPageChange={(nextPage) =>
              updateParams({ page: String(nextPage) })
            }
          />
        </>
      ) : null}
    </section>
  )
}
