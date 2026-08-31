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

function uniqueEmail(prefix = 'phase10-inv'): string {
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
  const email = uniqueEmail('phase10-admin')
  const user = await prisma.user.create({
    data: {
      firstName: 'Inv',
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

async function loginCustomer() {
  const email = uniqueEmail('phase10-cust')
  const response = await request(app).post('/api/auth/register').send({
    firstName: 'Inv',
    lastName: 'Customer',
    email,
    password,
  })
  return cookieHeader(response)
}

async function createCategory() {
  const suffix = uniqueSuffix()
  const category = await prisma.category.create({
    data: {
      name: `Phase10 Cat ${suffix}`,
      slug: `phase10-cat-${suffix}`,
    },
  })
  createdCategoryIds.push(category.id)
  return category
}

async function createProduct(options: {
  categoryId: string
  name?: string
  sku?: string
  quantity?: number
  lowStockThreshold?: number
  isActive?: boolean
}) {
  const suffix = uniqueSuffix()
  const product = await prisma.product.create({
    data: {
      name: options.name ?? `Phase10 Product ${suffix}`,
      slug: `phase10-product-${suffix}`,
      description: 'Phase 10 inventory product',
      sku: options.sku ?? `P10-${suffix}`,
      price: '20.00',
      isActive: options.isActive ?? true,
      categoryId: options.categoryId,
      inventory: {
        create: {
          quantity: options.quantity ?? 10,
          lowStockThreshold: options.lowStockThreshold ?? 5,
        },
      },
    },
  })
  createdProductIds.push(product.id)
  return product
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

describe('admin inventory access', () => {
  const productId = randomUUID()

  it('rejects guest inventory list, receive, adjust, threshold, and history', async () => {
    const responses = await Promise.all([
      request(app).get('/api/admin/inventory'),
      request(app).post(`/api/admin/inventory/${productId}/receive`).send({
        quantity: 1,
      }),
      request(app).post(`/api/admin/inventory/${productId}/adjust`).send({
        quantityDelta: 1,
        reason: 'Test adjustment',
      }),
      request(app).patch(`/api/admin/inventory/${productId}/settings`).send({
        lowStockThreshold: 4,
      }),
      request(app).get(`/api/admin/inventory/${productId}/movements`),
    ])
    for (const response of responses) {
      expect(response.status).toBe(401)
    }
  })

  it('rejects customer inventory list, receive, adjust, threshold, and history', async () => {
    const cookies = await loginCustomer()
    const responses = await Promise.all([
      request(app).get('/api/admin/inventory').set('Cookie', cookies),
      request(app)
        .post(`/api/admin/inventory/${productId}/receive`)
        .set('Cookie', cookies)
        .send({ quantity: 1 }),
      request(app)
        .post(`/api/admin/inventory/${productId}/adjust`)
        .set('Cookie', cookies)
        .send({ quantityDelta: 1, reason: 'Test adjustment' }),
      request(app)
        .patch(`/api/admin/inventory/${productId}/settings`)
        .set('Cookie', cookies)
        .send({ lowStockThreshold: 4 }),
      request(app)
        .get(`/api/admin/inventory/${productId}/movements`)
        .set('Cookie', cookies),
    ])
    for (const response of responses) {
      expect(response.status).toBe(403)
    }
  })

  it('allows an admin to list inventory', async () => {
    const { cookies } = await loginAdmin()
    const response = await request(app)
      .get('/api/admin/inventory')
      .set('Cookie', cookies)
    expect(response.status).toBe(200)
  })
})

describe('admin inventory list', () => {
  it('lists inventory with product, quantity, threshold, and stock states', async () => {
    const { cookies } = await loginAdmin()
    const category = await createCategory()
    const other = await createCategory()
    const healthy = await createProduct({
      categoryId: category.id,
      name: 'Phase10 Healthy Mat',
      sku: `HLTH-${uniqueSuffix()}`,
      quantity: 20,
      lowStockThreshold: 5,
    })
    const low = await createProduct({
      categoryId: category.id,
      name: 'Phase10 Low Bottle',
      sku: `LOW-${uniqueSuffix()}`,
      quantity: 3,
      lowStockThreshold: 5,
    })
    const empty = await createProduct({
      categoryId: category.id,
      name: 'Phase10 Empty Mug',
      sku: `OUT-${uniqueSuffix()}`,
      quantity: 0,
    })
    await createProduct({
      categoryId: other.id,
      name: 'Phase10 Archived Item',
      quantity: 8,
      isActive: false,
    })

    const list = await request(app)
      .get('/api/admin/inventory')
      .query({ search: 'Phase10' })
      .set('Cookie', cookies)
    expect(list.status).toBe(200)
    expect(list.body.data.length).toBeGreaterThanOrEqual(4)
    const healthyRow = list.body.data.find(
      (row: { product: { id: string } }) => row.product.id === healthy.id,
    )
    expect(healthyRow.product.category.id).toBe(category.id)
    expect(healthyRow.inventory.quantity).toBe(20)
    expect(healthyRow.inventory.lowStockThreshold).toBe(5)
    expect(healthyRow.inventory.stockStatus).toBe('healthy')
    expect(healthyRow.product.isActive).toBe(true)

    const lowOnly = await request(app)
      .get('/api/admin/inventory')
      .query({ search: 'Phase10 Low', stockStatus: 'low-stock' })
      .set('Cookie', cookies)
    expect(lowOnly.body.data[0].product.id).toBe(low.id)
    expect(lowOnly.body.data[0].inventory.stockStatus).toBe('low-stock')

    const outOnly = await request(app)
      .get('/api/admin/inventory')
      .query({ search: 'Phase10 Empty', stockStatus: 'out-of-stock' })
      .set('Cookie', cookies)
    expect(outOnly.body.data[0].product.id).toBe(empty.id)

    const healthyOnly = await request(app)
      .get('/api/admin/inventory')
      .query({ search: 'Phase10 Healthy', stockStatus: 'healthy' })
      .set('Cookie', cookies)
    expect(healthyOnly.body.data[0].product.id).toBe(healthy.id)

    const bySku = await request(app)
      .get('/api/admin/inventory')
      .query({ search: healthy.sku })
      .set('Cookie', cookies)
    expect(bySku.body.data[0].product.id).toBe(healthy.id)

    const byCategory = await request(app)
      .get('/api/admin/inventory')
      .query({ category: category.slug, search: 'Phase10' })
      .set('Cookie', cookies)
    expect(
      byCategory.body.data.every(
        (row: { product: { category: { id: string } } }) =>
          row.product.category.id === category.id,
      ),
    ).toBe(true)

    const archived = await request(app)
      .get('/api/admin/inventory')
      .query({ productStatus: 'archived', search: 'Phase10' })
      .set('Cookie', cookies)
    expect(
      archived.body.data.every(
        (row: { product: { isActive: boolean } }) => !row.product.isActive,
      ),
    ).toBe(true)

    const page1 = await request(app)
      .get('/api/admin/inventory')
      .query({ search: 'Phase10', limit: 1, page: 1, sort: 'name-asc' })
      .set('Cookie', cookies)
    const page2 = await request(app)
      .get('/api/admin/inventory')
      .query({ search: 'Phase10', limit: 1, page: 2, sort: 'name-asc' })
      .set('Cookie', cookies)
    expect(page1.body.data[0].product.id).not.toBe(page2.body.data[0].product.id)

    const extra = await request(app)
      .get('/api/admin/inventory')
      .query({ unexpected: 'yes' })
      .set('Cookie', cookies)
    expect(extra.status).toBe(400)
  })
})

describe('admin inventory stock-status pagination', () => {
  async function seedPagedStock() {
    const { cookies } = await loginAdmin()
    const category = await createCategory()
    const token = uniqueSuffix()
    const search = `P10Page ${token}`

    const healthy = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        createProduct({
          categoryId: category.id,
          name: `${search} Aaa Healthy ${String(index + 1).padStart(2, '0')}`,
          quantity: 20,
          lowStockThreshold: 5,
        }),
      ),
    )

    const lowStock = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createProduct({
          categoryId: category.id,
          name: `${search} Zzz Low ${String(index + 1).padStart(2, '0')}`,
          quantity: 2,
          lowStockThreshold: 5,
        }),
      ),
    )

    const outOfStock = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createProduct({
          categoryId: category.id,
          name: `${search} Zzz Out ${String(index + 1).padStart(2, '0')}`,
          quantity: 0,
          lowStockThreshold: 5,
        }),
      ),
    )

    return { cookies, search, healthy, lowStock, outOfStock }
  }

  it('paginates the low-stock filtered set and keeps later matches reachable', async () => {
    const { cookies, search, lowStock } = await seedPagedStock()

    const page1 = await request(app)
      .get('/api/admin/inventory')
      .query({
        search,
        stockStatus: 'low-stock',
        limit: 2,
        page: 1,
        sort: 'name-asc',
      })
      .set('Cookie', cookies)

    const page2 = await request(app)
      .get('/api/admin/inventory')
      .query({
        search,
        stockStatus: 'low-stock',
        limit: 2,
        page: 2,
        sort: 'name-asc',
      })
      .set('Cookie', cookies)

    const page3 = await request(app)
      .get('/api/admin/inventory')
      .query({
        search,
        stockStatus: 'low-stock',
        limit: 2,
        page: 3,
        sort: 'name-asc',
      })
      .set('Cookie', cookies)

    expect(page1.status).toBe(200)
    expect(page1.body.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
    })
    expect(page2.body.pagination.total).toBe(5)
    expect(page2.body.pagination.totalPages).toBe(3)
    expect(page1.body.data).toHaveLength(2)
    expect(page2.body.data).toHaveLength(2)
    expect(page3.body.data).toHaveLength(1)
    expect(
      [...page1.body.data, ...page2.body.data, ...page3.body.data].every(
        (row: { inventory: { stockStatus: string } }) =>
          row.inventory.stockStatus === 'low-stock',
      ),
    ).toBe(true)

    const pagedIds = [
      ...page1.body.data,
      ...page2.body.data,
      ...page3.body.data,
    ].map((row: { product: { id: string } }) => row.product.id)
    expect(new Set(pagedIds).size).toBe(5)
    expect(pagedIds.sort()).toEqual([...lowStock.map((item) => item.id)].sort())

    const lastLow = [...lowStock].sort((a, b) => a.name.localeCompare(b.name)).at(-1)
    expect(page3.body.data[0].product.id).toBe(lastLow?.id)
  })

  it('paginates the out-of-stock filtered set', async () => {
    const { cookies, search, outOfStock } = await seedPagedStock()

    const page1 = await request(app)
      .get('/api/admin/inventory')
      .query({
        search,
        stockStatus: 'out-of-stock',
        limit: 2,
        page: 1,
        sort: 'name-asc',
      })
      .set('Cookie', cookies)
    const page3 = await request(app)
      .get('/api/admin/inventory')
      .query({
        search,
        stockStatus: 'out-of-stock',
        limit: 2,
        page: 3,
        sort: 'name-asc',
      })
      .set('Cookie', cookies)

    expect(page1.body.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
    })
    expect(page1.body.data).toHaveLength(2)
    expect(page3.body.data).toHaveLength(1)
    expect(
      page1.body.data.every(
        (row: { inventory: { stockStatus: string; quantity: number } }) =>
          row.inventory.stockStatus === 'out-of-stock' &&
          row.inventory.quantity === 0,
      ),
    ).toBe(true)
    expect(outOfStock.map((item) => item.id)).toContain(
      page3.body.data[0].product.id,
    )
  })

  it('paginates the healthy filtered set and ignores later unfiltered pages', async () => {
    const { cookies, search, healthy, lowStock } = await seedPagedStock()

    const page1 = await request(app)
      .get('/api/admin/inventory')
      .query({
        search,
        stockStatus: 'healthy',
        limit: 3,
        page: 1,
        sort: 'name-asc',
      })
      .set('Cookie', cookies)
    const page3 = await request(app)
      .get('/api/admin/inventory')
      .query({
        search,
        stockStatus: 'healthy',
        limit: 3,
        page: 3,
        sort: 'name-asc',
      })
      .set('Cookie', cookies)

    expect(page1.body.pagination).toEqual({
      page: 1,
      limit: 3,
      total: 8,
      totalPages: 3,
    })
    expect(page1.body.data).toHaveLength(3)
    expect(page3.body.data).toHaveLength(2)
    expect(
      [...page1.body.data, ...page3.body.data].every(
        (row: { inventory: { stockStatus: string } }) =>
          row.inventory.stockStatus === 'healthy',
      ),
    ).toBe(true)

    const unfiltered = await request(app)
      .get('/api/admin/inventory')
      .query({ search, limit: 3, page: 1, sort: 'name-asc' })
      .set('Cookie', cookies)
    expect(
      unfiltered.body.data.every(
        (row: { product: { id: string } }) =>
          healthy.some((item) => item.id === row.product.id),
      ),
    ).toBe(true)

    const lastHealthy = [...healthy].sort((a, b) =>
      a.name.localeCompare(b.name),
    ).at(-1)
    expect(page3.body.data.map((row: { product: { id: string } }) => row.product.id)).toContain(
      lastHealthy?.id,
    )
    expect(lowStock.map((item) => item.id)).not.toContain(
      page3.body.data[0].product.id,
    )
  })
})

