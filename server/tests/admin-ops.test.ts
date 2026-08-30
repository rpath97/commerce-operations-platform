import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { hashPassword } from '../src/utils/password.js'

const password = 'SecurePassword123!'
const createdEmails: string[] = []
const createdCategoryIds: string[] = []
const createdProductIds: string[] = []

function uniqueSuffix(): string {
  return randomUUID().slice(0, 8)
}

function uniqueEmail(prefix = 'phase9-ops'): string {
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

async function loginAdmin() {
  const email = uniqueEmail('phase9-ops-admin')
  const user = await prisma.user.create({
    data: {
      firstName: 'Ops',
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

  return { cookies: cookieHeader(response), user }
}

async function registerCustomer(firstName = 'Ada', lastName = 'Customer') {
  const email = uniqueEmail('phase9-ops-cust')
  const response = await request(app).post('/api/auth/register').send({
    firstName,
    lastName,
    email,
    password,
  })
  return { cookies: cookieHeader(response), email, firstName, lastName }
}

async function createAddress(cookies: string[]) {
  const response = await request(app)
    .post('/api/addresses')
    .set('Cookie', cookies)
    .send({
      firstName: 'Ada',
      lastName: 'Customer',
      addressLine1: '10 Example Street',
      suburb: 'Melbourne',
      state: 'VIC',
      postcode: '3000',
      country: 'Australia',
    })
  return response.body.data as { id: string }
}

async function createTestCategory(namePrefix = 'Phase9 Cat') {
  const suffix = uniqueSuffix()
  const category = await prisma.category.create({
    data: {
      name: `${namePrefix} ${suffix}`,
      slug: `phase9-cat-${suffix}`,
    },
  })
  createdCategoryIds.push(category.id)
  return category
}

async function createTestProduct(options: {
  categoryId: string
  name?: string
  sku?: string
  price?: string
  quantity?: number
  lowStockThreshold?: number
  isActive?: boolean
}) {
  const suffix = uniqueSuffix()
  const product = await prisma.product.create({
    data: {
      name: options.name ?? `Phase9 Product ${suffix}`,
      slug: `phase9-product-${suffix}`,
      description: 'Phase 9 test product',
      sku: options.sku ?? `P9-${suffix}`,
      price: options.price ?? '25.00',
      isActive: options.isActive ?? true,
      categoryId: options.categoryId,
      inventory: {
        create: {
          quantity: options.quantity ?? 10,
          lowStockThreshold: options.lowStockThreshold ?? 5,
        },
      },
    },
    include: { inventory: true },
  })
  createdProductIds.push(product.id)
  return product
}

async function placeOrder(
  cookies: string[],
  productId: string,
  quantity: number,
) {
  await request(app)
    .post('/api/cart/items')
    .set('Cookie', cookies)
    .send({ productId, quantity })
  const address = await createAddress(cookies)
  const response = await request(app)
    .post('/api/orders')
    .set('Cookie', cookies)
    .send({ addressId: address.id })
  expect(response.status).toBe(201)
  return response.body.data as {
    id: string
    orderNumber: string
    status: string
    total: string
    subtotal: string
    items: Array<{
      id: string
      productId: string | null
      productName: string
      sku: string
      quantity: number
      unitPrice: string
      lineTotal: string
    }>
  }
}

afterEach(async () => {
  if (createdEmails.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { user: { email: { in: [...createdEmails] } } },
    })
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

describe('admin dashboard', () => {
  it('returns accurate operational counts and recent orders', async () => {
    const { cookies } = await loginAdmin()
    const before = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', cookies)
    expect(before.status).toBe(200)

    const category = await createTestCategory()
    await createTestProduct({
      categoryId: category.id,
      quantity: 1,
      lowStockThreshold: 5,
    })
    await createTestProduct({
      categoryId: category.id,
      quantity: 80,
      lowStockThreshold: 5,
      isActive: false,
    })

    const first = await registerCustomer('Nia', 'First')
    const second = await registerCustomer('Omar', 'Second')
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 20,
    })
    const orderA = await placeOrder(first.cookies, product.id, 1)
    const orderB = await placeOrder(second.cookies, product.id, 2)

    const after = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', cookies)

    expect(after.status).toBe(200)

    const expected = {
      customers: await prisma.user.count({ where: { role: 'CUSTOMER' } }),
      activeProducts: await prisma.product.count({ where: { isActive: true } }),
      archivedProducts: await prisma.product.count({
        where: { isActive: false },
      }),
      categories: await prisma.category.count(),
      totalOrders: await prisma.order.count(),
      openOrders: await prisma.order.count({
        where: { status: { in: ['PENDING', 'PAID', 'PROCESSING'] } },
      }),
    }

    expect(after.body.data.counts.customers).toBe(expected.customers)
    expect(after.body.data.counts.activeProducts).toBe(expected.activeProducts)
    expect(after.body.data.counts.archivedProducts).toBe(
      expected.archivedProducts,
    )
    expect(after.body.data.counts.categories).toBe(expected.categories)
    expect(after.body.data.counts.totalOrders).toBe(expected.totalOrders)
    expect(after.body.data.counts.openOrders).toBe(expected.openOrders)
    expect(after.body.data.counts.lowStockProducts).toBeGreaterThanOrEqual(
      before.body.data.counts.lowStockProducts + 1,
    )

    const recent = after.body.data.recentOrders as Array<{
      id: string
      createdAt: string
      customer: Record<string, unknown>
      total: string
    }>
    expect(recent.length).toBeLessThanOrEqual(5)
    const times = recent.map((order) => new Date(order.createdAt).getTime())
    for (let index = 1; index < times.length; index += 1) {
      expect(times[index]).toBeLessThanOrEqual(times[index - 1])
    }
    expect(recent.some((order) => order.id === orderB.id)).toBe(true)
    expect(recent[0].total).toMatch(/^\d+\.\d{2}$/)
    expect(recent[0].customer).not.toHaveProperty('id')
    expect(JSON.stringify(after.body)).not.toMatch(/revenue/i)

    expect(orderA.id).toBeTruthy()
  })
})

describe('admin product list', () => {
  it('lists active and archived products with filters, search, sort, and inventory', async () => {
    const { cookies } = await loginAdmin()
    const category = await createTestCategory('Filter Cat')
    const other = await createTestCategory('Other Cat')
    const active = await createTestProduct({
      categoryId: category.id,
      name: 'Phase9 Unique Yoga Mat',
      sku: `YOGA-${uniqueSuffix()}`,
      price: '19.50',
      quantity: 2,
      lowStockThreshold: 5,
    })
    const archived = await createTestProduct({
      categoryId: category.id,
      name: 'Phase9 Archived Lamp',
      sku: `LAMP-${uniqueSuffix()}`,
      isActive: false,
      quantity: 0,
    })
    await createTestProduct({
      categoryId: other.id,
      name: 'Phase9 Other Item',
      price: '40.00',
    })

    const all = await request(app)
      .get('/api/admin/products')
      .query({ search: 'Phase9 Unique Yoga' })
      .set('Cookie', cookies)
    expect(all.status).toBe(200)
    expect(all.body.data.some((item: { id: string }) => item.id === active.id)).toBe(
      true,
    )

    const withArchived = await request(app)
      .get('/api/admin/products')
      .query({ search: 'Phase9 Archived Lamp', status: 'all' })
      .set('Cookie', cookies)
    expect(
      withArchived.body.data.some((item: { id: string }) => item.id === archived.id),
    ).toBe(true)

    const activeOnly = await request(app)
      .get('/api/admin/products')
      .query({ search: 'Phase9', status: 'active' })
      .set('Cookie', cookies)
    expect(
      activeOnly.body.data.every((item: { isActive: boolean }) => item.isActive),
    ).toBe(true)

    const archivedOnly = await request(app)
      .get('/api/admin/products')
      .query({ status: 'archived', search: 'Phase9 Archived' })
      .set('Cookie', cookies)
    expect(archivedOnly.body.data[0].id).toBe(archived.id)
    expect(archivedOnly.body.data[0].isActive).toBe(false)

    const bySku = await request(app)
      .get('/api/admin/products')
      .query({ search: active.sku })
      .set('Cookie', cookies)
    expect(bySku.body.data[0].id).toBe(active.id)

    const byCategory = await request(app)
      .get('/api/admin/products')
      .query({ category: category.slug, search: 'Phase9' })
      .set('Cookie', cookies)
    expect(
      byCategory.body.data.every(
        (item: { category: { id: string } }) => item.category.id === category.id,
      ),
    ).toBe(true)

    const page1 = await request(app)
      .get('/api/admin/products')
      .query({ search: 'Phase9', limit: 1, page: 1, sort: 'name-asc' })
      .set('Cookie', cookies)
    const page2 = await request(app)
      .get('/api/admin/products')
      .query({ search: 'Phase9', limit: 1, page: 2, sort: 'name-asc' })
      .set('Cookie', cookies)
    expect(page1.body.pagination.limit).toBe(1)
    expect(page1.body.data[0].id).not.toBe(page2.body.data[0].id)

    const yoga = bySku.body.data[0]
    expect(yoga.price).toBe('19.50')
    expect(yoga.inventory).toEqual(
      expect.objectContaining({
        quantity: 2,
        inStock: true,
        lowStockThreshold: 5,
        isLowStock: true,
      }),
    )

    const malformed = await request(app)
      .get('/api/admin/products')
      .query({ page: 'nope' })
      .set('Cookie', cookies)
    expect(malformed.status).toBe(400)

    const extra = await request(app)
      .get('/api/admin/products')
      .query({ unexpected: 'yes' })
      .set('Cookie', cookies)
    expect(extra.status).toBe(400)
  })

  it('restores an archived product with PATCH isActive true', async () => {
    const { cookies } = await loginAdmin()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      isActive: false,
    })

    const response = await request(app)
      .patch(`/api/admin/products/${product.id}`)
      .set('Cookie', cookies)
      .send({ isActive: true })

    expect(response.status).toBe(200)
    expect(response.body.data.isActive).toBe(true)
  })
})

describe('admin categories', () => {
  it('lists categories with product counts including archived products', async () => {
    const { cookies } = await loginAdmin()
    const category = await createTestCategory('Count Cat')
    await createTestProduct({ categoryId: category.id })
    await createTestProduct({ categoryId: category.id, isActive: false })

    const response = await request(app)
      .get('/api/admin/categories')
      .set('Cookie', cookies)

    expect(response.status).toBe(200)
    const match = response.body.data.find(
      (item: { id: string }) => item.id === category.id,
    )
    expect(match.productCount).toBe(2)
    expect(match).toEqual(
      expect.objectContaining({
        name: category.name,
        slug: category.slug,
      }),
    )
  })
})

describe('admin orders', () => {
  it('lists orders across customers and returns detail snapshots', async () => {
    const { cookies } = await loginAdmin()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 20,
      price: '12.50',
    })
    const first = await registerCustomer('Lina', 'One')
    const second = await registerCustomer('Marco', 'Two')
    const orderA = await placeOrder(first.cookies, product.id, 1)
    const orderB = await placeOrder(second.cookies, product.id, 3)

    const list = await request(app)
      .get('/api/admin/orders')
      .query({ search: 'phase9-ops-cust' })
      .set('Cookie', cookies)
    expect(list.status).toBe(200)
    expect(list.body.data[0].id).toBe(orderB.id)
    expect(list.body.data[1].id).toBe(orderA.id)
    expect(list.body.data[0].itemCount).toBe(3)
    expect(list.body.data[0].total).toMatch(/^\d+\.\d{2}$/)
    expect(list.body.data[0].customer.email).toBe(second.email)

    const pending = await request(app)
      .get('/api/admin/orders')
      .query({ status: 'PENDING', search: orderA.orderNumber })
      .set('Cookie', cookies)
    expect(pending.body.data).toHaveLength(1)
    expect(pending.body.data[0].orderNumber).toBe(orderA.orderNumber)

    const byEmail = await request(app)
      .get('/api/admin/orders')
      .query({ search: second.email })
      .set('Cookie', cookies)
    expect(byEmail.body.data[0].id).toBe(orderB.id)

    const page = await request(app)
      .get('/api/admin/orders')
      .query({ search: 'phase9-ops-cust', limit: 1, page: 1 })
      .set('Cookie', cookies)
    expect(page.body.pagination.limit).toBe(1)
    expect(page.body.data).toHaveLength(1)

    const detailA = await request(app)
      .get(`/api/admin/orders/${orderA.id}`)
      .set('Cookie', cookies)
    const detailB = await request(app)
      .get(`/api/admin/orders/${orderB.id}`)
      .set('Cookie', cookies)
    expect(detailA.status).toBe(200)
    expect(detailB.status).toBe(200)
    expect(detailA.body.data.customer.email).toBe(first.email)
    expect(detailB.body.data.customer.email).toBe(second.email)
    expect(detailA.body.data.shippingAddress.addressLine1).toBe(
      '10 Example Street',
    )
    expect(detailA.body.data.items[0]).toEqual(
      expect.objectContaining({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: '12.50',
      }),
    )
    expect(detailA.body.data.customer).not.toHaveProperty('passwordHash')

    const malformed = await request(app)
      .get('/api/admin/orders/not-a-uuid')
      .set('Cookie', cookies)
    expect(malformed.status).toBe(400)

    const missing = await request(app)
      .get(`/api/admin/orders/${randomUUID()}`)
      .set('Cookie', cookies)
    expect(missing.status).toBe(404)
  })
})

