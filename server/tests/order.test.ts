import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

const password = 'SecurePassword123!'
const createdEmails: string[] = []
const createdCategoryIds: string[] = []
const createdProductIds: string[] = []

function uniqueSuffix(): string {
  return randomUUID().slice(0, 8)
}

function uniqueEmail(): string {
  const email = `phase8-order-${randomUUID()}@example.com`
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

async function registerCustomer() {
  const email = uniqueEmail()
  const response = await request(app).post('/api/auth/register').send({
    firstName: 'Phase8',
    lastName: 'Orders',
    email,
    password,
  })
  return cookieHeader(response)
}

async function createAddress(cookies: string[], overrides: Record<string, string> = {}) {
  const response = await request(app)
    .post('/api/addresses')
    .set('Cookie', cookies)
    .send({
      firstName: 'Ryan',
      lastName: 'Pathirana',
      addressLine1: '10 Example Street',
      suburb: 'Melbourne',
      state: 'VIC',
      postcode: '3000',
      country: 'Australia',
      ...overrides,
    })
  return response.body.data as { id: string; addressLine1: string }
}

async function createTestCategory() {
  const suffix = uniqueSuffix()
  const category = await prisma.category.create({
    data: {
      name: `Phase8 Cat ${suffix}`,
      slug: `phase8-cat-${suffix}`,
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
  isActive?: boolean
}) {
  const suffix = uniqueSuffix()
  const product = await prisma.product.create({
    data: {
      name: options.name ?? `Phase8 Product ${suffix}`,
      slug: `phase8-product-${suffix}`,
      description: 'Phase 8 test product',
      sku: options.sku ?? `P8-${suffix}`,
      price: options.price ?? '25.00',
      isActive: options.isActive ?? true,
      categoryId: options.categoryId,
      inventory: {
        create: {
          quantity: options.quantity ?? 10,
          lowStockThreshold: 2,
        },
      },
    },
    include: { inventory: true },
  })
  createdProductIds.push(product.id)
  return product
}

async function addToCart(
  cookies: string[],
  productId: string,
  quantity: number,
) {
  return request(app)
    .post('/api/cart/items')
    .set('Cookie', cookies)
    .send({ productId, quantity })
}

afterEach(async () => {
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

describe('order authentication', () => {
  it('rejects POST /api/orders without a session', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send({ addressId: randomUUID() })
    expect(response.status).toBe(401)
  })

  it('rejects GET /api/orders without a session', async () => {
    const response = await request(app).get('/api/orders')
    expect(response.status).toBe(401)
  })

  it('rejects GET /api/orders/:orderId without a session', async () => {
    const response = await request(app).get(`/api/orders/${randomUUID()}`)
    expect(response.status).toBe(401)
  })
})

describe('POST /api/orders checkout', () => {
  it('creates an order from a one-item cart', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      name: 'Checkout Headphones',
      sku: 'P8-HD-1',
      price: '64.00',
      quantity: 5,
    })
    await addToCart(cookies, product.id, 1)

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    expect(response.status).toBe(201)
    expect(response.body.data.status).toBe('PENDING')
    expect(response.body.data.orderNumber).toMatch(/^CO-[A-F0-9]{12}$/)
    expect(response.body.data.subtotal).toBe('64.00')
    expect(response.body.data.discountAmount).toBe('0.00')
    expect(response.body.data.shippingAmount).toBe('0.00')
    expect(response.body.data.total).toBe('64.00')
    expect(response.body.data.items).toHaveLength(1)
    expect(response.body.data.items[0]).toMatchObject({
      productName: 'Checkout Headphones',
      sku: 'P8-HD-1',
      unitPrice: '64.00',
      quantity: 1,
      lineTotal: '64.00',
    })
    expect(response.body.data.shippingAddress.addressLine1).toBe(
      '10 Example Street',
    )

    const inventory = await prisma.inventory.findUnique({
      where: { productId: product.id },
    })
    expect(inventory?.quantity).toBe(4)

    const cart = await request(app).get('/api/cart').set('Cookie', cookies)
    expect(cart.body.data.items).toEqual([])
  })

  it('creates an order from multiple products with exact totals', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const headphones = await createTestProduct({
      categoryId: category.id,
      name: 'Alpha',
      price: '19.99',
      quantity: 8,
    })
    const kettle = await createTestProduct({
      categoryId: category.id,
      name: 'Beta',
      price: '10.10',
      quantity: 8,
    })
    await addToCart(cookies, headphones.id, 3)
    await addToCart(cookies, kettle.id, 2)

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    expect(response.status).toBe(201)
    expect(response.body.data.subtotal).toBe('80.17')
    expect(response.body.data.total).toBe('80.17')
    expect(response.body.data.items).toHaveLength(2)
  })

  it('rejects an empty cart', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    expect(response.status).toBe(409)
    expect(response.body.error.message).toBe('Your cart is empty')
  })

  it('rejects an invalid address UUID', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: 'not-a-uuid' })

    expect(response.status).toBe(400)
  })

  it('rejects an unknown address', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    await addToCart(cookies, product.id, 1)

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: randomUUID() })

    expect(response.status).toBe(404)
    expect(response.body.error.message).toBe('Address not found')
  })

  it('rejects another user address', async () => {
    const owner = await registerCustomer()
    const other = await registerCustomer()
    const address = await createAddress(owner)
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    await addToCart(other, product.id, 1)

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', other)
      .send({ addressId: address.id })

    expect(response.status).toBe(404)
  })

  it('rejects checkout when a product is inactive', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 4,
    })
    await addToCart(cookies, product.id, 1)
    await prisma.product.update({
      where: { id: product.id },
      data: { isActive: false },
    })

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    expect(response.status).toBe(409)
    expect(response.body.error.message).toBe('Product is no longer available')

    const inventory = await prisma.inventory.findUnique({
      where: { productId: product.id },
    })
    expect(inventory?.quantity).toBe(4)

    const cart = await request(app).get('/api/cart').set('Cookie', cookies)
    expect(cart.body.data.items).toHaveLength(1)
    expect(
      await prisma.order.count({
        where: { user: { email: { startsWith: 'phase8-order-' } } },
      }),
    ).toBe(0)
  })

  it('rejects checkout when a product is out of stock', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 2,
    })
    await addToCart(cookies, product.id, 1)
    await prisma.inventory.update({
      where: { productId: product.id },
      data: { quantity: 0 },
    })

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    expect(response.status).toBe(409)
    expect(response.body.error.message).toBe('Product is out of stock')
    expect(
      (
        await prisma.inventory.findUnique({ where: { productId: product.id } })
      )?.quantity,
    ).toBe(0)

    const cart = await request(app).get('/api/cart').set('Cookie', cookies)
    expect(cart.body.data.items).toHaveLength(1)
  })

  it('rejects checkout when cart quantity exceeds current stock', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 5,
    })
    await addToCart(cookies, product.id, 4)
    await prisma.inventory.update({
      where: { productId: product.id },
      data: { quantity: 2 },
    })

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    expect(response.status).toBe(409)
    expect(response.body.error.message).toBe(
      'Requested quantity exceeds available stock',
    )
    expect(
      (
        await prisma.inventory.findUnique({ where: { productId: product.id } })
      )?.quantity,
    ).toBe(2)
  })

  it('does not create an order when checkout fails', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const before = await prisma.order.count({
      where: { user: { email: { startsWith: 'phase8-order-' } } },
    })

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    expect(response.status).toBe(409)
    const after = await prisma.order.count({
      where: { user: { email: { startsWith: 'phase8-order-' } } },
    })
    expect(after).toBe(before)
  })

  it('rolls back earlier inventory decrements when a later item fails', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const first = await createTestProduct({
      categoryId: category.id,
      name: 'First',
      quantity: 5,
    })
    const second = await createTestProduct({
      categoryId: category.id,
      name: 'Second',
      quantity: 5,
    })
    await addToCart(cookies, first.id, 2)
    await addToCart(cookies, second.id, 2)
    await prisma.inventory.update({
      where: { productId: second.id },
      data: { quantity: 1 },
    })

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    expect(response.status).toBe(409)
    expect(
      (await prisma.inventory.findUnique({ where: { productId: first.id } }))
        ?.quantity,
    ).toBe(5)
    expect(
      (await prisma.inventory.findUnique({ where: { productId: second.id } }))
        ?.quantity,
    ).toBe(1)
    expect(
      await prisma.order.count({
        where: { user: { email: { startsWith: 'phase8-order-' } } },
      }),
    ).toBe(0)

    const cart = await request(app).get('/api/cart').set('Cookie', cookies)
    expect(cart.body.data.items).toHaveLength(2)
  })

  it('preserves product snapshots after the live product changes', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      name: 'Original Name',
      sku: 'ORIG-SKU',
      price: '12.50',
      quantity: 3,
    })
    await addToCart(cookies, product.id, 2)

    const created = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    await prisma.product.update({
      where: { id: product.id },
      data: {
        name: 'Changed Name',
        sku: 'NEW-SKU',
        price: '99.00',
      },
    })

    const detail = await request(app)
      .get(`/api/orders/${created.body.data.id}`)
      .set('Cookie', cookies)

    expect(detail.body.data.items[0]).toMatchObject({
      productName: 'Original Name',
      sku: 'ORIG-SKU',
      unitPrice: '12.50',
      lineTotal: '25.00',
    })
  })

  it('charges the current database price, not the price at add-to-cart time', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      name: 'Price Shift',
      price: '10.00',
      quantity: 5,
    })
    await addToCart(cookies, product.id, 2)

    await prisma.product.update({
      where: { id: product.id },
      data: { price: '15.50' },
    })

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    expect(response.status).toBe(201)
    expect(response.body.data.items[0].unitPrice).toBe('15.50')
    expect(response.body.data.items[0].lineTotal).toBe('31.00')
    expect(response.body.data.subtotal).toBe('31.00')
    expect(response.body.data.total).toBe('31.00')
  })

  it('keeps the shipping snapshot after the saved address is edited or deleted', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    await addToCart(cookies, product.id, 1)

    const created = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    await request(app)
      .patch(`/api/addresses/${address.id}`)
      .set('Cookie', cookies)
      .send({ addressLine1: '50 New Street' })

    const afterEdit = await request(app)
      .get(`/api/orders/${created.body.data.id}`)
      .set('Cookie', cookies)
    expect(afterEdit.body.data.shippingAddress.addressLine1).toBe(
      '10 Example Street',
    )

    await request(app)
      .delete(`/api/addresses/${address.id}`)
      .set('Cookie', cookies)

    const afterDelete = await request(app)
      .get(`/api/orders/${created.body.data.id}`)
      .set('Cookie', cookies)
    expect(afterDelete.body.data.shippingAddress.addressLine1).toBe(
      '10 Example Street',
    )
    expect(afterDelete.body.data.shippingAddress.suburb).toBe('Melbourne')
  })

  it('creates exactly one order for a successful checkout', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    await addToCart(cookies, product.id, 1)

    await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    const count = await prisma.order.count({
      where: { user: { email: { startsWith: 'phase8-order-' } } },
    })
    expect(count).toBe(1)
  })

  it('does not create a second order from an empty cart after checkout', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 4,
    })
    await addToCart(cookies, product.id, 1)

    const first = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })
    const second = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    expect(first.status).toBe(201)
    expect(second.status).toBe(409)
    expect(second.body.error.message).toBe('Your cart is empty')
    expect(
      await prisma.order.count({
        where: { user: { email: { startsWith: 'phase8-order-' } } },
      }),
    ).toBe(1)
  })

  it('does not create two orders from concurrent checkout of the same cart', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 6,
    })
    await addToCart(cookies, product.id, 2)

    const [first, second] = await Promise.all([
      request(app)
        .post('/api/orders')
        .set('Cookie', cookies)
        .send({ addressId: address.id }),
      request(app)
        .post('/api/orders')
        .set('Cookie', cookies)
        .send({ addressId: address.id }),
    ])

    const created = [first, second].filter((response) => response.status === 201)
    const rejected = [first, second].filter((response) => response.status === 409)

    expect(created).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.body.error.message).toBe('Your cart is empty')
    expect(
      await prisma.order.count({
        where: { user: { email: { startsWith: 'phase8-order-' } } },
      }),
    ).toBe(1)
    expect(
      (await prisma.inventory.findUnique({ where: { productId: product.id } }))
        ?.quantity,
    ).toBe(4)
  })

  it('lets only one concurrent checkout succeed for a single remaining unit', async () => {
    const firstCookies = await registerCustomer()
    const secondCookies = await registerCustomer()
    const firstAddress = await createAddress(firstCookies)
    const secondAddress = await createAddress(secondCookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 1,
    })
    await addToCart(firstCookies, product.id, 1)
    await addToCart(secondCookies, product.id, 1)

    const [first, second] = await Promise.all([
      request(app)
        .post('/api/orders')
        .set('Cookie', firstCookies)
        .send({ addressId: firstAddress.id }),
      request(app)
        .post('/api/orders')
        .set('Cookie', secondCookies)
        .send({ addressId: secondAddress.id }),
    ])

    const statuses = [first.status, second.status].sort()
    expect(statuses).toEqual([201, 409])
    expect(
      (await prisma.inventory.findUnique({ where: { productId: product.id } }))
        ?.quantity,
    ).toBe(0)

    const created = [first, second].filter((response) => response.status === 201)
    expect(created).toHaveLength(1)
  })
})

