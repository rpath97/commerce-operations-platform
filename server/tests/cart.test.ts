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

function uniqueEmail(): string {
  const email = `phase7-cart-${randomUUID()}@example.com`
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
    firstName: 'Phase7',
    lastName: 'Customer',
    email,
    password,
  })

  return cookieHeader(response)
}

async function loginExisting(email: string) {
  const response = await request(app).post('/api/auth/login').send({
    email,
    password,
  })
  return cookieHeader(response)
}

async function createTestCategory() {
  const suffix = uniqueSuffix()
  const category = await prisma.category.create({
    data: {
      name: `Phase7 Cat ${suffix}`,
      slug: `phase7-cat-${suffix}`,
    },
  })
  createdCategoryIds.push(category.id)
  return category
}

async function createTestProduct(options: {
  categoryId: string
  name?: string
  price?: string
  quantity?: number
  isActive?: boolean
}) {
  const suffix = uniqueSuffix()
  const product = await prisma.product.create({
    data: {
      name: options.name ?? `Phase7 Product ${suffix}`,
      slug: `phase7-product-${suffix}`,
      description: 'Phase 7 test product',
      sku: `P7-${suffix}`,
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
    include: { inventory: true, category: true },
  })
  createdProductIds.push(product.id)
  return product
}

function assertSafePayload(payload: unknown) {
  const raw = JSON.stringify(payload)
  expect(raw).not.toMatch(/passwordHash/i)
  expect(raw).not.toMatch(/"token"/)
  expect(raw).not.toMatch(/JWT/i)
}

afterEach(async () => {
  if (createdEmails.length > 0) {
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

describe('cart authentication', () => {
  it('rejects GET /api/cart without a session', async () => {
    const response = await request(app).get('/api/cart')
    expect(response.status).toBe(401)
    expect(response.body.error.message).toBe('Authentication required')
  })

  it('rejects POST /api/cart/items without a session', async () => {
    const response = await request(app).post('/api/cart/items').send({
      productId: randomUUID(),
      quantity: 1,
    })
    expect(response.status).toBe(401)
  })

  it('rejects PATCH /api/cart/items/:itemId without a session', async () => {
    const response = await request(app)
      .patch(`/api/cart/items/${randomUUID()}`)
      .send({ quantity: 2 })
    expect(response.status).toBe(401)
  })

  it('rejects DELETE /api/cart without a session', async () => {
    const response = await request(app).delete('/api/cart')
    expect(response.status).toBe(401)
  })
})

describe('GET /api/cart', () => {
  it('returns an empty cart for a new session', async () => {
    const cookies = await registerCustomer()
    const response = await request(app).get('/api/cart').set('Cookie', cookies)

    expect(response.status).toBe(200)
    expect(response.body.data.items).toEqual([])
    expect(response.body.data.summary).toEqual({
      itemCount: 0,
      subtotal: '0.00',
    })
    expect(typeof response.body.data.id).toBe('string')
    assertSafePayload(response.body)
  })

  it('returns cart items with product data, itemCount, and subtotal', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      name: 'Alpha Headphones',
      price: '19.99',
      quantity: 8,
    })

    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 2 })

    const response = await request(app).get('/api/cart').set('Cookie', cookies)

    expect(response.status).toBe(200)
    expect(response.body.data.items).toHaveLength(1)
    expect(response.body.data.items[0]).toMatchObject({
      quantity: 2,
      lineTotal: '39.98',
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        sku: product.sku,
        price: '19.99',
        isActive: true,
        inStock: true,
        availableQuantity: 8,
      },
    })
    expect(response.body.data.summary).toEqual({
      itemCount: 2,
      subtotal: '39.98',
    })
  })
})

