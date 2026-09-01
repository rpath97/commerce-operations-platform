import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getAdminAnalytics } from '../../api/adminAnalytics.ts'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import { formatAud } from '../../lib/formatPrice.ts'
import { isRequestAborted } from '../../lib/http.ts'
import { formatOrderStatus } from '../../lib/orderStatus.ts'
import type { AnalyticsRange, AdminAnalytics } from '../../types/analytics.ts'

const RANGES: Array<{ value: AnalyticsRange; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#b7ff00',
  PAID: '#9cff2e',
  PROCESSING: '#d4ff73',
  SHIPPED: '#f7faf5',
  DELIVERED: '#668f00',
  CANCELLED: '#6f786e',
}

const CHART_GRID = '#202a22'
const CHART_TEXT = '#a7b0a4'
const CHART_BRAND = '#b7ff00'
const CHART_SECONDARY = '#f7faf5'
const CHART_TICK = { fill: CHART_TEXT, fontSize: 12 }
const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: '#0a0f0b',
  border: `1px solid ${CHART_GRID}`,
  borderRadius: 8,
  color: CHART_SECONDARY,
}
const TOOLTIP_LABEL_STYLE = { color: CHART_SECONDARY }
const TOOLTIP_ITEM_STYLE = { color: CHART_SECONDARY }

function parseRange(value: string | null): AnalyticsRange {
  if (value === '7d' || value === '30d' || value === '90d' || value === 'all') {
    return value
  }
  return '30d'
}

function shortDate(value: string): string {
  return value.slice(5)
}

function subscribeMdUp(onChange: () => void) {
  const media = window.matchMedia('(min-width: 768px)')
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function ChartFrame({ children }: { children: ReactNode }) {
  return (
    <div className="h-64 w-full min-w-0 max-w-full sm:h-72">{children}</div>
  )
}

function AnalyticsChart({ children }: { children: ReactNode }) {
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
        {children}
      </ResponsiveContainer>
    </ChartFrame>
  )
}