describe('GET /api/orders', () => {
  it('lists only the current user orders, newest first, with pagination', async () => {
    const first = await registerCustomer()
    const second = await registerCustomer()
    const firstAddress = await createAddress(first)
    const secondAddress = await createAddress(second)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 20,
    })

    await addToCart(second, product.id, 1)
    await request(app)
      .post('/api/orders')
      .set('Cookie', second)
      .send({ addressId: secondAddress.id })

    await addToCart(first, product.id, 2)
    const older = await request(app)
      .post('/api/orders')
      .set('Cookie', first)
      .send({ addressId: firstAddress.id })

    await addToCart(first, product.id, 1)
    const newer = await request(app)
      .post('/api/orders')
      .set('Cookie', first)
      .send({ addressId: firstAddress.id })

    const list = await request(app)
      .get('/api/orders')
      .query({ page: 1, limit: 10 })
      .set('Cookie', first)

    expect(list.status).toBe(200)
    expect(list.body.data).toHaveLength(2)
    expect(list.body.data[0].id).toBe(newer.body.data.id)
    expect(list.body.data[1].id).toBe(older.body.data.id)
    expect(list.body.data[1].itemCount).toBe(2)
    expect(list.body.data[0].itemCount).toBe(1)
    expect(list.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    })
  })
})

describe('GET /api/orders/:orderId', () => {
  it('returns 404 for another user order', async () => {
    const owner = await registerCustomer()
    const other = await registerCustomer()
    const address = await createAddress(owner)
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    await addToCart(owner, product.id, 1)
    const created = await request(app)
      .post('/api/orders')
      .set('Cookie', owner)
      .send({ addressId: address.id })

    const response = await request(app)
      .get(`/api/orders/${created.body.data.id}`)
      .set('Cookie', other)

    expect(response.status).toBe(404)
    expect(response.body.error.message).toBe('Order not found')
  })

  it('rejects a malformed order UUID', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .get('/api/orders/not-a-uuid')
      .set('Cookie', cookies)
    expect(response.status).toBe(400)
  })

  it('returns 404 for an unknown order', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .get(`/api/orders/${randomUUID()}`)
      .set('Cookie', cookies)
    expect(response.status).toBe(404)
  })
})