describe('POST /api/cart/items', () => {
  it('adds a valid product', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '10.00',
      quantity: 5,
    })

    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })

    expect(response.status).toBe(200)
    expect(response.body.data.items).toHaveLength(1)
    expect(response.body.data.items[0].quantity).toBe(1)
    expect(response.body.data.summary.itemCount).toBe(1)
    expect(response.body.data.summary.subtotal).toBe('10.00')
  })

  it('increments quantity when the same product is added again', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 10,
    })

    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 3 })

    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 2 })

    expect(response.status).toBe(200)
    expect(response.body.data.items).toHaveLength(1)
    expect(response.body.data.items[0].quantity).toBe(5)
    expect(response.body.data.summary.itemCount).toBe(5)
  })

  it('rejects an increment that would exceed available inventory', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 5,
    })

    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 3 })

    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 3 })

    expect(response.status).toBe(409)
    expect(response.body.error.message).toBe(
      'Requested quantity exceeds available stock',
    )

    const cart = await request(app).get('/api/cart').set('Cookie', cookies)
    expect(cart.body.data.items[0].quantity).toBe(3)
  })

  it('rejects an invalid product UUID', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: 'not-a-uuid', quantity: 1 })

    expect(response.status).toBe(400)
    expect(response.body.error.message).toBe('Validation failed')
  })

  it('rejects an unknown product', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: randomUUID(), quantity: 1 })

    expect(response.status).toBe(404)
    expect(response.body.error.message).toBe('Product not found')
  })

  it('rejects an inactive product', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      isActive: false,
      quantity: 4,
    })

    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })

    expect(response.status).toBe(409)
    expect(response.body.error.message).toBe('Product is no longer available')
  })

  it('rejects an out-of-stock product', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 0,
    })

    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })

    expect(response.status).toBe(409)
    expect(response.body.error.message).toBe('Product is out of stock')
  })

  it('rejects a quantity above available inventory', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 2,
    })

    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 3 })

    expect(response.status).toBe(409)
    expect(response.body.error.message).toBe(
      'Requested quantity exceeds available stock',
    )
  })

  it('rejects quantity 0', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: randomUUID(), quantity: 0 })

    expect(response.status).toBe(400)
  })

  it('rejects a negative quantity', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: randomUUID(), quantity: -1 })

    expect(response.status).toBe(400)
  })

  it('rejects a decimal quantity', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: randomUUID(), quantity: 1.5 })

    expect(response.status).toBe(400)
  })

  it('rejects extra body fields', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })

    const response = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({
        productId: product.id,
        quantity: 1,
        userId: randomUUID(),
      })

    expect(response.status).toBe(400)
  })
})

describe('PATCH /api/cart/items/:itemId', () => {
  it('updates quantity for the current user', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '12.50',
      quantity: 6,
    })

    const added = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const itemId = added.body.data.items[0].id as string

    const response = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set('Cookie', cookies)
      .send({ quantity: 4 })

    expect(response.status).toBe(200)
    expect(response.body.data.items[0].quantity).toBe(4)
    expect(response.body.data.items[0].lineTotal).toBe('50.00')
    expect(response.body.data.summary.itemCount).toBe(4)
    expect(response.body.data.summary.subtotal).toBe('50.00')
  })

  it('rejects a quantity above stock', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 3,
    })

    const added = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const itemId = added.body.data.items[0].id as string

    const response = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set('Cookie', cookies)
      .send({ quantity: 4 })

    expect(response.status).toBe(409)
    expect(response.body.error.message).toBe(
      'Requested quantity exceeds available stock',
    )
  })

  it('rejects a malformed item UUID', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .patch('/api/cart/items/not-a-uuid')
      .set('Cookie', cookies)
      .send({ quantity: 2 })

    expect(response.status).toBe(400)
  })

  it('returns 404 when the item is not in the user cart', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .patch(`/api/cart/items/${randomUUID()}`)
      .set('Cookie', cookies)
      .send({ quantity: 2 })

    expect(response.status).toBe(404)
    expect(response.body.error.message).toBe('Cart item not found')
  })

  it('cannot modify another user cart item', async () => {
    const ownerCookies = await registerCustomer()
    const otherCookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 5,
    })

    const added = await request(app)
      .post('/api/cart/items')
      .set('Cookie', ownerCookies)
      .send({ productId: product.id, quantity: 2 })
    const itemId = added.body.data.items[0].id as string

    const response = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set('Cookie', otherCookies)
      .send({ quantity: 1 })

    expect(response.status).toBe(404)

    const ownerCart = await request(app)
      .get('/api/cart')
      .set('Cookie', ownerCookies)
    expect(ownerCart.body.data.items[0].quantity).toBe(2)
  })

  it('rejects quantity 0', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    const added = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const itemId = added.body.data.items[0].id as string

    const response = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set('Cookie', cookies)
      .send({ quantity: 0 })

    expect(response.status).toBe(400)
    expect(added.body.data.items[0].quantity).toBe(1)
  })

  it('rejects a decimal quantity', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    const added = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const itemId = added.body.data.items[0].id as string

    const response = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set('Cookie', cookies)
      .send({ quantity: 1.4 })

    expect(response.status).toBe(400)
  })
})

describe('DELETE cart items and cart', () => {
  it('removes an item from the current user cart', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    const added = await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const itemId = added.body.data.items[0].id as string

    const response = await request(app)
      .delete(`/api/cart/items/${itemId}`)
      .set('Cookie', cookies)

    expect(response.status).toBe(200)
    expect(response.body.data.items).toEqual([])
    expect(response.body.data.summary.itemCount).toBe(0)
  })

  it('cannot remove another user cart item', async () => {
    const ownerCookies = await registerCustomer()
    const otherCookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    const added = await request(app)
      .post('/api/cart/items')
      .set('Cookie', ownerCookies)
      .send({ productId: product.id, quantity: 1 })
    const itemId = added.body.data.items[0].id as string

    const response = await request(app)
      .delete(`/api/cart/items/${itemId}`)
      .set('Cookie', otherCookies)

    expect(response.status).toBe(404)

    const ownerCart = await request(app)
      .get('/api/cart')
      .set('Cookie', ownerCookies)
    expect(ownerCart.body.data.items).toHaveLength(1)
  })

  it('clears all items from the current user cart', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const first = await createTestProduct({
      categoryId: category.id,
      name: 'First',
    })
    const second = await createTestProduct({
      categoryId: category.id,
      name: 'Second',
    })

    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: first.id, quantity: 1 })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: second.id, quantity: 2 })

    const response = await request(app).delete('/api/cart').set('Cookie', cookies)

    expect(response.status).toBe(200)
    expect(response.body.data.items).toEqual([])
    expect(response.body.data.summary).toEqual({
      itemCount: 0,
      subtotal: '0.00',
    })
  })
})

