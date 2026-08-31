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
const createdPromotionIds: string[] = []

function uniqueSuffix(): string {
  return randomUUID().slice(0, 8).toUpperCase()
}

function uniqueEmail(prefix = 'phase11-chk'): string {
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

function isoFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

async function loginAdmin() {
  const email = uniqueEmail('phase11-chk-admin')
  const user = await prisma.user.create({
    data: {
      firstName: 'Promo',
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

async function registerCustomer() {
  const email = uniqueEmail()
  const response = await request(app).post('/api/auth/register').send({
    firstName: 'Promo',
    lastName: 'Buyer',
    email,
    password,
  })
  return cookieHeader(response)
}

async function createAddress(cookies: string[]) {
  const response = await request(app)
    .post('/api/addresses')
    .set('Cookie', cookies)
    .send({
      firstName: 'Promo',
      lastName: 'Buyer',
      addressLine1: '10 Example Street',
      suburb: 'Melbourne',
      state: 'VIC',
      postcode: '3000',
      country: 'Australia',
    })
  return response.body.data as { id: string }
}

async function createTestCategory() {
  const suffix = uniqueSuffix()
  const category = await prisma.category.create({
    data: {
      name: `Phase11 Checkout ${suffix}`,
      slug: `phase11-chk-${suffix.toLowerCase()}`,
    },
  })
  createdCategoryIds.push(category.id)
  return category
}

async function createTestProduct(options: {
  categoryId: string
  price?: string
  quantity?: number
}) {
  const suffix = uniqueSuffix()
  const product = await prisma.product.create({
    data: {
      name: `Phase11 Checkout ${suffix}`,
      slug: `phase11-chk-product-${suffix.toLowerCase()}`,
      description: 'Phase 11 checkout product',
      sku: `P11C-${suffix}`,
      price: options.price ?? '100.00',
      isActive: true,
      categoryId: options.categoryId,
      inventory: {
        create: { quantity: options.quantity ?? 8, lowStockThreshold: 2 },
      },
    },
  })
  createdProductIds.push(product.id)
  return product
}

async function createPromotion(
  adminCookies: string[],
  overrides: Record<string, unknown> = {},
) {
  const response = await request(app)
    .post('/api/admin/promotions')
    .set('Cookie', adminCookies)
    .send({
      code: `CHK-${uniqueSuffix()}`,
      description: 'Checkout promotion',
      discountType: 'PERCENTAGE',
      discountValue: '10.00',
      minimumOrderValue: null,
      startsAt: isoFromNow(-1),
      endsAt: isoFromNow(24),
      isActive: true,
      ...overrides,
    })
  createdPromotionIds.push(response.body.data.id)
  return response.body.data as { id: string; code: string }
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

  if (createdPromotionIds.length > 0) {
    await prisma.promotion.deleteMany({
      where: { id: { in: [...createdPromotionIds] } },
    })
    createdPromotionIds.length = 0
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

describe('checkout promotions', () => {
  it('checks out without a promotion code exactly as before', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '64.00',
      quantity: 5,
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id })

    expect(response.status).toBe(201)
    expect(response.body.data.subtotal).toBe('64.00')
    expect(response.body.data.discountAmount).toBe('0.00')
    expect(response.body.data.shippingAmount).toBe('0.00')
    expect(response.body.data.total).toBe('64.00')
    expect(response.body.data.promotionCode).toBeNull()
  })

  it('applies a percentage promotion and stores a snapshot', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '100.00',
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const promo = await createPromotion(adminCookies, {
      discountType: 'PERCENTAGE',
      discountValue: '10.00',
    })

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id, promotionCode: promo.code.toLowerCase() })

    expect(response.status).toBe(201)
    expect(response.body.data.subtotal).toBe('100.00')
    expect(response.body.data.discountAmount).toBe('10.00')
    expect(response.body.data.shippingAmount).toBe('0.00')
    expect(response.body.data.total).toBe('90.00')
    expect(response.body.data.promotionCode).toBe(promo.code)

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: response.body.data.id },
    })
    expect(stored.promotionCode).toBe(promo.code)
    expect(stored.discountAmount.toFixed(2)).toBe('10.00')
    expect(stored.total.toFixed(2)).toBe('90.00')
  })

  it('applies a fixed promotion', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '80.00',
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const promo = await createPromotion(adminCookies, {
      discountType: 'FIXED_AMOUNT',
      discountValue: '20.00',
    })

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id, promotionCode: promo.code })

    expect(response.status).toBe(201)
    expect(response.body.data.discountAmount).toBe('20.00')
    expect(response.body.data.total).toBe('60.00')
    expect(response.body.data.promotionCode).toBe(promo.code)
  })

  it('enforces the minimum order on checkout', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '40.00',
      quantity: 4,
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const promo = await createPromotion(adminCookies, {
      minimumOrderValue: '50.00',
    })

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id, promotionCode: promo.code })

    expect(response.status).toBe(409)
    expect(response.body.error.message).toBe(
      'This promotion requires a minimum order of A$50.00.',
    )
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }))
        .quantity,
    ).toBe(4)
    const cart = await request(app).get('/api/cart').set('Cookie', cookies)
    expect(cart.body.data.items).toHaveLength(1)
  })

  it('rejects expired, upcoming, disabled, and unknown codes without creating an order', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 5,
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })

    const expired = await createPromotion(adminCookies, {
      startsAt: isoFromNow(-8),
      endsAt: isoFromNow(-1),
    })
    const upcoming = await createPromotion(adminCookies, {
      startsAt: isoFromNow(2),
      endsAt: isoFromNow(8),
    })
    const disabled = await createPromotion(adminCookies, { isActive: false })

    for (const [code, message] of [
      [expired.code, 'This promotion has expired.'],
      [upcoming.code, 'This promotion has not started yet.'],
      [disabled.code, 'This promotion is currently disabled.'],
    ] as const) {
      const response = await request(app)
        .post('/api/orders')
        .set('Cookie', cookies)
        .send({ addressId: address.id, promotionCode: code })
      expect(response.status).toBe(409)
      expect(response.body.error.message).toBe(message)
    }

    const unknown = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id, promotionCode: `NONE-${uniqueSuffix()}` })
    expect(unknown.status).toBe(404)

    expect(await prisma.order.count({
      where: { user: { email: { startsWith: 'phase11-chk-' } } },
    })).toBe(0)
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }))
        .quantity,
    ).toBe(5)
    expect(
      await prisma.inventoryMovement.count({
        where: { productId: product.id, type: 'ORDER_PLACED' },
      }),
    ).toBe(0)
    const cart = await request(app).get('/api/cart').set('Cookie', cookies)
    expect(cart.body.data.items).toHaveLength(1)
  })

  it('caps a fixed promotion at the subtotal', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '20.00',
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const promo = await createPromotion(adminCookies, {
      discountType: 'FIXED_AMOUNT',
      discountValue: '50.00',
    })

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id, promotionCode: promo.code })

    expect(response.status).toBe(201)
    expect(response.body.data.discountAmount).toBe('20.00')
    expect(response.body.data.total).toBe('0.00')
  })

  it('rejects extra discount fields and stacked promotion payloads', async () => {
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const extra = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({
        addressId: address.id,
        promotionCode: 'SAVE10',
        discountAmount: '99.00',
        total: '1.00',
      })
    expect(extra.status).toBe(400)

    const stacked = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({
        addressId: address.id,
        promotionCode: ['SAVE10', 'SAVE20'],
      })
    expect(stacked.status).toBe(400)
  })
})

