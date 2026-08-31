import { randomUUID } from 'node:crypto'
import { Prisma, type OrderStatus } from '@prisma/client'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { addUtcDays, utcDayStart } from '../src/lib/analytics-period.js'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { hashPassword } from '../src/utils/password.js'

const password = 'SecurePassword123!'
const createdEmails: string[] = []
const createdCategoryIds: string[] = []
const createdProductIds: string[] = []
const createdOrderIds: string[] = []

function uniqueSuffix(): string {
  return randomUUID().slice(0, 8).toUpperCase()
}

function uniqueEmail(prefix = 'phase12-an'): string {
  const email = `${prefix}-${randomUUID()}@example.com`
  createdEmails.push(email)
  return email
}

function cookieHeader(response: request.Response): string[] {
  const header = response.headers['set-cookie']
  if (!header) {
    return []
  }
  return Array.isArray(header) ? header : [header]
}

function atUtc(date: Date, hours = 12): Date {
  const start = utcDayStart(date)
  return new Date(start.getTime() + hours * 60 * 60 * 1000)
}

async function loginAdmin() {
  const email = uniqueEmail('phase12-admin')
  await prisma.user.create({
    data: {
      firstName: 'Analytics',
      lastName: 'Admin',
      email,
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
    },
  })
  const response = await request(app).post('/api/auth/login').send({
    email,
    password,
  })
  return cookieHeader(response)
}

async function createCustomer(createdAt?: Date) {
  const email = uniqueEmail('phase12-cust')
  const user = await prisma.user.create({
    data: {
      firstName: 'Analytics',
      lastName: 'Customer',
      email,
      passwordHash: await hashPassword(password),
      role: 'CUSTOMER',
    },
  })
  if (createdAt) {
    const utcStamp = createdAt.toISOString().slice(0, 23).replace('T', ' ')
    await prisma.$executeRaw`
      UPDATE "User"
      SET "createdAt" = ${utcStamp}::timestamp
      WHERE id = ${user.id}
    `
  }
  return user
}

async function createCategory() {
  const suffix = uniqueSuffix()
  const category = await prisma.category.create({
    data: {
      name: `Phase12 Cat ${suffix}`,
      slug: `phase12-cat-${suffix.toLowerCase()}`,
    },
  })
  createdCategoryIds.push(category.id)
  return category
}

async function createProduct(options: {
  categoryId: string
  quantity: number
  lowStockThreshold?: number
  isActive?: boolean
}) {
  const suffix = uniqueSuffix()
  const product = await prisma.product.create({
    data: {
      name: `Phase12 Product ${suffix}`,
      slug: `phase12-product-${suffix.toLowerCase()}`,
      description: 'Phase 12 analytics product',
      sku: `P12-${suffix}`,
      price: '25.00',
      isActive: options.isActive ?? true,
      categoryId: options.categoryId,
      inventory: {
        create: {
          quantity: options.quantity,
          lowStockThreshold: options.lowStockThreshold ?? 5,
        },
      },
    },
  })
  createdProductIds.push(product.id)
  return product
}

async function createOrder(options: {
  userId: string
  status: OrderStatus
  total: string
  discountAmount?: string
  promotionCode?: string | null
  createdAt: Date
  items: Array<{
    productName: string
    sku: string
    quantity: number
    unitPrice: string
    lineTotal: string
  }>
}) {
  const order = await prisma.order.create({
    data: {
      userId: options.userId,
      orderNumber: `CO-A${randomUUID().replaceAll('-', '').slice(0, 11).toUpperCase()}`,
      status: options.status,
      subtotal: options.total,
      discountAmount: options.discountAmount ?? '0.00',
      shippingAmount: '0.00',
      total: options.total,
      promotionCode: options.promotionCode ?? null,
      items: {
        create: options.items.map((item) => ({
          productName: item.productName,
          sku: item.sku,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        })),
      },
    },
  })
  createdOrderIds.push(order.id)
  const utcStamp = options.createdAt.toISOString().slice(0, 23).replace('T', ' ')
  await prisma.$executeRaw`
    UPDATE "Order"
    SET "createdAt" = ${utcStamp}::timestamp
    WHERE id = ${order.id}
  `
  return order
}

function money(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value)
}