export function AdminAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const range = parseRange(searchParams.get('range'))
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const isMdUp = useSyncExternalStore(
    subscribeMdUp,
    () => window.matchMedia('(min-width: 768px)').matches,
    () => false,
  )
  const xMinTickGap = isMdUp ? 16 : 32

  useDocumentTitle('Analytics | Admin | Noryx')

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus('loading')
      getAdminAnalytics(range, signal)
        .then((result) => {
          setData(result)
          setStatus('ready')
        })
        .catch((error: unknown) => {
          if (isRequestAborted(error)) {
            return
          }
          setStatus('error')
        })
    },
    [range],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const orderValueSeries = useMemo(
    () =>
      (data?.ordersByDay ?? []).map((row) => ({
        ...row,
        orderValueNumber: Number(row.nonCancelledOrderValue),
      })),
    [data],
  )

  const topProductSeries = useMemo(
    () =>
      (data?.topProducts ?? []).map((row) => ({
        ...row,
        label: row.productName,
      })),
    [data],
  )

  function setRange(next: AnalyticsRange) {
    const params = new URLSearchParams(searchParams)
    if (next === '30d') {
      params.delete('range')
    } else {
      params.set('range', next)
    }
    setSearchParams(params)
  }

  if (status === 'loading' && !data) {
    return <p className="text-sm text-muted">Loading analytics…</p>
  }

  if (status === 'error' && !data) {
    return (
      <ErrorState
        message="We could not load analytics."
        onRetry={() => load()}
      />
    )
  }

  if (!data) {
    return <p className="text-sm text-muted">Loading analytics…</p>
  }

  const cards = [
    { label: 'Orders', value: String(data.summary.totalOrders) },
    {
      label: 'Non-cancelled order value',
      value: formatAud(data.summary.nonCancelledOrderValue),
    },
    {
      label: 'Average order value',
      value: formatAud(data.summary.averageOrderValue),
    },
    { label: 'Units ordered', value: String(data.summary.unitsOrdered) },
    {
      label: 'Discounts applied',
      value: formatAud(data.summary.discountValue),
    },
    { label: 'New customers', value: String(data.summary.newCustomers) },
  ]

  const secondary = [
    { label: 'Non-cancelled orders', value: data.summary.nonCancelledOrders },
    { label: 'Cancelled orders', value: data.summary.cancelledOrders },
    { label: 'Delivered orders', value: data.summary.deliveredOrders },
    { label: 'Open orders', value: data.summary.openOrders },
    { label: 'Promoted orders', value: data.summary.promotedOrders },
  ]

  const inventory = [
    { label: 'Active products', value: data.inventorySnapshot.activeProducts },
    { label: 'Total units', value: data.inventorySnapshot.totalUnits },
    { label: 'Healthy', value: data.inventorySnapshot.healthyProducts },
    { label: 'Low stock', value: data.inventorySnapshot.lowStockProducts },
    { label: 'Out of stock', value: data.inventorySnapshot.outOfStockProducts },
  ]

  return (
    <section className="w-full min-w-0 max-w-full">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        Analytics
      </p>
      <div className="mt-2 flex min-w-0 max-w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 w-full max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Analytics
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Operational trends across orders, discounts, customers, and
            inventory.
          </p>
          <p className="mt-2 text-sm leading-6 text-ink">
            Order values are operational order totals and do not represent
            collected revenue.
          </p>
        </div>
        <div className="w-full min-w-0 lg:max-w-xs lg:shrink-0">
          <label htmlFor="analytics-range" className="text-sm font-medium">
            Date range
          </label>
          <select
            id="analytics-range"
            className="input-field mt-1.5 w-full"
            value={range}
            onChange={(event) => setRange(event.target.value as AnalyticsRange)}
          >
            {RANGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status === 'loading' ? (
        <p className="mt-6 text-sm text-muted" aria-live="polite">
          Updating analytics…
        </p>
      ) : null}

      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <li
            key={card.label}
            className="w-full min-w-0 max-w-full rounded-lg border border-line bg-paper px-4 py-4"
          >
            <p className="text-sm text-muted">{card.label}</p>
            <p className="mt-2 break-words text-2xl font-semibold tabular-nums text-ink">
              {card.value}
            </p>
          </li>
        ))}
      </ul>

      <ul className="mt-4 flex min-w-0 max-w-full flex-wrap gap-3 text-sm text-muted">
        {secondary.map((item) => (
          <li
            key={item.label}
            className="max-w-full min-w-0 break-words rounded-full border border-line px-3 py-1"
          >
            {item.label}:{' '}
            <span className="font-medium tabular-nums text-ink">{item.value}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10 grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="w-full min-w-0 max-w-full rounded-lg border border-line bg-paper p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-ink">Order activity</h2>
          <p className="mt-1 text-sm text-muted">Orders created per day.</p>
          <AnalyticsChart>
            <LineChart
              data={data.ordersByDay}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                minTickGap={xMinTickGap}
                interval="preserveStartEnd"
                tick={CHART_TICK}
              />
              <YAxis allowDecimals={false} width={28} tick={CHART_TICK} />
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                wrapperStyle={{ maxWidth: 220, pointerEvents: 'none' }}
                allowEscapeViewBox={{ x: false, y: true }}
                labelFormatter={(label) => String(label)}
                formatter={(value, name) => [
                  value,
                  name === 'totalOrders' ? 'Total orders' : 'Non-cancelled orders',
                ]}
              />
              <Line
                type="monotone"
                dataKey="totalOrders"
                name="totalOrders"
                stroke={CHART_BRAND}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="nonCancelledOrders"
                name="nonCancelledOrders"
                stroke={CHART_SECONDARY}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </AnalyticsChart>
        </section>

        <section className="w-full min-w-0 max-w-full rounded-lg border border-line bg-paper p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-ink">Non-cancelled order value</h2>
          <p className="mt-1 text-sm text-muted">
            Daily operational totals for orders that were not cancelled.
          </p>
          <AnalyticsChart>
            <BarChart
              data={orderValueSeries}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                minTickGap={xMinTickGap}
                interval="preserveStartEnd"
                tick={CHART_TICK}
              />
              <YAxis
                width={40}
                tick={CHART_TICK}
                tickFormatter={(value) => String(Math.round(Number(value)))}
              />
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                wrapperStyle={{ maxWidth: 220, pointerEvents: 'none' }}
                allowEscapeViewBox={{ x: false, y: true }}
                formatter={(value) => [
                  formatAud(Number(value).toFixed(2)),
                  'Non-cancelled order value',
                ]}
              />
              <Bar
                dataKey="orderValueNumber"
                fill={CHART_BRAND}
                name="Non-cancelled order value"
              />
            </BarChart>
          </AnalyticsChart>
        </section>
      </div>

      <div className="mt-6 grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
        <section className="w-full min-w-0 max-w-full rounded-lg border border-line bg-paper p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-ink">Order status</h2>
          <p className="mt-1 text-sm text-muted">
            All orders in the selected range, including cancelled orders.
          </p>
          <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0 w-full max-w-full">
              <AnalyticsChart>
                <PieChart>
                  <Pie
                    data={data.statusDistribution}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                  >
                    {data.statusDistribution.map((row) => (
                      <Cell
                        key={row.status}
                        fill={STATUS_COLORS[row.status] ?? CHART_TEXT}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    wrapperStyle={{ maxWidth: 220, pointerEvents: 'none' }}
                    allowEscapeViewBox={{ x: false, y: true }}
                    formatter={(value, name) => [
                      value,
                      formatOrderStatus(String(name) as never),
                    ]}
                  />
                </PieChart>
              </AnalyticsChart>
            </div>
            <ul className="min-w-0 w-full max-w-full space-y-2 text-sm">
              {data.statusDistribution.map((row) => (
                <li key={row.status} className="flex min-w-0 justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 break-words">
                    <span
                      className="h-2.5 w-2.5 shrink-0"
                      style={{
                        backgroundColor:
                          STATUS_COLORS[row.status] ?? CHART_TEXT,
                      }}
                      aria-hidden="true"
                    />
                    {formatOrderStatus(row.status)}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="w-full min-w-0 max-w-full rounded-lg border border-line bg-paper p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-ink">New customers</h2>
          <p className="mt-1 text-sm text-muted">
            Customer accounts created in this range. Identities are not shown.
          </p>
          <p className="mt-4 text-3xl font-semibold tabular-nums">
            {data.summary.newCustomers}
          </p>
          <AnalyticsChart>
            <BarChart
              data={data.customersByDay}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                minTickGap={isMdUp ? 20 : 32}
                interval="preserveStartEnd"
                tick={CHART_TICK}
              />
              <YAxis allowDecimals={false} width={28} tick={CHART_TICK} />
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                wrapperStyle={{ maxWidth: 220, pointerEvents: 'none' }}
                allowEscapeViewBox={{ x: false, y: true }}
                formatter={(value) => [value, 'New customers']}
              />
              <Bar dataKey="newCustomers" fill={CHART_BRAND} name="New customers" />
            </BarChart>
          </AnalyticsChart>
        </section>
      </div>

      <section className="mt-6 w-full min-w-0 max-w-full rounded-lg border border-line bg-paper p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-ink">Top products by units ordered</h2>
        <p className="mt-1 text-sm text-muted">
          Non-cancelled orders in this range, using historical item snapshots.
        </p>
        {data.topProducts.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No product demand in this period.</p>
        ) : (
          <>
            {isMdUp ? (
              <div className="mt-4 min-w-0 w-full max-w-full">
                <AnalyticsChart>
                  <BarChart
                    data={topProductSeries}
                    layout="vertical"
                    margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                  >
                    <XAxis type="number" allowDecimals={false} tick={CHART_TICK} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={96}
                      tick={CHART_TICK}
                      tickFormatter={(value: string) =>
                        value.length > 16 ? `${value.slice(0, 14)}…` : value
                      }
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                      wrapperStyle={{ maxWidth: 220, pointerEvents: 'none' }}
                      allowEscapeViewBox={{ x: false, y: true }}
                      formatter={(value) => [value, 'Units ordered']}
                    />
                    <Bar
                      dataKey="unitsOrdered"
                      fill={CHART_BRAND}
                      name="Units ordered"
                    />
                  </BarChart>
                </AnalyticsChart>
              </div>
            ) : null}
            <ul className="mt-4 grid min-w-0 gap-3">
              {data.topProducts.map((product) => (
                <li
                  key={product.sku}
                  className="w-full min-w-0 max-w-full rounded-xl border border-line px-4 py-3"
                >
                  <p className="break-words font-medium text-ink">{product.productName}</p>
                  <p className="mt-1 break-all text-sm text-muted">{product.sku}</p>
                  <p className="mt-2 text-sm tabular-nums">
                    {product.unitsOrdered} units · {product.orderCount} orders ·{' '}
                    {formatAud(product.orderValue)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="mt-6 w-full min-w-0 max-w-full rounded-lg border border-line bg-paper p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-ink">Promotion usage</h2>
        <p className="mt-1 text-sm text-muted">
          Codes stored on non-cancelled orders. Unused catalogue promotions are
          not listed.
        </p>
        {data.promotionPerformance.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No promotion usage in this period.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {data.promotionPerformance.map((row) => (
              <li
                key={row.code}
                className="w-full min-w-0 max-w-full rounded-xl border border-line px-4 py-3"
              >
                <p className="break-all font-medium text-ink">{row.code}</p>
                <p className="mt-2 text-sm tabular-nums">
                  {row.orderCount} orders · Discounts {formatAud(row.discountValue)}{' '}
                  · Order value {formatAud(row.orderValue)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 w-full min-w-0 max-w-full rounded-lg border border-line bg-paper p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-ink">Current inventory snapshot</h2>
        <p className="mt-1 text-sm text-muted">
          Inventory reflects current stock and is not limited by the selected
          analytics date range.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {inventory.map((item) => (
            <li key={item.label} className="w-full min-w-0 max-w-full rounded-xl border border-line px-3 py-3">
              <p className="text-xs text-muted">{item.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{item.value}</p>
            </li>
          ))}
        </ul>
        <Link to="/admin/inventory" className="btn-secondary mt-5 inline-flex">
          Manage inventory
        </Link>
      </section>
    </section>
  )
}
