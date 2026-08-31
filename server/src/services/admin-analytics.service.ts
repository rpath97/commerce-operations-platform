import { Prisma, type OrderStatus } from '@prisma/client'
import {
  eachUtcDateKey,
  resolveAnalyticsPeriod,
  type AnalyticsRange,
} from '../lib/analytics-period.js'
import { prisma } from '../lib/prisma.js'
import { toMoneyString } from '../lib/promotion.js'

const OPEN_STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'PROCESSING']
const ALL_STATUSES: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]
const TOP_LIMIT = 5
const ZERO = new Prisma.Decimal(0)

export type AnalyticsPeriodDto = {
  range: AnalyticsRange
  from: string | null
  to: string
  generatedAt: string
}

export type AnalyticsSummaryDto = {
  totalOrders: number
  nonCancelledOrders: number
  cancelledOrders: number
  deliveredOrders: number
  openOrders: number
  nonCancelledOrderValue: string
  averageOrderValue: string
  discountValue: string
  unitsOrdered: number
  promotedOrders: number
  newCustomers: number
}

export type OrdersByDayDto = {
  date: string
  totalOrders: number
  nonCancelledOrders: number
  cancelledOrders: number
  nonCancelledOrderValue: string
}

export type StatusDistributionDto = {
  status: OrderStatus
  count: number
}

export type TopProductDto = {
  productName: string
  sku: string
  unitsOrdered: number
  orderCount: number
  orderValue: string
}

export type PromotionPerformanceDto = {
  code: string
  orderCount: number
  orderValue: string
  discountValue: string
}

export type CustomersByDayDto = {
  date: string
  newCustomers: number
}

export type InventorySnapshotDto = {
  activeProducts: number
  totalUnits: number
  healthyProducts: number
  lowStockProducts: number
  outOfStockProducts: number
}

export type AdminAnalyticsDto = {
  period: AnalyticsPeriodDto
  summary: AnalyticsSummaryDto
  ordersByDay: OrdersByDayDto[]
  statusDistribution: StatusDistributionDto[]
  topProducts: TopProductDto[]
  promotionPerformance: PromotionPerformanceDto[]
  customersByDay: CustomersByDayDto[]
  inventorySnapshot: InventorySnapshotDto
}

type DayCountRow = {
  date: string
  total_orders: number | bigint
  non_cancelled_orders: number | bigint
  cancelled_orders: number | bigint
  order_value: string | null
}

type CustomerDayRow = {
  date: string
  new_customers: number | bigint
}

type TopProductRow = {
  sku: string
  productName: string
  unitsOrdered: number | bigint
  orderCount: number | bigint
  orderValue: string | null
}

type InventoryRow = {
  activeProducts: number | bigint
  totalUnits: number | bigint
  healthyProducts: number | bigint
  lowStockProducts: number | bigint
  outOfStockProducts: number | bigint
}

function toCount(value: number | bigint | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }
  return typeof value === 'bigint' ? Number(value) : value
}

function moneyFromSql(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '0.00'
  }
  return toMoneyString(new Prisma.Decimal(value))
}

function averageOrderValue(
  total: Prisma.Decimal,
  orderCount: number,
): string {
  if (orderCount === 0) {
    return '0.00'
  }
  return toMoneyString(total.div(orderCount))
}

function createdAtWhere(
  from: Date | null,
  toExclusive: Date,
): Prisma.DateTimeFilter {
  if (from) {
    return { gte: from, lt: toExclusive }
  }
  return { lt: toExclusive }
}

function orderCreatedAtSql(from: Date | null, toExclusive: Date): Prisma.Sql {
  if (from) {
    return Prisma.sql`o."createdAt" >= ${from} AND o."createdAt" < ${toExclusive}`
  }
  return Prisma.sql`o."createdAt" < ${toExclusive}`
}

function userCreatedAtSql(from: Date | null, toExclusive: Date): Prisma.Sql {
  if (from) {
    return Prisma.sql`u."createdAt" >= ${from} AND u."createdAt" < ${toExclusive}`
  }
  return Prisma.sql`u."createdAt" < ${toExclusive}`
}