function addMoney(left: string, right: string): string {
  return money(left).plus(right).toFixed(2)
}

function expectedAverage(total: string, count: number): string {
  if (count === 0) {
    return '0.00'
  }
  return money(total)
    .div(count)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    .toFixed(2)
}

async function fetchAnalytics(cookies: string[], range = '7d') {
  const response = await request(app)
    .get('/api/admin/analytics')
    .query({ range })
    .set('Cookie', cookies)
  expect(response.status).toBe(200)
  return response.body.data as {
    period: { range: string; from: string | null; to: string }
    summary: {
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
    ordersByDay: Array<{
      date: string
      totalOrders: number
      nonCancelledOrders: number
      cancelledOrders: number
      nonCancelledOrderValue: string
    }>
    statusDistribution: Array<{ status: string; count: number }>
    topProducts: Array<{
      productName: string
      sku: string
      unitsOrdered: number
      orderCount: number
      orderValue: string
    }>
    promotionPerformance: Array<{
      code: string
      orderCount: number
      orderValue: string
      discountValue: string
    }>
    customersByDay: Array<{ date: string; newCustomers: number }>
    inventorySnapshot: {
      activeProducts: number
      totalUnits: number
      healthyProducts: number
      lowStockProducts: number
      outOfStockProducts: number
    }
  }
}

afterEach(async () => {
  if (createdOrderIds.length > 0) {
    await prisma.order.deleteMany({
      where: { id: { in: [...createdOrderIds] } },
    })
    createdOrderIds.length = 0
  }

  if (createdEmails.length > 0) {
    await prisma.order.deleteMany({
      where: { user: { email: { in: [...createdEmails] } } },
    })
    await prisma.user.deleteMany({
      where: { email: { in: [...createdEmails] } },
    })
    createdEmails.length = 0
  }

  if (createdProductIds.length > 0) {
    await prisma.product.deleteMany({
      where: { id: { in: [...createdProductIds] } },
    })
    createdProductIds.length = 0
  }

  if (createdCategoryIds.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: [...createdCategoryIds] } },
    })
    createdCategoryIds.length = 0
  }
})

describe('admin analytics authorization', () => {
  it('rejects a guest', async () => {
    const response = await request(app).get('/api/admin/analytics')
    expect(response.status).toBe(401)
  })

  it('rejects a CUSTOMER', async () => {
    const email = uniqueEmail('phase12-cust-auth')
    const registered = await request(app).post('/api/auth/register').send({
      firstName: 'No',
      lastName: 'Access',
      email,
      password,
    })
    const response = await request(app)
      .get('/api/admin/analytics')
      .set('Cookie', cookieHeader(registered))
    expect(response.status).toBe(403)
  })

  it('allows an ADMIN', async () => {
    const cookies = await loginAdmin()
    const response = await request(app)
      .get('/api/admin/analytics')
      .set('Cookie', cookies)
    expect(response.status).toBe(200)
    expect(response.body.data.period.range).toBe('30d')
  })
})

describe('admin analytics ranges', () => {
  it('defaults to 30d and accepts known ranges', async () => {
    const cookies = await loginAdmin()
    const today = utcDayStart(new Date())

    const def = await request(app)
      .get('/api/admin/analytics')
      .set('Cookie', cookies)
    expect(def.status).toBe(200)
    expect(def.body.data.period.range).toBe('30d')
    expect(def.body.data.period.from).toBe(addUtcDays(today, -29).toISOString())
    expect(def.body.data.period.to).toBe(addUtcDays(today, 1).toISOString())
    expect(def.body.data.ordersByDay).toHaveLength(30)

    const week = await request(app)
      .get('/api/admin/analytics')
      .query({ range: '7d' })
      .set('Cookie', cookies)
    expect(week.status).toBe(200)
    expect(week.body.data.period.range).toBe('7d')
    expect(week.body.data.period.from).toBe(addUtcDays(today, -6).toISOString())
    expect(week.body.data.ordersByDay).toHaveLength(7)

    const quarter = await request(app)
      .get('/api/admin/analytics')
      .query({ range: '90d' })
      .set('Cookie', cookies)
    expect(quarter.status).toBe(200)
    expect(quarter.body.data.ordersByDay).toHaveLength(90)

    const all = await request(app)
      .get('/api/admin/analytics')
      .query({ range: 'all' })
      .set('Cookie', cookies)
    expect(all.status).toBe(200)
    expect(all.body.data.period.range).toBe('all')
  })

  it('rejects an invalid range and unexpected query fields', async () => {
    const cookies = await loginAdmin()
    const invalid = await request(app)
      .get('/api/admin/analytics')
      .query({ range: '15d' })
      .set('Cookie', cookies)
    expect(invalid.status).toBe(400)

    const extra = await request(app)
      .get('/api/admin/analytics')
      .query({ range: '30d', unexpected: 'yes' })
      .set('Cookie', cookies)
    expect(extra.status).toBe(400)
  })
})