describe('admin order status', () => {
  async function orderFixture() {
    const admin = await loginAdmin()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 20,
    })
    const customer = await registerCustomer()
    const order = await placeOrder(customer.cookies, product.id, 2)
    return { ...admin, product, order }
  }

  it('allows the documented forward transitions including PAID', async () => {
    const { cookies, order } = await orderFixture()

    const processing = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'PROCESSING' })
    expect(processing.status).toBe(200)
    expect(processing.body.data.status).toBe('PROCESSING')

    const shipped = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'SHIPPED' })
    expect(shipped.status).toBe(200)

    const delivered = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'DELIVERED' })
    expect(delivered.status).toBe(200)
    expect(delivered.body.data.status).toBe('DELIVERED')

    const paidAdmin = await loginAdmin()
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id, quantity: 8 })
    const customer = await registerCustomer()
    const paidOrder = await placeOrder(customer.cookies, product.id, 1)
    await prisma.order.update({
      where: { id: paidOrder.id },
      data: { status: 'PAID' },
    })

    const fromPaid = await request(app)
      .patch(`/api/admin/orders/${paidOrder.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'PROCESSING' })
    expect(fromPaid.status).toBe(200)

    const cancelPaid = await placeOrder(customer.cookies, product.id, 1)
    await prisma.order.update({
      where: { id: cancelPaid.id },
      data: { status: 'PAID' },
    })
    const cancelled = await request(app)
      .patch(`/api/admin/orders/${cancelPaid.id}/status`)
      .set('Cookie', paidAdmin.cookies)
      .send({ status: 'CANCELLED' })
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.data.status).toBe('CANCELLED')
  })

  it('rejects invalid transitions, unknown status, extra fields, and bad ids', async () => {
    const { cookies, order } = await orderFixture()

    const pendingToPaid = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'PAID' })
    expect(pendingToPaid.status).toBe(409)

    const pendingToDelivered = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'DELIVERED' })
    expect(pendingToDelivered.status).toBe(409)

    await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'PROCESSING' })

    const backToPending = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'PENDING' })
    expect(backToPending.status).toBe(409)

    await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'SHIPPED' })

    const shippedToProcessing = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'PROCESSING' })
    expect(shippedToProcessing.status).toBe(409)

    await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'DELIVERED' })

    const deliveredToProcessing = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'PROCESSING' })
    expect(deliveredToProcessing.status).toBe(409)

    const deliveredCancel = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'CANCELLED' })
    expect(deliveredCancel.status).toBe(409)

    const cancelledOrder = await orderFixture()
    await request(app)
      .patch(`/api/admin/orders/${cancelledOrder.order.id}/status`)
      .set('Cookie', cancelledOrder.cookies)
      .send({ status: 'CANCELLED' })
    const cancelledToProcessing = await request(app)
      .patch(`/api/admin/orders/${cancelledOrder.order.id}/status`)
      .set('Cookie', cancelledOrder.cookies)
      .send({ status: 'PROCESSING' })
    expect(cancelledToProcessing.status).toBe(409)

    const unknown = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'LOST' })
    expect(unknown.status).toBe(400)

    const extra = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'PROCESSING', total: '0.00' })
    expect(extra.status).toBe(400)

    const malformed = await request(app)
      .patch('/api/admin/orders/not-a-uuid/status')
      .set('Cookie', cookies)
      .send({ status: 'PROCESSING' })
    expect(malformed.status).toBe(400)

    const missing = await request(app)
      .patch(`/api/admin/orders/${randomUUID()}/status`)
      .set('Cookie', cookies)
      .send({ status: 'PROCESSING' })
    expect(missing.status).toBe(404)
  })
})

describe('admin cancellation restock', () => {
  it('restores inventory once and leaves snapshots and totals unchanged', async () => {
    const { cookies } = await loginAdmin()
    const category = await createTestCategory()
    const yoga = await createTestProduct({
      categoryId: category.id,
      name: 'Phase9 Yoga Mat',
      quantity: 4,
    })
    const bottle = await createTestProduct({
      categoryId: category.id,
      name: 'Phase9 Bottle',
      quantity: 6,
    })
    const customer = await registerCustomer()
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', customer.cookies)
      .send({ productId: yoga.id, quantity: 2 })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', customer.cookies)
      .send({ productId: bottle.id, quantity: 1 })
    const address = await createAddress(customer.cookies)
    const created = await request(app)
      .post('/api/orders')
      .set('Cookie', customer.cookies)
      .send({ addressId: address.id })
    const order = created.body.data

    const afterCheckoutYoga = await prisma.inventory.findUniqueOrThrow({
      where: { productId: yoga.id },
    })
    const afterCheckoutBottle = await prisma.inventory.findUniqueOrThrow({
      where: { productId: bottle.id },
    })
    expect(afterCheckoutYoga.quantity).toBe(2)
    expect(afterCheckoutBottle.quantity).toBe(5)

    const snapshotItems = order.items.map(
      (item: { productName: string; sku: string; quantity: number; unitPrice: string }) => ({
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }),
    )
    const snapshotTotal = order.total

    const cancelled = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'CANCELLED' })

    expect(cancelled.status).toBe(200)
    expect(cancelled.body.data.status).toBe('CANCELLED')
    expect(cancelled.body.data.total).toBe(snapshotTotal)
    expect(
      cancelled.body.data.items.map(
        (item: { productName: string; sku: string; quantity: number; unitPrice: string }) => ({
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }),
      ),
    ).toEqual(snapshotItems)

    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: yoga.id } }))
        .quantity,
    ).toBe(4)
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: bottle.id } }))
        .quantity,
    ).toBe(6)

    const repeat = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'CANCELLED' })
    expect(repeat.status).toBe(409)
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: yoga.id } }))
        .quantity,
    ).toBe(4)

    const processAdmin = await loginAdmin()
    const processProduct = await createTestProduct({
      categoryId: category.id,
      quantity: 9,
    })
    const processCustomer = await registerCustomer()
    const processOrder = await placeOrder(
      processCustomer.cookies,
      processProduct.id,
      1,
    )
    await request(app)
      .patch(`/api/admin/orders/${processOrder.id}/status`)
      .set('Cookie', processAdmin.cookies)
      .send({ status: 'PROCESSING' })
    expect(
      (await prisma.inventory.findUniqueOrThrow({
        where: { productId: processProduct.id },
      })).quantity,
    ).toBe(8)
  })

  it('does not double-restock concurrent cancellations', async () => {
    const { cookies } = await loginAdmin()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 5,
    })
    const customer = await registerCustomer()
    const order = await placeOrder(customer.cookies, product.id, 2)

    const [first, second] = await Promise.all([
      request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Cookie', cookies)
        .send({ status: 'CANCELLED' }),
      request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Cookie', cookies)
        .send({ status: 'CANCELLED' }),
    ])

    const statuses = [first.status, second.status].sort()
    expect(statuses).toEqual([200, 409])
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }))
        .quantity,
    ).toBe(5)

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'Order', entityId: order.id },
    })
    expect(logs).toHaveLength(1)
  })

  it('skips restock for historical lines without a productId', async () => {
    const { cookies } = await loginAdmin()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 3,
    })
    const customer = await registerCustomer()
    const order = await placeOrder(customer.cookies, product.id, 1)

    await prisma.orderItem.updateMany({
      where: { orderId: order.id },
      data: { productId: null },
    })

    const response = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'CANCELLED' })

    expect(response.status).toBe(200)
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }))
        .quantity,
    ).toBe(2)
  })
})

describe('admin order audit', () => {
  it('writes ORDER_STATUS_UPDATED with admin user, entity, and statuses', async () => {
    const { cookies, user } = await loginAdmin()
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id, quantity: 4 })
    const customer = await registerCustomer()
    const order = await placeOrder(customer.cookies, product.id, 1)

    const response = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'PROCESSING' })
    expect(response.status).toBe(200)

    const log = await prisma.auditLog.findFirst({
      where: { entityType: 'Order', entityId: order.id },
    })
    expect(log).toMatchObject({
      userId: user.id,
      action: 'ORDER_STATUS_UPDATED',
      entityType: 'Order',
      entityId: order.id,
    })
    expect(log?.metadata).toEqual({
      fromStatus: 'PENDING',
      toStatus: 'PROCESSING',
    })
  })

  it('records product restore and category create audit actions', async () => {
    const { cookies, user } = await loginAdmin()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      isActive: false,
    })

    await request(app)
      .patch(`/api/admin/products/${product.id}`)
      .set('Cookie', cookies)
      .send({ isActive: true })

    const restoreLog = await prisma.auditLog.findFirst({
      where: { action: 'PRODUCT_RESTORED', entityId: product.id },
    })
    expect(restoreLog?.userId).toBe(user.id)

    const created = await request(app)
      .post('/api/admin/categories')
      .set('Cookie', cookies)
      .send({
        name: `Phase9 Audit Cat ${uniqueSuffix()}`,
        slug: `phase9-audit-cat-${uniqueSuffix()}`,
      })
    createdCategoryIds.push(created.body.data.id)

    const categoryLog = await prisma.auditLog.findFirst({
      where: {
        action: 'CATEGORY_CREATED',
        entityId: created.body.data.id,
      },
    })
    expect(categoryLog?.userId).toBe(user.id)
  })
})