describe('stale promotion preview', () => {
  it('revalidates at checkout after a previously valid code is disabled', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '100.00',
      quantity: 7,
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const promo = await createPromotion(adminCookies)

    const preview = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: promo.code })
    expect(preview.status).toBe(200)
    expect(preview.body.data.discountAmount).toBe('10.00')

    await request(app)
      .patch(`/api/admin/promotions/${promo.id}`)
      .set('Cookie', adminCookies)
      .send({ isActive: false })

    const checkout = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id, promotionCode: promo.code })

    expect(checkout.status).toBe(409)
    expect(checkout.body.error.message).toBe(
      'This promotion is currently disabled.',
    )
    expect(
      await prisma.order.count({
        where: { user: { email: { startsWith: 'phase11-chk-' } } },
      }),
    ).toBe(0)
    const cart = await request(app).get('/api/cart').set('Cookie', cookies)
    expect(cart.body.data.items).toHaveLength(1)
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }))
        .quantity,
    ).toBe(7)
    expect(
      await prisma.inventoryMovement.count({
        where: { productId: product.id, type: 'ORDER_PLACED' },
      }),
    ).toBe(0)
  })
})

describe('historical promotion snapshot', () => {
  it('does not recalculate a placed order after the promotion is edited', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '100.00',
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const promo = await createPromotion(adminCookies, { discountValue: '10.00' })

    const created = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id, promotionCode: promo.code })
    expect(created.status).toBe(201)

    await request(app)
      .patch(`/api/admin/promotions/${promo.id}`)
      .set('Cookie', adminCookies)
      .send({ discountValue: '50.00', description: 'Changed later' })

    const detail = await request(app)
      .get(`/api/orders/${created.body.data.id}`)
      .set('Cookie', cookies)
    expect(detail.body.data.promotionCode).toBe(promo.code)
    expect(detail.body.data.discountAmount).toBe('10.00')
    expect(detail.body.data.total).toBe('90.00')

    const adminDetail = await request(app)
      .get(`/api/admin/orders/${created.body.data.id}`)
      .set('Cookie', adminCookies)
    expect(adminDetail.body.data.promotionCode).toBe(promo.code)
    expect(adminDetail.body.data.discountAmount).toBe('10.00')
    expect(adminDetail.body.data.total).toBe('90.00')
  })
})

describe('discounted order cancellation', () => {
  it('restocks once and keeps the promotion snapshot', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const address = await createAddress(cookies)
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '100.00',
      quantity: 5,
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 2 })
    const promo = await createPromotion(adminCookies)

    const created = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.id, promotionCode: promo.code })
    expect(created.status).toBe(201)
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }))
        .quantity,
    ).toBe(3)

    const cancelled = await request(app)
      .patch(`/api/admin/orders/${created.body.data.id}/status`)
      .set('Cookie', adminCookies)
      .send({ status: 'CANCELLED' })
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.data.promotionCode).toBe(promo.code)
    expect(cancelled.body.data.discountAmount).toBe('20.00')
    expect(cancelled.body.data.total).toBe('180.00')
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }))
        .quantity,
    ).toBe(5)
    expect(
      await prisma.inventoryMovement.count({
        where: {
          productId: product.id,
          type: 'ORDER_CANCELLED',
          referenceId: created.body.data.id,
        },
      }),
    ).toBe(1)

    const repeat = await request(app)
      .patch(`/api/admin/orders/${created.body.data.id}/status`)
      .set('Cookie', adminCookies)
      .send({ status: 'CANCELLED' })
    expect(repeat.status).toBe(409)
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }))
        .quantity,
    ).toBe(5)
  })
})