function fillOrderDays(
  keys: string[],
  rows: DayCountRow[],
): OrdersByDayDto[] {
  const byDate = new Map(rows.map((row) => [row.date, row]))
  return keys.map((date) => {
    const row = byDate.get(date)
    return {
      date,
      totalOrders: toCount(row?.total_orders),
      nonCancelledOrders: toCount(row?.non_cancelled_orders),
      cancelledOrders: toCount(row?.cancelled_orders),
      nonCancelledOrderValue: moneyFromSql(row?.order_value),
    }
  })
}

function fillCustomerDays(
  keys: string[],
  rows: CustomerDayRow[],
): CustomersByDayDto[] {
  const byDate = new Map(rows.map((row) => [row.date, row]))
  return keys.map((date) => ({
    date,
    newCustomers: toCount(byDate.get(date)?.new_customers),
  }))
}

export async function getAdminAnalytics(
  range: AnalyticsRange,
): Promise<AdminAnalyticsDto> {
  const now = new Date()

  const [earliestOrder, earliestCustomer] = await Promise.all([
    prisma.order.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.user.findFirst({
      where: { role: 'CUSTOMER' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ])

  const earliestTimes = [earliestOrder?.createdAt, earliestCustomer?.createdAt]
    .filter((value): value is Date => value instanceof Date)

  const earliestRecord =
    earliestTimes.length === 0
      ? null
      : new Date(Math.min(...earliestTimes.map((value) => value.getTime())))

  const period = resolveAnalyticsPeriod(range, now, earliestRecord)
  const createdAt = createdAtWhere(period.from, period.toExclusive)
  const orderWhere: Prisma.OrderWhereInput = { createdAt }
  const nonCancelledWhere: Prisma.OrderWhereInput = {
    createdAt,
    status: { not: 'CANCELLED' },
  }

  const [
    totalOrders,
    cancelledOrders,
    deliveredOrders,
    openOrders,
    nonCancelledAggregate,
    unitsAggregate,
    promotedOrders,
    newCustomers,
    statusGroups,
    promotionGroups,
    orderDayRows,
    customerDayRows,
    topProductRows,
    inventoryRows,
  ] = await Promise.all([
    prisma.order.count({ where: orderWhere }),
    prisma.order.count({
      where: { createdAt, status: 'CANCELLED' },
    }),
    prisma.order.count({
      where: { createdAt, status: 'DELIVERED' },
    }),
    prisma.order.count({
      where: { createdAt, status: { in: OPEN_STATUSES } },
    }),
    prisma.order.aggregate({
      where: nonCancelledWhere,
      _count: true,
      _sum: { total: true, discountAmount: true },
    }),
    prisma.orderItem.aggregate({
      where: { order: nonCancelledWhere },
      _sum: { quantity: true },
    }),
    prisma.order.count({
      where: {
        ...nonCancelledWhere,
        promotionCode: { not: null },
      },
    }),
    prisma.user.count({
      where: { role: 'CUSTOMER', createdAt },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: orderWhere,
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ['promotionCode'],
      where: {
        ...nonCancelledWhere,
        promotionCode: { not: null },
      },
      _count: { _all: true },
      _sum: { total: true, discountAmount: true },
    }),
    prisma.$queryRaw<DayCountRow[]>(Prisma.sql`
      SELECT
        to_char(o."createdAt", 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS total_orders,
        COUNT(*) FILTER (WHERE o.status <> 'CANCELLED')::int AS non_cancelled_orders,
        COUNT(*) FILTER (WHERE o.status = 'CANCELLED')::int AS cancelled_orders,
        COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'CANCELLED'), 0)::text AS order_value
      FROM "Order" o
      WHERE ${orderCreatedAtSql(period.from, period.toExclusive)}
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    prisma.$queryRaw<CustomerDayRow[]>(Prisma.sql`
      SELECT
        to_char(u."createdAt", 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS new_customers
      FROM "User" u
      WHERE u.role = 'CUSTOMER'
        AND ${userCreatedAtSql(period.from, period.toExclusive)}
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    prisma.$queryRaw<TopProductRow[]>(Prisma.sql`
      SELECT
        oi.sku AS sku,
        MIN(oi."productName") AS "productName",
        COALESCE(SUM(oi.quantity), 0)::int AS "unitsOrdered",
        COUNT(DISTINCT oi."orderId")::int AS "orderCount",
        COALESCE(SUM(oi."lineTotal"), 0)::text AS "orderValue"
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON o.id = oi."orderId"
      WHERE o.status <> 'CANCELLED'
        AND ${orderCreatedAtSql(period.from, period.toExclusive)}
      GROUP BY oi.sku
      ORDER BY "unitsOrdered" DESC, sku ASC
      LIMIT ${TOP_LIMIT}
    `),
    prisma.$queryRaw<InventoryRow[]>`
      SELECT
        COUNT(*)::int AS "activeProducts",
        COALESCE(SUM(i.quantity), 0)::int AS "totalUnits",
        COUNT(*) FILTER (WHERE i.quantity > i."lowStockThreshold")::int AS "healthyProducts",
        COUNT(*) FILTER (
          WHERE i.quantity > 0 AND i.quantity <= i."lowStockThreshold"
        )::int AS "lowStockProducts",
        COUNT(*) FILTER (WHERE i.quantity = 0)::int AS "outOfStockProducts"
      FROM "Product" p
      INNER JOIN "Inventory" i ON i."productId" = p.id
      WHERE p."isActive" = true
    `,
  ])

  const nonCancelledOrders = nonCancelledAggregate._count
  const nonCancelledOrderValue = nonCancelledAggregate._sum.total ?? ZERO
  const discountValue = nonCancelledAggregate._sum.discountAmount ?? ZERO
  const dateKeys = period.from
    ? eachUtcDateKey(period.from, period.toExclusive)
    : []

  const statusCounts = new Map(
    statusGroups.map((row) => [row.status, row._count._all]),
  )

  const promotionPerformance = promotionGroups
    .filter((row): row is typeof row & { promotionCode: string } =>
      Boolean(row.promotionCode),
    )
    .sort((a, b) => {
      const countDiff = b._count._all - a._count._all
      if (countDiff !== 0) {
        return countDiff
      }
      return a.promotionCode.localeCompare(b.promotionCode)
    })
    .slice(0, TOP_LIMIT)
    .map((row) => ({
      code: row.promotionCode,
      orderCount: row._count._all,
      orderValue: toMoneyString(row._sum.total ?? ZERO),
      discountValue: toMoneyString(row._sum.discountAmount ?? ZERO),
    }))

  const inventory = inventoryRows[0]

  return {
    period: {
      range: period.range,
      from: period.from ? period.from.toISOString() : null,
      to: period.toExclusive.toISOString(),
      generatedAt: period.generatedAt.toISOString(),
    },
    summary: {
      totalOrders,
      nonCancelledOrders,
      cancelledOrders,
      deliveredOrders,
      openOrders,
      nonCancelledOrderValue: toMoneyString(nonCancelledOrderValue),
      averageOrderValue: averageOrderValue(
        nonCancelledOrderValue,
        nonCancelledOrders,
      ),
      discountValue: toMoneyString(discountValue),
      unitsOrdered: unitsAggregate._sum.quantity ?? 0,
      promotedOrders,
      newCustomers,
    },
    ordersByDay: fillOrderDays(dateKeys, orderDayRows),
    statusDistribution: ALL_STATUSES.map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0,
    })),
    topProducts: topProductRows.map((row) => ({
      productName: row.productName,
      sku: row.sku,
      unitsOrdered: toCount(row.unitsOrdered),
      orderCount: toCount(row.orderCount),
      orderValue: moneyFromSql(row.orderValue),
    })),
    promotionPerformance,
    customersByDay: fillCustomerDays(dateKeys, customerDayRows),
    inventorySnapshot: {
      activeProducts: toCount(inventory?.activeProducts),
      totalUnits: toCount(inventory?.totalUnits),
      healthyProducts: toCount(inventory?.healthyProducts),
      lowStockProducts: toCount(inventory?.lowStockProducts),
      outOfStockProducts: toCount(inventory?.outOfStockProducts),
    },
  }
}