describe('admin analytics empty state', () => {
  it('returns a stable 200 payload with 2-decimal money and filled day buckets', async () => {
    const cookies = await loginAdmin()
    const data = await fetchAnalytics(cookies)
    const { summary } = data

    expect(summary.nonCancelledOrderValue).toMatch(/^\d+\.\d{2}$/)
    expect(summary.averageOrderValue).toMatch(/^\d+\.\d{2}$/)
    expect(summary.discountValue).toMatch(/^\d+\.\d{2}$/)
    expect(Number.isFinite(Number(summary.averageOrderValue))).toBe(true)
    expect(Number.isFinite(summary.totalOrders)).toBe(true)
    expect(Array.isArray(data.topProducts)).toBe(true)
    expect(Array.isArray(data.promotionPerformance)).toBe(true)
    expect(data.ordersByDay).toHaveLength(7)
    expect(data.customersByDay).toHaveLength(7)
    expect(data.statusDistribution).toHaveLength(6)
    expect(
      data.ordersByDay.every((row) => row.nonCancelledOrderValue.match(/^\d+\.\d{2}$/)),
    ).toBe(true)
  })
})

describe('admin analytics summaries and cancelled semantics', () => {
  it('counts cancelled orders in activity but not in value, units, products, or promotions', async () => {
    const cookies = await loginAdmin()
    const before = await fetchAnalytics(cookies)
    const customer = await createCustomer()
    const today = atUtc(new Date())
    const token = uniqueSuffix()

    await createOrder({
      userId: customer.id,
      status: 'PENDING',
      total: '100.00',
      discountAmount: '10.00',
      promotionCode: `KEEP-${token}`,
      createdAt: today,
      items: [
        {
          productName: 'Kept Lamp',
          sku: `KEEP-${token}`,
          quantity: 900,
          unitPrice: '50.00',
          lineTotal: '100.00',
        },
      ],
    })
    await createOrder({
      userId: customer.id,
      status: 'CANCELLED',
      total: '80.00',
      discountAmount: '20.00',
      promotionCode: `DROP-${token}`,
      createdAt: today,
      items: [
        {
          productName: 'Cancelled Chair',
          sku: `DROP-${token}`,
          quantity: 4,
          unitPrice: '20.00',
          lineTotal: '80.00',
        },
      ],
    })
    await createOrder({
      userId: customer.id,
      status: 'DELIVERED',
      total: '40.00',
      createdAt: today,
      items: [
        {
          productName: 'Kept Lamp',
          sku: `KEEP-${token}`,
          quantity: 100,
          unitPrice: '40.00',
          lineTotal: '40.00',
        },
      ],
    })

    const after = await fetchAnalytics(cookies)
    const expectedValue = addMoney(before.summary.nonCancelledOrderValue, '140.00')
    const expectedNonCancelled = before.summary.nonCancelledOrders + 2

    expect(after.summary.totalOrders).toBe(before.summary.totalOrders + 3)
    expect(after.summary.nonCancelledOrders).toBe(expectedNonCancelled)
    expect(after.summary.cancelledOrders).toBe(before.summary.cancelledOrders + 1)
    expect(after.summary.deliveredOrders).toBe(before.summary.deliveredOrders + 1)
    expect(after.summary.openOrders).toBe(before.summary.openOrders + 1)
    expect(after.summary.nonCancelledOrderValue).toBe(expectedValue)
    expect(after.summary.averageOrderValue).toBe(
      expectedAverage(expectedValue, expectedNonCancelled),
    )
    expect(after.summary.discountValue).toBe(
      addMoney(before.summary.discountValue, '10.00'),
    )
    expect(after.summary.unitsOrdered).toBe(before.summary.unitsOrdered + 1000)
    expect(after.summary.promotedOrders).toBe(before.summary.promotedOrders + 1)
    expect(after.summary.newCustomers).toBe(before.summary.newCustomers + 1)

    const beforeStatus = Object.fromEntries(
      before.statusDistribution.map((row) => [row.status, row.count]),
    )
    const afterStatus = Object.fromEntries(
      after.statusDistribution.map((row) => [row.status, row.count]),
    )
    expect(afterStatus.PENDING).toBe((beforeStatus.PENDING ?? 0) + 1)
    expect(afterStatus.CANCELLED).toBe((beforeStatus.CANCELLED ?? 0) + 1)
    expect(afterStatus.DELIVERED).toBe((beforeStatus.DELIVERED ?? 0) + 1)
    expect(afterStatus.PAID).toBe(beforeStatus.PAID ?? 0)
    expect(after.statusDistribution).toHaveLength(6)

    const kept = after.topProducts.find((row) => row.sku === `KEEP-${token}`)
    expect(kept).toMatchObject({
      sku: `KEEP-${token}`,
      productName: 'Kept Lamp',
      unitsOrdered: 1000,
      orderCount: 2,
      orderValue: '140.00',
    })
    expect(after.topProducts.some((row) => row.sku === `DROP-${token}`)).toBe(
      false,
    )
    expect(
      after.promotionPerformance.find((row) => row.code === `KEEP-${token}`),
    ).toEqual({
      code: `KEEP-${token}`,
      orderCount: 1,
      orderValue: '100.00',
      discountValue: '10.00',
    })
    expect(
      after.promotionPerformance.some((row) => row.code === `DROP-${token}`),
    ).toBe(false)
  })

  it('excludes ADMIN users from newCustomers', async () => {
    const cookies = await loginAdmin()
    const before = await fetchAnalytics(cookies)
    const email = uniqueEmail('phase12-extra-admin')
    await prisma.user.create({
      data: {
        firstName: 'Extra',
        lastName: 'Admin',
        email,
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
      },
    })
    const after = await fetchAnalytics(cookies)
    expect(after.summary.newCustomers).toBe(before.summary.newCustomers)
  })
})