describe('archived products and later stock changes', () => {
  it('still returns an item when its product becomes inactive', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 4,
    })

    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })

    await prisma.product.update({
      where: { id: product.id },
      data: { isActive: false },
    })

    const response = await request(app).get('/api/cart').set('Cookie', cookies)

    expect(response.status).toBe(200)
    expect(response.body.data.items).toHaveLength(1)
    expect(response.body.data.items[0].product.isActive).toBe(false)
    expect(response.body.data.items[0].product.inStock).toBe(false)
    expect(response.body.data.items[0].quantity).toBe(1)

    const update = await request(app)
      .patch(`/api/cart/items/${response.body.data.items[0].id}`)
      .set('Cookie', cookies)
      .send({ quantity: 2 })

    expect(update.status).toBe(409)
    expect(update.body.error.message).toBe('Product is no longer available')
  })

  it('keeps cart quantity when stock falls below it', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 8,
    })

    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 5 })

    await prisma.inventory.update({
      where: { productId: product.id },
      data: { quantity: 2 },
    })

    const response = await request(app).get('/api/cart').set('Cookie', cookies)

    expect(response.status).toBe(200)
    expect(response.body.data.items[0].quantity).toBe(5)
    expect(response.body.data.items[0].product.availableQuantity).toBe(2)
  })

  it('keeps the cart item when stock becomes zero', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 3,
    })

    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 2 })

    await prisma.inventory.update({
      where: { productId: product.id },
      data: { quantity: 0 },
    })

    const response = await request(app).get('/api/cart').set('Cookie', cookies)

    expect(response.status).toBe(200)
    expect(response.body.data.items[0].quantity).toBe(2)
    expect(response.body.data.items[0].product.inStock).toBe(false)
    expect(response.body.data.items[0].product.availableQuantity).toBe(0)
  })
})

describe('cart money totals', () => {
  it('computes subtotals with exact decimal arithmetic', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const headphones = await createTestProduct({
      categoryId: category.id,
      name: 'Headphones',
      price: '19.99',
      quantity: 10,
    })
    const kettle = await createTestProduct({
      categoryId: category.id,
      name: 'Kettle',
      price: '10.10',
      quantity: 10,
    })

    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: headphones.id, quantity: 3 })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: kettle.id, quantity: 2 })

    const response = await request(app).get('/api/cart').set('Cookie', cookies)
    const items = response.body.data.items as Array<{
      product: { name: string }
      lineTotal: string
    }>
    const headphoneLine = items.find((item) => item.product.name === 'Headphones')
    const kettleLine = items.find((item) => item.product.name === 'Kettle')

    expect(headphoneLine?.lineTotal).toBe('59.97')
    expect(kettleLine?.lineTotal).toBe('20.20')
    expect(response.body.data.summary.itemCount).toBe(5)
    expect(response.body.data.summary.subtotal).toBe('80.17')
  })

  it('returns two-decimal totals for mixed quantities and prices', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const first = await createTestProduct({
      categoryId: category.id,
      name: 'A',
      price: '0.15',
      quantity: 10,
    })
    const second = await createTestProduct({
      categoryId: category.id,
      name: 'B',
      price: '10.10',
      quantity: 10,
    })

    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: first.id, quantity: 3 })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: second.id, quantity: 2 })

    const response = await request(app).get('/api/cart').set('Cookie', cookies)

    expect(response.body.data.summary.subtotal).toBe('20.65')
  })
})

describe('cart isolation', () => {
  it('does not include another user items on GET', async () => {
    const firstCookies = await registerCustomer()
    const secondEmail = uniqueEmail()
    await prisma.user.create({
      data: {
        firstName: 'Other',
        lastName: 'User',
        email: secondEmail,
        passwordHash: await hashPassword(password),
        role: 'CUSTOMER',
      },
    })
    const secondCookies = await loginExisting(secondEmail)
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })

    await request(app)
      .post('/api/cart/items')
      .set('Cookie', firstCookies)
      .send({ productId: product.id, quantity: 2 })

    const response = await request(app)
      .get('/api/cart')
      .set('Cookie', secondCookies)

    expect(response.status).toBe(200)
    expect(response.body.data.items).toEqual([])
    expect(response.body.data.summary.itemCount).toBe(0)
  })
})