describe('admin inventory receive', () => {
  it('receives stock and writes a RECEIPT movement plus audit log', async () => {
    const { cookies, user } = await loginAdmin()
    const category = await createCategory()
    const product = await createProduct({ categoryId: category.id, quantity: 4 })

    const response = await request(app)
      .post(`/api/admin/inventory/${product.id}/receive`)
      .set('Cookie', cookies)
      .send({ quantity: 10, note: 'Supplier delivery' })

    expect(response.status).toBe(200)
    expect(response.body.data.quantity).toBe(14)

    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id, type: 'RECEIPT' },
    })
    expect(movement).toMatchObject({
      quantityDelta: 10,
      quantityBefore: 4,
      quantityAfter: 14,
      note: 'Supplier delivery',
      actorUserId: user.id,
    })

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'INVENTORY_RECEIVED', entityId: product.id },
    })
    expect(audit?.userId).toBe(user.id)
  })

  it('rejects zero, negative, extra fields, unknown, and malformed receive requests', async () => {
    const { cookies } = await loginAdmin()
    const category = await createCategory()
    const product = await createProduct({ categoryId: category.id })

    const zero = await request(app)
      .post(`/api/admin/inventory/${product.id}/receive`)
      .set('Cookie', cookies)
      .send({ quantity: 0 })
    expect(zero.status).toBe(400)

    const negative = await request(app)
      .post(`/api/admin/inventory/${product.id}/receive`)
      .set('Cookie', cookies)
      .send({ quantity: -2 })
    expect(negative.status).toBe(400)

    const extra = await request(app)
      .post(`/api/admin/inventory/${product.id}/receive`)
      .set('Cookie', cookies)
      .send({ quantity: 2, movementType: 'RECEIPT' })
    expect(extra.status).toBe(400)

    const missing = await request(app)
      .post(`/api/admin/inventory/${randomUUID()}/receive`)
      .set('Cookie', cookies)
      .send({ quantity: 2 })
    expect(missing.status).toBe(404)

    const malformed = await request(app)
      .post('/api/admin/inventory/not-a-uuid/receive')
      .set('Cookie', cookies)
      .send({ quantity: 2 })
    expect(malformed.status).toBe(400)
  })
})

