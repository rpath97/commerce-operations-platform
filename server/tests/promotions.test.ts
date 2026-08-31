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

function uniqueEmail(prefix = 'phase11-promo'): string {
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
  const email = uniqueEmail('phase11-admin')
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
  const email = uniqueEmail('phase11-cust')
  const response = await request(app).post('/api/auth/register').send({
    firstName: 'Promo',
    lastName: 'Customer',
    email,
    password,
  })
  return cookieHeader(response)
}

async function createTestCategory() {
  const suffix = uniqueSuffix()
  const category = await prisma.category.create({
    data: {
      name: `Phase11 Cat ${suffix}`,
      slug: `phase11-cat-${suffix.toLowerCase()}`,
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
      name: `Phase11 Product ${suffix}`,
      slug: `phase11-product-${suffix.toLowerCase()}`,
      description: 'Phase 11 test product',
      sku: `P11-${suffix}`,
      price: options.price ?? '40.00',
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

function trackPromotionId(id: string): string {
  createdPromotionIds.push(id)
  return id
}

function validCreateBody(overrides: Record<string, unknown> = {}) {
  const suffix = uniqueSuffix()
  return {
    code: `SAVE-${suffix}`,
    description: 'Phase 11 test promotion',
    discountType: 'PERCENTAGE',
    discountValue: '10.00',
    minimumOrderValue: '20.00',
    startsAt: isoFromNow(-1),
    endsAt: isoFromNow(24),
    isActive: true,
    ...overrides,
  }
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

describe('admin promotion authorization', () => {
  it('rejects guest admin promotion list', async () => {
    const response = await request(app).get('/api/admin/promotions')
    expect(response.status).toBe(401)
  })

  it('rejects CUSTOMER admin promotion list', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .get('/api/admin/promotions')
      .set('Cookie', cookies)
    expect(response.status).toBe(403)
  })

  it('allows ADMIN to list promotions', async () => {
    const { cookies } = await loginAdmin()
    const response = await request(app)
      .get('/api/admin/promotions')
      .set('Cookie', cookies)
    expect(response.status).toBe(200)
    expect(Array.isArray(response.body.data)).toBe(true)
  })

  it('rejects guest promotion create', async () => {
    const response = await request(app)
      .post('/api/admin/promotions')
      .send(validCreateBody())
    expect(response.status).toBe(401)
  })

  it('rejects CUSTOMER promotion create', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(validCreateBody())
    expect(response.status).toBe(403)
  })

  it('rejects guest promotion update', async () => {
    const response = await request(app)
      .patch(`/api/admin/promotions/${randomUUID()}`)
      .send({ description: 'Nope' })
    expect(response.status).toBe(401)
  })

  it('rejects CUSTOMER promotion update', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .patch(`/api/admin/promotions/${randomUUID()}`)
      .set('Cookie', cookies)
      .send({ description: 'Nope' })
    expect(response.status).toBe(403)
  })
})

describe('POST /api/admin/promotions', () => {
  it('creates a percentage promotion', async () => {
    const { cookies } = await loginAdmin()
    const body = validCreateBody({
      discountType: 'PERCENTAGE',
      discountValue: '15.00',
    })
    const response = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(body)

    expect(response.status).toBe(201)
    trackPromotionId(response.body.data.id)
    expect(response.body.data.discountType).toBe('PERCENTAGE')
    expect(response.body.data.discountValue).toBe('15.00')
    expect(response.body.data.minimumOrderValue).toBe('20.00')
    expect(response.body.data.status).toBe('ACTIVE')
    expect(response.body.data).not.toHaveProperty('userId')
  })

  it('creates a fixed promotion', async () => {
    const { cookies } = await loginAdmin()
    const response = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(
        validCreateBody({
          discountType: 'FIXED_AMOUNT',
          discountValue: '12.50',
        }),
      )

    expect(response.status).toBe(201)
    trackPromotionId(response.body.data.id)
    expect(response.body.data.discountType).toBe('FIXED_AMOUNT')
    expect(response.body.data.discountValue).toBe('12.50')
  })

  it('normalizes codes to uppercase and trims whitespace', async () => {
    const { cookies } = await loginAdmin()
    const suffix = uniqueSuffix()
    const response = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(validCreateBody({ code: `  save-${suffix.toLowerCase()}  ` }))

    expect(response.status).toBe(201)
    trackPromotionId(response.body.data.id)
    expect(response.body.data.code).toBe(`SAVE-${suffix}`)
  })

  it('rejects a duplicate normalized code', async () => {
    const { cookies } = await loginAdmin()
    const suffix = uniqueSuffix()
    const first = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(validCreateBody({ code: `DUP-${suffix}` }))
    trackPromotionId(first.body.data.id)

    const second = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(validCreateBody({ code: `dup-${suffix.toLowerCase()}` }))

    expect(second.status).toBe(409)
    expect(second.body.error.message).toBe(
      'A promotion with this code already exists.',
    )
  })

  it('rejects percentage 0', async () => {
    const { cookies } = await loginAdmin()
    const response = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(validCreateBody({ discountValue: '0.00' }))
    expect(response.status).toBe(400)
  })

  it('rejects percentage greater than 100', async () => {
    const { cookies } = await loginAdmin()
    const response = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(validCreateBody({ discountValue: '100.01' }))
    expect(response.status).toBe(400)
  })

  it('rejects a zero fixed discount', async () => {
    const { cookies } = await loginAdmin()
    const response = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(
        validCreateBody({
          discountType: 'FIXED_AMOUNT',
          discountValue: '0',
        }),
      )
    expect(response.status).toBe(400)
  })

  it('rejects a negative fixed discount', async () => {
    const { cookies } = await loginAdmin()
    const response = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(
        validCreateBody({
          discountType: 'FIXED_AMOUNT',
          discountValue: '-5.00',
        }),
      )
    expect(response.status).toBe(400)
  })

  it('rejects a negative minimum order value', async () => {
    const { cookies } = await loginAdmin()
    const response = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(validCreateBody({ minimumOrderValue: '-1.00' }))
    expect(response.status).toBe(400)
  })

  it('rejects an end date that is not after the start date', async () => {
    const { cookies } = await loginAdmin()
    const start = isoFromNow(2)
    const same = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(validCreateBody({ startsAt: start, endsAt: start }))
    expect(same.status).toBe(400)

    const reversed = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(validCreateBody({ startsAt: isoFromNow(5), endsAt: isoFromNow(1) }))
    expect(reversed.status).toBe(400)
  })

  it('allows an optional description', async () => {
    const { cookies } = await loginAdmin()
    const response = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(validCreateBody({ description: undefined }))
    expect(response.status).toBe(201)
    trackPromotionId(response.body.data.id)
    expect(response.body.data.description).toBeNull()
  })

  it('rejects unexpected fields', async () => {
    const { cookies } = await loginAdmin()
    const response = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send({
        ...validCreateBody(),
        status: 'ACTIVE',
        userId: randomUUID(),
      })
    expect(response.status).toBe(400)
  })

  it('writes PROMOTION_CREATED with the admin actor', async () => {
    const { cookies, user } = await loginAdmin()
    const response = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(validCreateBody({ code: `AUD-${uniqueSuffix()}` }))
    expect(response.status).toBe(201)
    trackPromotionId(response.body.data.id)

    const log = await prisma.auditLog.findFirst({
      where: { entityType: 'Promotion', entityId: response.body.data.id },
    })
    expect(log).toMatchObject({
      userId: user.id,
      action: 'PROMOTION_CREATED',
      entityType: 'Promotion',
    })
    expect(log?.metadata).toMatchObject({
      code: response.body.data.code,
      discountType: 'PERCENTAGE',
      isActive: true,
    })
  })
})

describe('PATCH /api/admin/promotions/:promotionId', () => {
  async function createPromo(
    cookies: string[],
    overrides: Record<string, unknown> = {},
  ) {
    const response = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', cookies)
      .send(validCreateBody(overrides))
    trackPromotionId(response.body.data.id)
    return response.body.data as { id: string; code: string }
  }

  it('edits the description', async () => {
    const { cookies } = await loginAdmin()
    const promo = await createPromo(cookies)
    const response = await request(app)
      .patch(`/api/admin/promotions/${promo.id}`)
      .set('Cookie', cookies)
      .send({ description: 'Updated copy' })
    expect(response.status).toBe(200)
    expect(response.body.data.description).toBe('Updated copy')
  })

  it('edits the code', async () => {
    const { cookies } = await loginAdmin()
    const promo = await createPromo(cookies)
    const next = `EDIT-${uniqueSuffix()}`
    const response = await request(app)
      .patch(`/api/admin/promotions/${promo.id}`)
      .set('Cookie', cookies)
      .send({ code: next.toLowerCase() })
    expect(response.status).toBe(200)
    expect(response.body.data.code).toBe(next)
  })

  it('rejects a duplicate code on update', async () => {
    const { cookies } = await loginAdmin()
    const first = await createPromo(cookies)
    const second = await createPromo(cookies)
    const response = await request(app)
      .patch(`/api/admin/promotions/${second.id}`)
      .set('Cookie', cookies)
      .send({ code: first.code.toLowerCase() })
    expect(response.status).toBe(409)
    expect(response.body.error.message).toBe(
      'A promotion with this code already exists.',
    )
  })

  it('edits dates', async () => {
    const { cookies } = await loginAdmin()
    const promo = await createPromo(cookies)
    const startsAt = isoFromNow(2)
    const endsAt = isoFromNow(10)
    const response = await request(app)
      .patch(`/api/admin/promotions/${promo.id}`)
      .set('Cookie', cookies)
      .send({ startsAt, endsAt })
    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('UPCOMING')
  })

  it('validates merged start and end dates', async () => {
    const { cookies } = await loginAdmin()
    const startsAt = isoFromNow(10)
    const promo = await createPromo(cookies, {
      startsAt,
      endsAt: isoFromNow(20),
    })
    const response = await request(app)
      .patch(`/api/admin/promotions/${promo.id}`)
      .set('Cookie', cookies)
      .send({ endsAt: isoFromNow(2) })
    expect(response.status).toBe(400)
  })

  it('validates percentage after a type change using merged state', async () => {
    const { cookies } = await loginAdmin()
    const promo = await createPromo(cookies, {
      discountType: 'FIXED_AMOUNT',
      discountValue: '150.00',
    })
    const response = await request(app)
      .patch(`/api/admin/promotions/${promo.id}`)
      .set('Cookie', cookies)
      .send({ discountType: 'PERCENTAGE' })
    expect(response.status).toBe(400)
  })

  it('deactivates a promotion', async () => {
    const { cookies, user } = await loginAdmin()
    const promo = await createPromo(cookies)
    const response = await request(app)
      .patch(`/api/admin/promotions/${promo.id}`)
      .set('Cookie', cookies)
      .send({ isActive: false })
    expect(response.status).toBe(200)
    expect(response.body.data.isActive).toBe(false)
    expect(response.body.data.status).toBe('DISABLED')

    const log = await prisma.auditLog.findFirst({
      where: {
        entityId: promo.id,
        action: 'PROMOTION_DEACTIVATED',
      },
    })
    expect(log?.userId).toBe(user.id)
  })

  it('reactivates a promotion', async () => {
    const { cookies, user } = await loginAdmin()
    const promo = await createPromo(cookies, { isActive: false })
    const response = await request(app)
      .patch(`/api/admin/promotions/${promo.id}`)
      .set('Cookie', cookies)
      .send({ isActive: true })
    expect(response.status).toBe(200)
    expect(response.body.data.isActive).toBe(true)
    expect(response.body.data.status).toBe('ACTIVE')

    const log = await prisma.auditLog.findFirst({
      where: {
        entityId: promo.id,
        action: 'PROMOTION_ACTIVATED',
      },
    })
    expect(log?.userId).toBe(user.id)
  })

  it('writes PROMOTION_UPDATED when other fields change', async () => {
    const { cookies } = await loginAdmin()
    const promo = await createPromo(cookies)
    await request(app)
      .patch(`/api/admin/promotions/${promo.id}`)
      .set('Cookie', cookies)
      .send({ description: 'Field edit' })

    const log = await prisma.auditLog.findFirst({
      where: { entityId: promo.id, action: 'PROMOTION_UPDATED' },
    })
    expect(log).not.toBeNull()
  })

  it('rejects a malformed promotion UUID', async () => {
    const { cookies } = await loginAdmin()
    const response = await request(app)
      .patch('/api/admin/promotions/not-a-uuid')
      .set('Cookie', cookies)
      .send({ description: 'Nope' })
    expect(response.status).toBe(400)
  })

  it('returns 404 for a missing promotion', async () => {
    const { cookies } = await loginAdmin()
    const response = await request(app)
      .patch(`/api/admin/promotions/${randomUUID()}`)
      .set('Cookie', cookies)
      .send({ description: 'Nope' })
    expect(response.status).toBe(404)
  })
})

describe('GET /api/admin/promotions', () => {
  it('lists, searches, filters, sorts, and paginates after filters', async () => {
    const { cookies } = await loginAdmin()
    const token = uniqueSuffix()

    const created = []
    for (const item of [
      {
        code: `ACT-${token}`,
        description: `Alpha window ${token}`,
        discountType: 'PERCENTAGE',
        discountValue: '10.00',
        startsAt: isoFromNow(-2),
        endsAt: isoFromNow(12),
        isActive: true,
      },
      {
        code: `UPC-${token}`,
        description: `Beta later ${token}`,
        discountType: 'PERCENTAGE',
        discountValue: '12.00',
        startsAt: isoFromNow(12),
        endsAt: isoFromNow(24),
        isActive: true,
      },
      {
        code: `EXP-${token}`,
        description: `Gamma ended ${token}`,
        discountType: 'FIXED_AMOUNT',
        discountValue: '5.00',
        startsAt: isoFromNow(-24),
        endsAt: isoFromNow(-1),
        isActive: true,
      },
      {
        code: `DIS-${token}`,
        description: `Delta off ${token}`,
        discountType: 'FIXED_AMOUNT',
        discountValue: '8.00',
        startsAt: isoFromNow(-2),
        endsAt: isoFromNow(12),
        isActive: false,
      },
    ]) {
      const response = await request(app)
        .post('/api/admin/promotions')
        .set('Cookie', cookies)
        .send(validCreateBody(item))
      trackPromotionId(response.body.data.id)
      created.push(response.body.data)
    }

    const listed = await request(app)
      .get('/api/admin/promotions')
      .query({ search: token, sort: 'code-asc' })
      .set('Cookie', cookies)
    expect(listed.status).toBe(200)
    expect(listed.body.pagination.total).toBe(4)
    expect(listed.body.pagination.totalPages).toBe(1)
    expect(listed.body.data.map((row: { code: string }) => row.code)).toEqual([
      `ACT-${token}`,
      `DIS-${token}`,
      `EXP-${token}`,
      `UPC-${token}`,
    ])
    expect(listed.body.data[0].status).toBe('ACTIVE')

    const byDescription = await request(app)
      .get('/api/admin/promotions')
      .query({ search: `Beta later ${token}` })
      .set('Cookie', cookies)
    expect(byDescription.body.pagination.total).toBe(1)
    expect(byDescription.body.data[0].code).toBe(`UPC-${token}`)

    const active = await request(app)
      .get('/api/admin/promotions')
      .query({ search: token, status: 'active' })
      .set('Cookie', cookies)
    expect(active.body.pagination.total).toBe(1)
    expect(active.body.data[0].status).toBe('ACTIVE')

    const upcoming = await request(app)
      .get('/api/admin/promotions')
      .query({ search: token, status: 'upcoming' })
      .set('Cookie', cookies)
    expect(upcoming.body.data[0].status).toBe('UPCOMING')

    const expired = await request(app)
      .get('/api/admin/promotions')
      .query({ search: token, status: 'expired' })
      .set('Cookie', cookies)
    expect(expired.body.data[0].status).toBe('EXPIRED')

    const disabled = await request(app)
      .get('/api/admin/promotions')
      .query({ search: token, status: 'disabled' })
      .set('Cookie', cookies)
    expect(disabled.body.data[0].status).toBe('DISABLED')

    const percentage = await request(app)
      .get('/api/admin/promotions')
      .query({ search: token, discountType: 'percentage' })
      .set('Cookie', cookies)
    expect(percentage.body.pagination.total).toBe(2)

    const fixed = await request(app)
      .get('/api/admin/promotions')
      .query({ search: token, discountType: 'fixed' })
      .set('Cookie', cookies)
    expect(fixed.body.pagination.total).toBe(2)

    const page1 = await request(app)
      .get('/api/admin/promotions')
      .query({ search: token, sort: 'code-asc', limit: 2, page: 1 })
      .set('Cookie', cookies)
    const page2 = await request(app)
      .get('/api/admin/promotions')
      .query({ search: token, sort: 'code-asc', limit: 2, page: 2 })
      .set('Cookie', cookies)
    expect(page1.body.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 4,
      totalPages: 2,
    })
    expect(page1.body.data).toHaveLength(2)
    expect(page2.body.data).toHaveLength(2)
    expect([
      ...page1.body.data.map((row: { id: string }) => row.id),
      ...page2.body.data.map((row: { id: string }) => row.id),
    ]).toHaveLength(4)

    const unexpected = await request(app)
      .get('/api/admin/promotions')
      .query({ unexpected: 'yes' })
      .set('Cookie', cookies)
    expect(unexpected.status).toBe(400)

    expect(created).toHaveLength(4)
  })
})

describe('POST /api/promotions/validate', () => {
  it('rejects a guest validation request', async () => {
    const response = await request(app)
      .post('/api/promotions/validate')
      .send({ code: 'SAVE10' })
    expect(response.status).toBe(401)
  })

  it('allows an authenticated customer to validate a percentage code', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '120.00',
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })

    const created = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', adminCookies)
      .send(
        validCreateBody({
          code: `PCT-${uniqueSuffix()}`,
          discountType: 'PERCENTAGE',
          discountValue: '10.00',
          minimumOrderValue: '50.00',
        }),
      )
    trackPromotionId(created.body.data.id)

    const response = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: created.body.data.code.toLowerCase() })

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      code: created.body.data.code,
      discountType: 'PERCENTAGE',
      discountValue: '10.00',
      minimumOrderValue: '50.00',
      subtotal: '120.00',
      discountAmount: '12.00',
      totalAfterDiscount: '108.00',
    })
  })

  it('validates a fixed amount promotion', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '80.00',
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const created = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', adminCookies)
      .send(
        validCreateBody({
          discountType: 'FIXED_AMOUNT',
          discountValue: '20.00',
          minimumOrderValue: null,
        }),
      )
    trackPromotionId(created.body.data.id)

    const response = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: created.body.data.code })
    expect(response.body.data.discountAmount).toBe('20.00')
    expect(response.body.data.totalAfterDiscount).toBe('60.00')
  })

  it('returns 404 for an unknown code', async () => {
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })

    const response = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: `NONE-${uniqueSuffix()}` })
    expect(response.status).toBe(404)
    expect(response.body.error.message).toBe('Promotion code was not found.')
  })

  it('rejects disabled, upcoming, and expired promotions', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })

    const disabled = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', adminCookies)
      .send(validCreateBody({ isActive: false }))
    trackPromotionId(disabled.body.data.id)
    const upcoming = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', adminCookies)
      .send(validCreateBody({ startsAt: isoFromNow(2), endsAt: isoFromNow(8) }))
    trackPromotionId(upcoming.body.data.id)
    const expired = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', adminCookies)
      .send(validCreateBody({ startsAt: isoFromNow(-8), endsAt: isoFromNow(-1) }))
    trackPromotionId(expired.body.data.id)

    const disabledRes = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: disabled.body.data.code })
    expect(disabledRes.status).toBe(409)
    expect(disabledRes.body.error.message).toBe(
      'This promotion is currently disabled.',
    )

    const upcomingRes = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: upcoming.body.data.code })
    expect(upcomingRes.status).toBe(409)
    expect(upcomingRes.body.error.message).toBe(
      'This promotion has not started yet.',
    )

    const expiredRes = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: expired.body.data.code })
    expect(expiredRes.status).toBe(409)
    expect(expiredRes.body.error.message).toBe('This promotion has expired.')
  })

  it('enforces minimum order value against the current merchandise subtotal', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '40.00',
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const created = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', adminCookies)
      .send(validCreateBody({ minimumOrderValue: '50.00' }))
    trackPromotionId(created.body.data.id)

    const tooLow = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: created.body.data.code })
    expect(tooLow.status).toBe(409)
    expect(tooLow.body.error.message).toBe(
      'This promotion requires a minimum order of A$50.00.',
    )

    await request(app)
      .patch(`/api/cart/items/${(await request(app).get('/api/cart').set('Cookie', cookies)).body.data.items[0].id}`)
      .set('Cookie', cookies)
      .send({ quantity: 2 })

    const equal = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', adminCookies)
      .send(validCreateBody({ minimumOrderValue: '80.00' }))
    trackPromotionId(equal.body.data.id)
    const ok = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: equal.body.data.code })
    expect(ok.status).toBe(200)
    expect(ok.body.data.subtotal).toBe('80.00')
  })

  it('clamps a fixed discount to the subtotal and never goes negative', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '20.00',
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const created = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', adminCookies)
      .send(
        validCreateBody({
          discountType: 'FIXED_AMOUNT',
          discountValue: '50.00',
          minimumOrderValue: null,
        }),
      )
    trackPromotionId(created.body.data.id)

    const response = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: created.body.data.code })
    expect(response.body.data.discountAmount).toBe('20.00')
    expect(response.body.data.totalAfterDiscount).toBe('0.00')
  })

  it('rounds a percentage preview to two decimals', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '33.33',
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    const created = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', adminCookies)
      .send(
        validCreateBody({
          discountValue: '15.00',
          minimumOrderValue: null,
        }),
      )
    trackPromotionId(created.body.data.id)

    const response = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: created.body.data.code })
    expect(response.body.data.discountAmount).toBe('5.00')
    expect(response.body.data.totalAfterDiscount).toBe('28.33')
  })

  it('rejects an empty cart, malformed codes, and extra fields', async () => {
    const cookies = await registerCustomer()
    const empty = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: 'SAVE10' })
    expect(empty.status).toBe(409)

    const malformed = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: 'BAD CODE' })
    expect(malformed.status).toBe(400)

    const extra = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: 'SAVE10', subtotal: '500.00' })
    expect(extra.status).toBe(400)
  })

  it('uses current database prices and does not mutate inventory, orders, or movements', async () => {
    const { cookies: adminCookies } = await loginAdmin()
    const cookies = await registerCustomer()
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      price: '40.00',
      quantity: 6,
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity: 1 })
    await prisma.product.update({
      where: { id: product.id },
      data: { price: '100.00' },
    })
    const created = await request(app)
      .post('/api/admin/promotions')
      .set('Cookie', adminCookies)
      .send(validCreateBody({ discountValue: '10.00', minimumOrderValue: null }))
    trackPromotionId(created.body.data.id)

    const beforeOrders = await prisma.order.count()
    const beforeMovements = await prisma.inventoryMovement.count({
      where: { productId: product.id },
    })

    const response = await request(app)
      .post('/api/promotions/validate')
      .set('Cookie', cookies)
      .send({ code: created.body.data.code })
    expect(response.body.data.subtotal).toBe('100.00')
    expect(response.body.data.discountAmount).toBe('10.00')

    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }))
        .quantity,
    ).toBe(6)
    expect(await prisma.order.count()).toBe(beforeOrders)
    expect(
      await prisma.inventoryMovement.count({ where: { productId: product.id } }),
    ).toBe(beforeMovements)
    const cart = await request(app).get('/api/cart').set('Cookie', cookies)
    expect(cart.body.data.items).toHaveLength(1)
  })
})