describe('admin analytics time series', () => {
  it('uses UTC day boundaries, includes today, zero-fills, and excludes older days', async () => {
    const cookies = await loginAdmin()
    const before = await fetchAnalytics(cookies)
    const customer = await createCustomer()
    const todayStart = utcDayStart(new Date())
    const today = new Date()
    const sixDaysAgo = atUtc(addUtcDays(todayStart, -6), 12)
    const tenDaysAgo = atUtc(addUtcDays(todayStart, -10), 12)
    const token = uniqueSuffix()

    await createOrder({
      userId: customer.id,
      status: 'PENDING',
      total: '15.00',
      createdAt: today,
      items: [
        {
          productName: 'Today',
          sku: `DAY-TODAY-${token}`,
          quantity: 1,
          unitPrice: '15.00',
          lineTotal: '15.00',
        },
      ],
    })
    await createOrder({
      userId: customer.id,
      status: 'CANCELLED',
      total: '9.00',
      createdAt: today,
      items: [
        {
          productName: 'Today Cancel',
          sku: `DAY-CANCEL-${token}`,
          quantity: 1,
          unitPrice: '9.00',
          lineTotal: '9.00',
        },
      ],
    })
    await createOrder({
      userId: customer.id,
      status: 'PROCESSING',
      total: '22.50',
      createdAt: sixDaysAgo,
      items: [
        {
          productName: 'Edge',
          sku: `DAY-EDGE-${token}`,
          quantity: 1,
          unitPrice: '22.50',
          lineTotal: '22.50',
        },
      ],
    })
    await createOrder({
      userId: customer.id,
      status: 'PENDING',
      total: '50.00',
      createdAt: tenDaysAgo,
      items: [
        {
          productName: 'Too Old',
          sku: `DAY-OLD-${token}`,
          quantity: 1,
          unitPrice: '50.00',
          lineTotal: '50.00',
        },
      ],
    })

    const after = await fetchAnalytics(cookies)
    const series = after.ordersByDay
    expect(series).toHaveLength(7)
    expect(series.map((row) => row.date)).toEqual(
      [...series].sort((a, b) => a.date.localeCompare(b.date)).map((row) => row.date),
    )
    expect(series[0].date).toBe(addUtcDays(todayStart, -6).toISOString().slice(0, 10))
    expect(series[6].date).toBe(todayStart.toISOString().slice(0, 10))
    expect(series[0].totalOrders).toBe(before.ordersByDay[0].totalOrders + 1)
    expect(series[0].nonCancelledOrderValue).toBe(
      addMoney(before.ordersByDay[0].nonCancelledOrderValue, '22.50'),
    )
    expect(series[6].totalOrders).toBe(before.ordersByDay[6].totalOrders + 2)
    expect(series[6].cancelledOrders).toBe(before.ordersByDay[6].cancelledOrders + 1)
    expect(series[6].nonCancelledOrders).toBe(
      before.ordersByDay[6].nonCancelledOrders + 1,
    )
    expect(series[6].nonCancelledOrderValue).toBe(
      addMoney(before.ordersByDay[6].nonCancelledOrderValue, '15.00'),
    )
    expect(after.summary.totalOrders).toBe(before.summary.totalOrders + 3)
    expect(after.summary.nonCancelledOrderValue).toBe(
      addMoney(before.summary.nonCancelledOrderValue, '37.50'),
    )
    expect(
      after.topProducts.some((row) => row.sku === `DAY-OLD-${token}`),
    ).toBe(false)
  })

  it('uses a 30-day window and keeps 30d and 90d lengths stable', async () => {
    const cookies = await loginAdmin()
    const todayStart = utcDayStart(new Date())
    const thirty = await fetchAnalytics(cookies, '30d')
    expect(thirty.period.from).toBe(addUtcDays(todayStart, -29).toISOString())
    expect(thirty.ordersByDay).toHaveLength(30)
    expect(thirty.customersByDay).toHaveLength(30)
  })
})

