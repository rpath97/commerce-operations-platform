import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listAdminPromotions } from '../../api/adminPromotions.ts'
import { PromotionStatusBadge } from '../../components/admin/PromotionStatusBadge.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { Pagination } from '../../components/ui/Pagination.tsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { formatDateTime } from '../../lib/datetimeLocal.ts'
import { formatAud } from '../../lib/formatPrice.ts'
import { isRequestAborted } from '../../lib/http.ts'
import { formatDiscountLabel } from '../../lib/promotionStatus.ts'
import type {
  AdminPromotion,
  PromotionDiscountFilter,
  PromotionSort,
  PromotionStatusFilter,
} from '../../types/promotion.ts'

export function AdminPromotionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const search = searchParams.get('search') ?? ''
  const statusFilter = (searchParams.get('status') ?? 'all') as PromotionStatusFilter
  const discountType = (searchParams.get('discountType') ??
    'all') as PromotionDiscountFilter
  const sort = (searchParams.get('sort') ?? 'newest') as PromotionSort

  const [promotions, setPromotions] = useState<AdminPromotion[]>([])
  const [summary, setSummary] = useState({
    active: 0,
    upcoming: 0,
    expired: 0,
    disabled: 0,
  })
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [searchDraft, setSearchDraft] = useState(search)

  useDocumentTitle('Promotions | Admin | Noryx')

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus('loading')
      listAdminPromotions(
        {
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter,
          discountType,
          sort,
        },
        signal,
      )
        .then((result) => {
          setPromotions(result.data)
          setSummary(result.summary)
          setTotal(result.pagination.total)
          setTotalPages(result.pagination.totalPages)
          setStatus('ready')
        })
        .catch((error: unknown) => {
          if (isRequestAborted(error)) {
            return
          }
          setStatus('error')
        })
    },
    [page, search, statusFilter, discountType, sort],
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

  return (
    <section className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-wide text-muted uppercase">
            Promotions
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
            Promotions
          </h1>
        </div>
        <Link to="/admin/promotions/new" className="btn-primary">
          Create promotion
        </Link>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Active', value: summary.active },
          { label: 'Upcoming', value: summary.upcoming },
          { label: 'Expired', value: summary.expired },
          { label: 'Disabled', value: summary.disabled },
        ].map((item) => (
          <li
            key={item.label}
            className="min-w-0 rounded-lg border border-line bg-paper px-4 py-3"
          >
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              {item.label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
              {item.value}
            </p>
          </li>
        ))}
      </ul>

      <form
        className="mt-6 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault()
          updateParams({ search: searchDraft.trim(), page: '' })
        }}
      >
        <div className="min-w-0">
          <label htmlFor="admin-promo-search" className="text-sm font-medium">
            Search
          </label>
          <input
            id="admin-promo-search"
            className="input-field mt-1.5"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="admin-promo-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="admin-promo-status"
            className="input-field mt-1.5"
            value={statusFilter}
            onChange={(event) =>
              updateParams({ status: event.target.value, page: '' })
            }
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="expired">Expired</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div>
          <label htmlFor="admin-promo-type" className="text-sm font-medium">
            Discount type
          </label>
          <select
            id="admin-promo-type"
            className="input-field mt-1.5"
            value={discountType}
            onChange={(event) =>
              updateParams({ discountType: event.target.value, page: '' })
            }
          >
            <option value="all">All</option>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </div>
        <div>
          <label htmlFor="admin-promo-sort" className="text-sm font-medium">
            Sort
          </label>
          <select
            id="admin-promo-sort"
            className="input-field mt-1.5"
            value={sort}
            onChange={(event) =>
              updateParams({ sort: event.target.value, page: '' })
            }
          >
            <option value="newest">Newest</option>
            <option value="code-asc">Code A–Z</option>
            <option value="code-desc">Code Z–A</option>
            <option value="starts-soonest">Starts soonest</option>
            <option value="ends-soonest">Ends soonest</option>
          </select>
        </div>
      </form>

      {status === 'loading' ? (
        <p className="mt-8 text-sm text-muted">Loading promotions…</p>
      ) : null}

      {status === 'error' ? (
        <div className="mt-8">
          <ErrorState
            message="We could not load promotions."
            onRetry={() => load()}
          />
        </div>
      ) : null}

      {status === 'ready' && promotions.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No promotions"
            message="No promotions match these filters."
          />
        </div>
      ) : null}

      {status === 'ready' && promotions.length > 0 ? (
        <>
          <ul className="mt-8 grid gap-3 xl:hidden">
            {promotions.map((promotion) => (
              <li
                key={promotion.id}
                className="min-w-0 rounded-lg border border-line bg-paper p-4"
              >
                <p className="break-all font-medium text-ink">{promotion.code}</p>
                {promotion.description ? (
                  <p className="mt-1 break-words text-sm text-muted">
                    {promotion.description}
                  </p>
                ) : null}
                <p className="mt-2 text-sm">
                  {formatDiscountLabel(promotion.discountType, promotion.discountValue)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Minimum{' '}
                  {promotion.minimumOrderValue
                    ? formatAud(promotion.minimumOrderValue)
                    : 'None'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {formatDateTime(promotion.startsAt)} –{' '}
                  {formatDateTime(promotion.endsAt)}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  <PromotionStatusBadge status={promotion.status} />
                  <span className="chip">
                    {promotion.isActive ? 'Enabled' : 'Disabled'}
                  </span>
                </p>
                <Link
                  to={`/admin/promotions/${promotion.id}/edit`}
                  className="btn-secondary mt-4 inline-flex"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden min-w-0 overflow-x-auto xl:block">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-3 pr-4 font-medium">Code</th>
                  <th className="py-3 pr-4 font-medium">Description</th>
                  <th className="py-3 pr-4 font-medium">Discount</th>
                  <th className="py-3 pr-4 font-medium">Minimum order</th>
                  <th className="py-3 pr-4 font-medium">Start</th>
                  <th className="py-3 pr-4 font-medium">End</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Enabled</th>
                  <th className="py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((promotion) => (
                  <tr key={promotion.id} className="border-b border-line">
                    <td className="max-w-[10rem] py-3 pr-4 break-all font-medium">
                      {promotion.code}
                    </td>
                    <td className="max-w-[14rem] py-3 pr-4 break-words text-muted">
                      {promotion.description ?? '—'}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatDiscountLabel(
                        promotion.discountType,
                        promotion.discountValue,
                      )}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {promotion.minimumOrderValue
                        ? formatAud(promotion.minimumOrderValue)
                        : 'None'}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatDateTime(promotion.startsAt)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatDateTime(promotion.endsAt)}
                    </td>
                    <td className="py-3 pr-4">
                      <PromotionStatusBadge status={promotion.status} />
                    </td>
                    <td className="py-3 pr-4">
                      {promotion.isActive ? 'Enabled' : 'Disabled'}
                    </td>
                    <td className="py-3">
                      <Link
                        to={`/admin/promotions/${promotion.id}/edit`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            itemName="promotions"
            onPageChange={(nextPage) =>
              updateParams({ page: nextPage > 1 ? String(nextPage) : '' })
            }
          />
        </>
      ) : null}
    </section>
  )
}
