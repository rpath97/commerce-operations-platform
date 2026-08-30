import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listAdminCategories } from '../../api/adminCategories.ts'
import {
  archiveAdminProduct,
  listAdminProducts,
  updateAdminProduct,
} from '../../api/adminProducts.ts'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { Pagination } from '../../components/ui/Pagination.tsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { formatAud } from '../../lib/formatPrice.ts'
import { getApiErrorMessage, isRequestAborted } from '../../lib/http.ts'
import type {
  AdminCategory,
  AdminProduct,
  AdminProductStatusFilter,
} from '../../types/admin.ts'

function inventoryLabel(product: AdminProduct): string {
  if (!product.inventory.inStock) {
    return '0 in stock'
  }
  if (product.inventory.isLowStock) {
    return `${product.inventory.quantity} in stock · Low stock`
  }
  return `${product.inventory.quantity} in stock`
}

export function AdminProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const search = searchParams.get('search') ?? ''
  const statusFilter = (searchParams.get('status') ?? 'all') as AdminProductStatusFilter
  const category = searchParams.get('category') ?? ''

  const [products, setProducts] = useState<AdminProduct[]>([])
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [searchDraft, setSearchDraft] = useState(search)
  const [archiveTarget, setArchiveTarget] = useState<AdminProduct | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useDocumentTitle('Admin products | CommerceOps')

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus('loading')
      Promise.all([
        listAdminProducts(
          {
            page,
            limit: 20,
            search: search || undefined,
            status: statusFilter,
            category: category || undefined,
            sort: 'newest',
          },
          signal,
        ),
        listAdminCategories(signal),
      ])
        .then(([result, nextCategories]) => {
          setProducts(result.data)
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
    [page, search, statusFilter, category],
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

  async function restoreProduct(product: AdminProduct) {
    setBusyId(product.id)
    setNotice(null)
    try {
      await updateAdminProduct(product.id, { isActive: true })
      setNotice(`${product.name} was restored.`)
      load()
    } catch (error: unknown) {
      setNotice(getApiErrorMessage(error, 'Unable to restore this product.'))
    } finally {
      setBusyId(null)
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) {
      return
    }
    setBusyId(archiveTarget.id)
    try {
      await archiveAdminProduct(archiveTarget.id)
      setNotice(`${archiveTarget.name} was archived.`)
      setArchiveTarget(null)
      load()
    } catch (error: unknown) {
      setNotice(getApiErrorMessage(error, 'Unable to archive this product.'))
      setArchiveTarget(null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-wide text-muted uppercase">
            Catalogue
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
            Products
          </h1>
        </div>
        <Link to="/admin/products/new" className="btn-primary">
          Add product
        </Link>
      </div>

      <form
        className="mt-6 grid min-w-0 gap-3 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault()
          updateParams({ search: searchDraft.trim(), page: '' })
        }}
      >
        <div className="min-w-0">
          <label htmlFor="admin-product-search" className="text-sm font-medium">
            Search
          </label>
          <input
            id="admin-product-search"
            className="input-field mt-1.5"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="admin-product-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="admin-product-status"
            className="input-field mt-1.5"
            value={statusFilter}
            onChange={(event) =>
              updateParams({ status: event.target.value, page: '' })
            }
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label htmlFor="admin-product-category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="admin-product-category"
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
      </form>

      {notice ? (
        <p className="mt-4 text-sm text-muted" aria-live="polite">
          {notice}
        </p>
      ) : null}

      {status === 'loading' ? (
        <p className="mt-8 text-sm text-muted">Loading products…</p>
      ) : null}

      {status === 'error' ? (
        <div className="mt-8">
          <ErrorState
            message="We could not load products."
            onRetry={() => load()}
          />
        </div>
      ) : null}

      {status === 'ready' && products.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No products"
            message="No products match these filters."
          />
        </div>
      ) : null}

      {status === 'ready' && products.length > 0 ? (
        <>
          <ul className="mt-8 grid gap-3 xl:hidden">
            {products.map((product) => (
              <li
                key={product.id}
                className="min-w-0 rounded-2xl border border-line bg-paper p-4"
              >
                <p className="break-words font-medium text-ink">{product.name}</p>
                <p className="mt-1 break-all text-sm text-muted">{product.sku}</p>
                <p className="mt-1 text-sm text-muted">{product.category.name}</p>
                <p className="mt-2 text-sm">{formatAud(product.price)}</p>
                <p className="mt-1 text-sm text-muted">{inventoryLabel(product)}</p>
                <p className="mt-2">
                  <span className="chip">
                    {product.isActive ? 'Active' : 'Archived'}
                  </span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/admin/products/${product.id}/edit`}
                    className="btn-secondary"
                  >
                    Edit
                  </Link>
                  {product.isActive ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setArchiveTarget(product)}
                      disabled={busyId === product.id}
                    >
                      Archive
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void restoreProduct(product)}
                      disabled={busyId === product.id}
                    >
                      Restore
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-3 pr-4 font-medium">Product</th>
                  <th className="py-3 pr-4 font-medium">SKU</th>
                  <th className="py-3 pr-4 font-medium">Category</th>
                  <th className="py-3 pr-4 font-medium">Price</th>
                  <th className="py-3 pr-4 font-medium">Inventory</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-line align-top">
                    <td className="max-w-xs py-3 pr-4 font-medium break-words">
                      {product.name}
                    </td>
                    <td className="max-w-[10rem] py-3 pr-4 break-all">
                      {product.sku}
                    </td>
                    <td className="py-3 pr-4">{product.category.name}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatAud(product.price)}
                    </td>
                    <td className="py-3 pr-4">{inventoryLabel(product)}</td>
                    <td className="py-3 pr-4">
                      <span className="chip">
                        {product.isActive ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/admin/products/${product.id}/edit`}
                          className="font-medium text-brand"
                        >
                          Edit
                        </Link>
                        {product.isActive ? (
                          <button
                            type="button"
                            className="font-medium text-brand"
                            onClick={() => setArchiveTarget(product)}
                            disabled={busyId === product.id}
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="font-medium text-brand"
                            onClick={() => void restoreProduct(product)}
                            disabled={busyId === product.id}
                          >
                            Restore
                          </button>
                        )}
                      </div>
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

      {archiveTarget ? (
        <ConfirmDialog
          title="Archive this product?"
          message="Archived products are hidden from the storefront. They can be restored later."
          confirmLabel="Archive product"
          cancelLabel="Keep product"
          busy={busyId === archiveTarget.id}
          onConfirm={() => void confirmArchive()}
          onCancel={() => setArchiveTarget(null)}
        />
      ) : null}
    </section>
  )
}