describe('admin analytics top products and promotions', () => {
  it('groups historical SKUs, excludes cancelled lines, and keeps snapshot codes after edits', async () => {
    const cookies = await loginAdmin()
    const customer = await createCustomer()
    const now = atUtc(new Date())
    const token = uniqueSuffix()
    const skuA = `SKU-A-${token}`
    const skuB = `SKU-B-${token}`
    const skuC = `SKU-C-${token}`
    const promoCode = `SNAP-${token}`

    await createOrder({
      userId: customer.id,
      status: 'PENDING',
      total: '30.00',
      createdAt: now,
      items: [
        {
          productName: 'Alpha Historic',
          sku: skuA,
          quantity: 2000,
          unitPrice: '10.00',
          lineTotal: '20.00',
        },
        {
          productName: 'Beta',
          sku: skuB,
          quantity: 1500,
          unitPrice: '10.00',
          lineTotal: '10.00',
        },
      ],
    })
    await createOrder({
      userId: customer.id,
      status: 'SHIPPED',
      total: '40.00',
      createdAt: now,
      items: [
        {
          productName: 'Alpha Later Name',
          sku: skuA,
          quantity: 3000,
          unitPrice: '10.00',
          lineTotal: '30.00',
        },
        {
          productName: 'Gamma',
          sku: skuC,
          quantity: 800,
          unitPrice: '10.00',
          lineTotal: '10.00',
        },
      ],
    })
    await createOrder({
      userId: customer.id,
      status: 'CANCELLED',
      total: '100.00',
      createdAt: now,
      items: [
        {
          productName: 'Should Ignore',
          sku: skuA,
          quantity: 50_000,
          unitPrice: '2.00',
          lineTotal: '100.00',
        },
      ],
    })

    const products = await fetchAnalytics(cookies)
    expect(products.topProducts[0].sku).toBe(skuA)
    expect(products.topProducts[0].unitsOrdered).toBe(5000)
    expect(products.topProducts[0].orderCount).toBe(2)
    expect(products.topProducts[0].orderValue).toBe('50.00')
    expect(['Alpha Historic', 'Alpha Later Name']).toContain(
      products.topProducts[0].productName,
    )
    expect(products.topProducts.some((row) => row.sku === skuB)).toBe(true)
    expect(products.topProducts.some((row) => row.sku === skuC)).toBe(true)

    await createOrder({
      userId: customer.id,
      status: 'PENDING',
      total: '90.00',
      discountAmount: '12.00',
      promotionCode: promoCode,
      createdAt: now,
      items: [
        {
          productName: 'Promo item',
          sku: `SKU-P-${token}`,
          quantity: 1,
          unitPrice: '90.00',
          lineTotal: '90.00',
        },
      ],
    })
    const promotion = await prisma.promotion.create({
      data: {
        code: promoCode,
        discountType: 'PERCENTAGE',
        discountValue: '12.00',
        startsAt: addUtcDays(now, -1),
        endsAt: addUtcDays(now, 10),
        isActive: true,
      },
    })
    await prisma.promotion.update({
      where: { id: promotion.id },
      data: { code: `CHANGED-${token}` },
    })

    const afterEdit = await fetchAnalytics(cookies)
    expect(
      afterEdit.promotionPerformance.some((row) => row.code === promoCode),
    ).toBe(true)
    expect(
      afterEdit.promotionPerformance.some((row) => row.code === `CHANGED-${token}`),
    ).toBe(false)

    await prisma.promotion.delete({ where: { id: promotion.id } })
  })

  it('does not treat a cancelled promoted order as promotion usage', async () => {
    const cookies = await loginAdmin()
    const before = await fetchAnalytics(cookies)
    const customer = await createCustomer()
    const code = `GONE-${uniqueSuffix()}`
    await createOrder({
      userId: customer.id,
      status: 'CANCELLED',
      total: '25.00',
      promotionCode: code,
      createdAt: atUtc(new Date()),
      items: [
        {
          productName: 'None',
          sku: `NONE-${uniqueSuffix()}`,
          quantity: 1,
          unitPrice: '25.00',
          lineTotal: '25.00',
        },
      ],
    })
    const after = await fetchAnalytics(cookies)
    expect(after.promotionPerformance.some((row) => row.code === code)).toBe(
      false,
    )
    expect(after.promotionPerformance).toEqual(before.promotionPerformance)
  })
})