describe('admin inventory adjust', () => {
  it('applies positive and negative adjustments with history', async () => {
    const { cookies, user } = await loginAdmin()
    const category = await createCategory()
    const product = await createProduct({ categoryId: category.id, quantity: 8 })

    const plus = await request(app)
      .post(`/api/admin/inventory/${product.id}/adjust`)
      .set('Cookie', cookies)
      .send({ quantityDelta: 4, reason: 'Found extra cartons' })
    expect(plus.status).toBe(200)
    expect(plus.body.data.quantity).toBe(12)

    const minus = await request(app)
      .post(`/api/admin/inventory/${product.id}/adjust`)
      .set('Cookie', cookies)
      .send({ quantityDelta: -3, reason: 'Damaged stock' })
    expect(minus.status).toBe(200)
    expect(minus.body.data.quantity).toBe(9)

    const toZero = await request(app)
      .post(`/api/admin/inventory/${product.id}/adjust`)
      .set('Cookie', cookies)
      .send({ quantityDelta: -9, reason: 'Clear remaining units' })
    expect(toZero.status).toBe(200)
    expect(toZero.body.data.quantity).toBe(0)

    const movements = await prisma.inventoryMovement.findMany({
      where: { productId: product.id, type: 'ADJUSTMENT' },
      orderBy: { createdAt: 'asc' },
    })
    expect(movements).toHaveLength(3)
    expect(movements[0]).toMatchObject({
      quantityDelta: 4,
      quantityBefore: 8,
      quantityAfter: 12,
      actorUserId: user.id,
    })
    expect(
      await prisma.auditLog.count({
        where: { action: 'INVENTORY_ADJUSTED', entityId: product.id },
      }),
    ).toBe(3)
  })

  it('rejects invalid adjustments and does not write history on failure', async () => {
    const { cookies } = await loginAdmin()
    const category = await createCategory()
    const product = await createProduct({ categoryId: category.id, quantity: 2 })

    const zero = await request(app)
      .post(`/api/admin/inventory/${product.id}/adjust`)
      .set('Cookie', cookies)
      .send({ quantityDelta: 0, reason: 'No change' })
    expect(zero.status).toBe(400)

    const noReason = await request(app)
      .post(`/api/admin/inventory/${product.id}/adjust`)
      .set('Cookie', cookies)
      .send({ quantityDelta: 1, reason: '  ' })
    expect(noReason.status).toBe(400)

    const tooMuch = await request(app)
      .post(`/api/admin/inventory/${product.id}/adjust`)
      .set('Cookie', cookies)
      .send({ quantityDelta: -5, reason: 'Over-remove' })
    expect(tooMuch.status).toBe(409)
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }))
        .quantity,
    ).toBe(2)
    expect(
      await prisma.inventoryMovement.count({
        where: { productId: product.id },
      }),
    ).toBe(0)
    expect(
      await prisma.auditLog.count({
        where: { action: 'INVENTORY_ADJUSTED', entityId: product.id },
      }),
    ).toBe(0)
  })

  it('prevents concurrent removals from making inventory negative', async () => {
    const { cookies } = await loginAdmin()
    const category = await createCategory()
    const product = await createProduct({ categoryId: category.id, quantity: 5 })

    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/admin/inventory/${product.id}/adjust`)
        .set('Cookie', cookies)
        .send({ quantityDelta: -4, reason: 'First removal' }),
      request(app)
        .post(`/api/admin/inventory/${product.id}/adjust`)
        .set('Cookie', cookies)
        .send({ quantityDelta: -4, reason: 'Second removal' }),
    ])

    const statuses = [first.status, second.status].sort()
    expect(statuses).toEqual([200, 409])
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }))
        .quantity,
    ).toBe(1)
    expect(
      await prisma.inventoryMovement.count({
        where: { productId: product.id, type: 'ADJUSTMENT' },
      }),
    ).toBe(1)
  })
})

describe('admin inventory threshold', () => {
  it('updates threshold without creating a movement', async () => {
    const { cookies, user } = await loginAdmin()
    const category = await createCategory()
    const product = await createProduct({
      categoryId: category.id,
      quantity: 4,
      lowStockThreshold: 2,
    })

    const response = await request(app)
      .patch(`/api/admin/inventory/${product.id}/settings`)
      .set('Cookie', cookies)
      .send({ lowStockThreshold: 5 })

    expect(response.status).toBe(200)
    expect(response.body.data.lowStockThreshold).toBe(5)
    expect(response.body.data.stockStatus).toBe('low-stock')
    expect(
      await prisma.inventoryMovement.count({ where: { productId: product.id } }),
    ).toBe(0)
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'INVENTORY_THRESHOLD_UPDATED', entityId: product.id },
    })
    expect(audit?.userId).toBe(user.id)

    const zero = await request(app)
      .patch(`/api/admin/inventory/${product.id}/settings`)
      .set('Cookie', cookies)
      .send({ lowStockThreshold: 0 })
    expect(zero.status).toBe(200)
    expect(zero.body.data.stockStatus).toBe('healthy')

    const negative = await request(app)
      .patch(`/api/admin/inventory/${product.id}/settings`)
      .set('Cookie', cookies)
      .send({ lowStockThreshold: -1 })
    expect(negative.status).toBe(400)
  })
})

describe('initial stock movement', () => {
  it('creates INITIAL_STOCK when a product is created with stock', async () => {
    const { cookies, user } = await loginAdmin()
    const category = await createCategory()
    const suffix = uniqueSuffix()

    const response = await request(app)
      .post('/api/admin/products')
      .set('Cookie', cookies)
      .send({
        name: `Phase10 Created ${suffix}`,
        slug: `phase10-created-${suffix}`,
        description: 'Created with stock',
        sku: `P10C-${suffix}`,
        price: '12.00',
        categoryId: category.id,
        initialInventoryQuantity: 6,
        lowStockThreshold: 2,
      })

    expect(response.status).toBe(201)
    createdProductIds.push(response.body.data.id)

    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: response.body.data.id, type: 'INITIAL_STOCK' },
    })
    expect(movement).toMatchObject({
      quantityBefore: 0,
      quantityDelta: 6,
      quantityAfter: 6,
      actorUserId: user.id,
    })
  })

  it('skips INITIAL_STOCK when initial quantity is 0 and writes nothing on failed create', async () => {
    const { cookies } = await loginAdmin()
    const category = await createCategory()
    const suffix = uniqueSuffix()

    const zero = await request(app)
      .post('/api/admin/products')
      .set('Cookie', cookies)
      .send({
        name: `Phase10 Zero ${suffix}`,
        slug: `phase10-zero-${suffix}`,
        description: 'Zero stock',
        sku: `P10Z-${suffix}`,
        price: '8.00',
        categoryId: category.id,
        initialInventoryQuantity: 0,
      })
    expect(zero.status).toBe(201)
    createdProductIds.push(zero.body.data.id)
    expect(
      await prisma.inventoryMovement.count({
        where: { productId: zero.body.data.id },
      }),
    ).toBe(0)

    const beforeCount = await prisma.inventoryMovement.count()
    const failed = await request(app)
      .post('/api/admin/products')
      .set('Cookie', cookies)
      .send({
        name: `Phase10 Fail ${suffix}`,
        slug: `phase10-fail-${suffix}`,
        description: 'Should fail',
        sku: zero.body.data.sku,
        price: '8.00',
        categoryId: category.id,
        initialInventoryQuantity: 9,
      })
    expect(failed.status).toBe(409)
    expect(await prisma.inventoryMovement.count()).toBe(beforeCount)
  })
})

describe('admin inventory history', () => {
  it('returns newest-first product-specific history with a safe actor DTO', async () => {
    const { cookies } = await loginAdmin()
    const category = await createCategory()
    const product = await createProduct({ categoryId: category.id, quantity: 5 })
    const other = await createProduct({ categoryId: category.id, quantity: 5 })

    await request(app)
      .post(`/api/admin/inventory/${product.id}/receive`)
      .set('Cookie', cookies)
      .send({ quantity: 2, note: 'First' })
    await request(app)
      .post(`/api/admin/inventory/${product.id}/receive`)
      .set('Cookie', cookies)
      .send({ quantity: 1, note: 'Second' })
    await request(app)
      .post(`/api/admin/inventory/${other.id}/receive`)
      .set('Cookie', cookies)
      .send({ quantity: 9, note: 'Other' })

    const history = await request(app)
      .get(`/api/admin/inventory/${product.id}/movements`)
      .set('Cookie', cookies)
    expect(history.status).toBe(200)
    expect(history.body.data).toHaveLength(2)
    expect(history.body.data[0].note).toBe('Second')
    expect(history.body.data[0].actor).toEqual(
      expect.objectContaining({
        firstName: 'Inv',
        lastName: 'Admin',
      }),
    )
    expect(history.body.data[0].actor).not.toHaveProperty('passwordHash')
    expect(JSON.stringify(history.body)).not.toMatch(/passwordHash/)

    const page = await request(app)
      .get(`/api/admin/inventory/${product.id}/movements`)
      .query({ limit: 1, page: 1 })
      .set('Cookie', cookies)
    expect(page.body.data).toHaveLength(1)

    const typed = await request(app)
      .get(`/api/admin/inventory/${product.id}/movements`)
      .query({ type: 'RECEIPT' })
      .set('Cookie', cookies)
    expect(typed.body.data.every((row: { type: string }) => row.type === 'RECEIPT')).toBe(
      true,
    )

    const malformed = await request(app)
      .get('/api/admin/inventory/not-a-uuid/movements')
      .set('Cookie', cookies)
    expect(malformed.status).toBe(400)

    const missing = await request(app)
      .get(`/api/admin/inventory/${randomUUID()}/movements`)
      .set('Cookie', cookies)
    expect(missing.status).toBe(404)
  })
})

describe('legacy inventory patch', () => {
  it('writes an ADJUSTMENT movement when quantity changes and none when only threshold changes', async () => {
    const { cookies } = await loginAdmin()
    const category = await createCategory()
    const product = await createProduct({ categoryId: category.id, quantity: 3 })

    const quantity = await request(app)
      .patch(`/api/admin/products/${product.id}/inventory`)
      .set('Cookie', cookies)
      .send({ quantity: 11 })
    expect(quantity.status).toBe(200)
    expect(quantity.body.data.quantity).toBe(11)
    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id, type: 'ADJUSTMENT' },
    })
    expect(movement).toMatchObject({
      quantityDelta: 8,
      quantityBefore: 3,
      quantityAfter: 11,
    })

    const thresholdOnly = await createProduct({
      categoryId: category.id,
      quantity: 6,
    })
    const threshold = await request(app)
      .patch(`/api/admin/products/${thresholdOnly.id}/inventory`)
      .set('Cookie', cookies)
      .send({ lowStockThreshold: 1 })
    expect(threshold.status).toBe(200)
    expect(
      await prisma.inventoryMovement.count({
        where: { productId: thresholdOnly.id },
      }),
    ).toBe(0)
  })
})

describe('checkout and cancellation movements', () => {
  async function placeOrder(quantity = 2) {
    const admin = await loginAdmin()
    const category = await createCategory()
    const product = await createProduct({ categoryId: category.id, quantity: 6 })
    const customerEmail = uniqueEmail('phase10-order')
    const customer = await request(app).post('/api/auth/register').send({
      firstName: 'Buyer',
      lastName: 'One',
      email: customerEmail,
      password,
    })
    const cookies = cookieHeader(customer)
    const address = await request(app)
      .post('/api/addresses')
      .set('Cookie', cookies)
      .send({
        firstName: 'Buyer',
        lastName: 'One',
        addressLine1: '1 Stock Street',
        suburb: 'Melbourne',
        state: 'VIC',
        postcode: '3000',
        country: 'Australia',
      })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', cookies)
      .send({ productId: product.id, quantity })
    const order = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ addressId: address.body.data.id })
    return {
      adminCookies: admin.cookies,
      product,
      order: order.body.data,
      customerCookies: cookies,
    }
  }

  it('creates ORDER_PLACED movements on successful checkout', async () => {
    const { product, order } = await placeOrder(2)
    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id, type: 'ORDER_PLACED' },
    })
    expect(movement).toMatchObject({
      quantityDelta: -2,
      quantityBefore: 6,
      quantityAfter: 4,
      referenceType: 'Order',
      referenceId: order.id,
    })
  })

  it('creates a movement per product and rolls back movements on failed checkout', async () => {
    const category = await createCategory()
    const first = await createProduct({
      categoryId: category.id,
      name: 'First',
      quantity: 5,
    })
    const second = await createProduct({
      categoryId: category.id,
      name: 'Second',
      quantity: 5,
    })
    const customer = await loginCustomer()
    const address = await request(app)
      .post('/api/addresses')
      .set('Cookie', customer)
      .send({
        firstName: 'Buyer',
        lastName: 'Two',
        addressLine1: '2 Stock Street',
        suburb: 'Melbourne',
        state: 'VIC',
        postcode: '3000',
        country: 'Australia',
      })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', customer)
      .send({ productId: first.id, quantity: 2 })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', customer)
      .send({ productId: second.id, quantity: 2 })

    const success = await request(app)
      .post('/api/orders')
      .set('Cookie', customer)
      .send({ addressId: address.body.data.id })
    expect(success.status).toBe(201)
    expect(
      await prisma.inventoryMovement.count({
        where: {
          type: 'ORDER_PLACED',
          productId: { in: [first.id, second.id] },
        },
      }),
    ).toBe(2)

    const laterCustomer = await loginCustomer()
    const laterAddress = await request(app)
      .post('/api/addresses')
      .set('Cookie', laterCustomer)
      .send({
        firstName: 'Buyer',
        lastName: 'Three',
        addressLine1: '3 Stock Street',
        suburb: 'Melbourne',
        state: 'VIC',
        postcode: '3000',
        country: 'Australia',
      })
    const failFirst = await createProduct({
      categoryId: category.id,
      quantity: 5,
    })
    const failSecond = await createProduct({
      categoryId: category.id,
      quantity: 5,
    })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', laterCustomer)
      .send({ productId: failFirst.id, quantity: 2 })
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', laterCustomer)
      .send({ productId: failSecond.id, quantity: 2 })
    await prisma.inventory.update({
      where: { productId: failSecond.id },
      data: { quantity: 1 },
    })
    const failed = await request(app)
      .post('/api/orders')
      .set('Cookie', laterCustomer)
      .send({ addressId: laterAddress.body.data.id })
    expect(failed.status).toBe(409)
    expect(
      await prisma.inventoryMovement.count({
        where: { productId: { in: [failFirst.id, failSecond.id] } },
      }),
    ).toBe(0)
  })

  it('creates one ORDER_CANCELLED movement and does not duplicate on repeat or concurrent cancel', async () => {
    const { adminCookies, product, order } = await placeOrder(2)
    const cancelled = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', adminCookies)
      .send({ status: 'CANCELLED' })
    expect(cancelled.status).toBe(200)

    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id, type: 'ORDER_CANCELLED' },
    })
    expect(movement).toMatchObject({
      quantityDelta: 2,
      quantityBefore: 4,
      quantityAfter: 6,
      referenceType: 'Order',
      referenceId: order.id,
    })

    const repeat = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', adminCookies)
      .send({ status: 'CANCELLED' })
    expect(repeat.status).toBe(409)
    expect(
      await prisma.inventoryMovement.count({
        where: { productId: product.id, type: 'ORDER_CANCELLED' },
      }),
    ).toBe(1)

    const concurrent = await placeOrder(1)
    const [first, second] = await Promise.all([
      request(app)
        .patch(`/api/admin/orders/${concurrent.order.id}/status`)
        .set('Cookie', concurrent.adminCookies)
        .send({ status: 'CANCELLED' }),
      request(app)
        .patch(`/api/admin/orders/${concurrent.order.id}/status`)
        .set('Cookie', concurrent.adminCookies)
        .send({ status: 'CANCELLED' }),
    ])
    expect([first.status, second.status].sort()).toEqual([200, 409])
    expect(
      await prisma.inventoryMovement.count({
        where: {
          productId: concurrent.product.id,
          type: 'ORDER_CANCELLED',
        },
      }),
    ).toBe(1)
    expect(
      (
        await prisma.inventory.findUniqueOrThrow({
          where: { productId: concurrent.product.id },
        })
      ).quantity,
    ).toBe(6)
  })

  it('skips cancellation movement when productId is null', async () => {
    const { adminCookies, product, order } = await placeOrder(1)
    await prisma.orderItem.updateMany({
      where: { orderId: order.id },
      data: { productId: null },
    })
    const response = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', adminCookies)
      .send({ status: 'CANCELLED' })
    expect(response.status).toBe(200)
    expect(
      await prisma.inventoryMovement.count({
        where: { productId: product.id, type: 'ORDER_CANCELLED' },
      }),
    ).toBe(0)
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }))
        .quantity,
    ).toBe(5)
  })
})