describe('admin analytics customers and inventory snapshot', () => {
  it('counts customers in range only and zero-fills the series', async () => {
    const cookies = await loginAdmin()
    const before = await fetchAnalytics(cookies)
    const todayStart = utcDayStart(new Date())
    await createCustomer(atUtc(todayStart, 10))
    await createCustomer(atUtc(addUtcDays(todayStart, -10), 10))

    const after = await fetchAnalytics(cookies)
    expect(after.summary.newCustomers).toBe(before.summary.newCustomers + 1)
    expect(after.customersByDay).toHaveLength(7)
    const todayRow = after.customersByDay[6]
    expect(todayRow.date).toBe(todayStart.toISOString().slice(0, 10))
    expect(todayRow.newCustomers).toBe(before.customersByDay[6].newCustomers + 1)
  })

  it('reports current active inventory and ignores the selected range', async () => {
    const cookies = await loginAdmin()
    const before = await fetchAnalytics(cookies)
    const category = await createCategory()
    await createProduct({ categoryId: category.id, quantity: 20, lowStockThreshold: 5 })
    await createProduct({ categoryId: category.id, quantity: 3, lowStockThreshold: 5 })
    await createProduct({ categoryId: category.id, quantity: 0, lowStockThreshold: 5 })
    await createProduct({
      categoryId: category.id,
      quantity: 0,
      isActive: false,
    })

    const week = await fetchAnalytics(cookies, '7d')
    const quarter = await fetchAnalytics(cookies, '90d')
    const previous = before.inventorySnapshot
    const snapshot = week.inventorySnapshot
    expect(snapshot.activeProducts).toBe(previous.activeProducts + 3)
    expect(snapshot.totalUnits).toBe(previous.totalUnits + 23)
    expect(snapshot.healthyProducts).toBe(previous.healthyProducts + 1)
    expect(snapshot.lowStockProducts).toBe(previous.lowStockProducts + 1)
    expect(snapshot.outOfStockProducts).toBe(previous.outOfStockProducts + 1)
    expect(quarter.inventorySnapshot).toEqual(snapshot)
  })
})
