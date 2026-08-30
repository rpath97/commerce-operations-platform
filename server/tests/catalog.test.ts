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
  const email = `phase4-catalog-${randomUUID()}@example.com`
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
  const email = uniqueEmail()
  await prisma.user.create({
    data: {
      firstName: 'Phase4',
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

async function loginCustomer() {
  const email = uniqueEmail()
  const response = await request(app).post('/api/auth/register').send({
    firstName: 'Phase4',
    lastName: 'Customer',
    email,
    password,
  })

  return cookieHeader(response)
}

async function createTestCategory(namePrefix = 'Phase4 Cat') {
  const suffix = uniqueSuffix()
  const category = await prisma.category.create({
    data: {
      name: `${namePrefix} ${suffix}`,
      slug: `phase4-cat-${suffix}`,
      description: 'Phase 4 test category',
    },
  })
  createdCategoryIds.push(category.id)
  return category
}

async function createTestProduct(options: {
  categoryId: string
  name?: string
  slug?: string
  sku?: string
  price?: string
  quantity?: number
  isActive?: boolean
}) {
  const suffix = uniqueSuffix()
  const product = await prisma.product.create({
    data: {
      name: options.name ?? `Phase4 Product ${suffix}`,
      slug: options.slug ?? `phase4-product-${suffix}`,
      description: 'Phase 4 test product description',
      sku: options.sku ?? `P4-${suffix}`,
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

function assertSafeCataloguePayload(payload: unknown) {
  const raw = JSON.stringify(payload)
  expect(raw).not.toMatch(/passwordHash/i)
  expect(raw).not.toMatch(/"token"/)
  expect(raw).not.toMatch(/JWT/i)
}

afterEach(async () => {
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

  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: [...createdEmails] } },
    })
    createdEmails.length = 0
  }
})

describe('GET /api/categories', () => {
  it('returns catalogue categories', async () => {
    const response = await request(app).get('/api/categories')

    expect(response.status).toBe(200)
    expect(Array.isArray(response.body.data)).toBe(true)
    expect(
      response.body.data.some(
        (category: { name: string }) => category.name === 'Electronics',
      ),
    ).toBe(true)
    assertSafeCataloguePayload(response.body)
  })

  it('returns a category by slug', async () => {
    const response = await request(app).get('/api/categories/electronics')

    expect(response.status).toBe(200)
    expect(response.body.data.slug).toBe('electronics')
    expect(response.body.data.name).toBe('Electronics')
  })

  it('returns 404 for an unknown category slug', async () => {
    const response = await request(app).get(
      '/api/categories/phase4-missing-category',
    )

    expect(response.status).toBe(404)
  })
})

describe('GET /api/products', () => {
  it('returns a paginated public product list', async () => {
    const response = await request(app).get('/api/products?page=1&limit=12')

    expect(response.status).toBe(200)
    expect(Array.isArray(response.body.data)).toBe(true)
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 12,
    })
    expect(response.body.pagination.total).toEqual(expect.any(Number))
    assertSafeCataloguePayload(response.body)
  })

  it('paginates results', async () => {
    const category = await createTestCategory()
    await createTestProduct({
      categoryId: category.id,
      name: 'Phase4 Page Alpha',
    })
    await createTestProduct({
      categoryId: category.id,
      name: 'Phase4 Page Beta',
    })

    const page1 = await request(app).get(
      `/api/products?category=${category.slug}&limit=1&page=1&sort=name-asc`,
    )
    const page2 = await request(app).get(
      `/api/products?category=${category.slug}&limit=1&page=2&sort=name-asc`,
    )

    expect(page1.status).toBe(200)
    expect(page2.status).toBe(200)
    expect(page1.body.data).toHaveLength(1)
    expect(page2.body.data).toHaveLength(1)
    expect(page1.body.data[0].id).not.toBe(page2.body.data[0].id)
    expect(page1.body.pagination.totalPages).toBe(2)
  })

  it('filters by search term', async () => {
    const category = await createTestCategory()
    const uniqueName = `Phase4 SearchWidget ${uniqueSuffix()}`
    await createTestProduct({
      categoryId: category.id,
      name: uniqueName,
    })

    const response = await request(app).get(
      `/api/products?search=${encodeURIComponent(uniqueName)}`,
    )

    expect(response.status).toBe(200)
    expect(response.body.data.length).toBeGreaterThan(0)
    expect(
      response.body.data.every((product: { name: string }) =>
        product.name.includes('SearchWidget'),
      ),
    ).toBe(true)
  })

  it('filters by category slug', async () => {
    const response = await request(app).get(
      '/api/products?category=electronics',
    )

    expect(response.status).toBe(200)
    expect(response.body.data.length).toBeGreaterThan(0)
    expect(
      response.body.data.every(
        (product: { category: { slug: string } }) =>
          product.category.slug === 'electronics',
      ),
    ).toBe(true)
  })

  it('filters by min and max price', async () => {
    const category = await createTestCategory()
    await createTestProduct({
      categoryId: category.id,
      price: '10.00',
      name: 'Phase4 Cheap Item',
    })
    await createTestProduct({
      categoryId: category.id,
      price: '80.00',
      name: 'Phase4 Mid Item',
    })
    await createTestProduct({
      categoryId: category.id,
      price: '400.00',
      name: 'Phase4 Expensive Item',
    })

    const response = await request(app).get(
      `/api/products?category=${category.slug}&minPrice=50&maxPrice=100`,
    )

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].name).toBe('Phase4 Mid Item')
  })

  it('filters by in-stock products', async () => {
    const category = await createTestCategory()
    await createTestProduct({
      categoryId: category.id,
      quantity: 8,
      name: 'Phase4 In Stock Item',
    })
    await createTestProduct({
      categoryId: category.id,
      quantity: 0,
      name: 'Phase4 Out Of Stock Item',
    })

    const inStock = await request(app).get(
      `/api/products?category=${category.slug}&inStock=true`,
    )
    const outOfStock = await request(app).get(
      `/api/products?category=${category.slug}&inStock=false`,
    )

    expect(inStock.body.data).toHaveLength(1)
    expect(inStock.body.data[0].inventory.inStock).toBe(true)
    expect(outOfStock.body.data).toHaveLength(1)
    expect(outOfStock.body.data[0].inventory.inStock).toBe(false)
  })

  it('sorts by price ascending', async () => {
    const category = await createTestCategory()
    await createTestProduct({
      categoryId: category.id,
      price: '30.00',
      name: 'Phase4 Sort High',
    })
    await createTestProduct({
      categoryId: category.id,
      price: '12.00',
      name: 'Phase4 Sort Low',
    })

    const response = await request(app).get(
      `/api/products?category=${category.slug}&sort=price-asc`,
    )

    expect(response.status).toBe(200)
    expect(response.body.data[0].name).toBe('Phase4 Sort Low')
    expect(response.body.data[1].name).toBe('Phase4 Sort High')
  })

  it('excludes inactive products from the public list', async () => {
    const category = await createTestCategory()
    const hidden = await createTestProduct({
      categoryId: category.id,
      isActive: false,
      name: 'Phase4 Hidden Product',
    })

    const response = await request(app).get(
      `/api/products?category=${category.slug}`,
    )

    expect(
      response.body.data.some(
        (product: { id: string }) => product.id === hidden.id,
      ),
    ).toBe(false)
  })
})

describe('GET /api/products/:slug', () => {
  it('returns an active product by slug', async () => {
    const response = await request(app).get(
      '/api/products/aether-noise-cancelling-headphones',
    )

    expect(response.status).toBe(200)
    expect(response.body.data.slug).toBe(
      'aether-noise-cancelling-headphones',
    )
    expect(response.body.data.inventory).toEqual(
      expect.objectContaining({
        quantity: expect.any(Number),
        inStock: expect.any(Boolean),
      }),
    )
    expect(response.body.data.inventory).not.toHaveProperty(
      'lowStockThreshold',
    )
    assertSafeCataloguePayload(response.body)
  })

  it('returns 404 for an unknown product slug', async () => {
    const response = await request(app).get(
      '/api/products/phase4-missing-product',
    )

    expect(response.status).toBe(404)
  })

  it('returns 404 for an inactive product', async () => {
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      isActive: false,
      slug: `phase4-inactive-${uniqueSuffix()}`,
    })

    const response = await request(app).get(`/api/products/${product.slug}`)

    expect(response.status).toBe(404)
  })
})

describe('admin catalogue security', () => {
  it('rejects unauthenticated category creation', async () => {
    const response = await request(app).post('/api/admin/categories').send({
      name: 'Blocked',
      slug: 'blocked',
    })

    expect(response.status).toBe(401)
  })

  it('rejects CUSTOMER category creation', async () => {
    const cookies = await loginCustomer()
    const response = await request(app)
      .post('/api/admin/categories')
      .set('Cookie', cookies)
      .send({
        name: 'Blocked Customer Cat',
        slug: 'blocked-customer-cat',
      })

    expect(response.status).toBe(403)
  })

  it('allows ADMIN category creation', async () => {
    const cookies = await loginAdmin()
    const suffix = uniqueSuffix()
    const response = await request(app)
      .post('/api/admin/categories')
      .set('Cookie', cookies)
      .send({
        name: `Phase4 Admin Cat ${suffix}`,
        slug: `Phase4 Admin Cat ${suffix}`,
        description: 'Created by admin',
      })

    expect(response.status).toBe(201)
    expect(response.body.data.slug).toBe(`phase4-admin-cat-${suffix}`)
    createdCategoryIds.push(response.body.data.id)
  })

  it('rejects unauthenticated product creation', async () => {
    const response = await request(app).post('/api/admin/products').send({
      name: 'Blocked',
      slug: 'blocked',
      description: 'Blocked',
      sku: 'BLK-1',
      price: 10,
      categoryId: randomUUID(),
    })

    expect(response.status).toBe(401)
  })

  it('rejects CUSTOMER product creation', async () => {
    const category = await createTestCategory()
    const cookies = await loginCustomer()
    const response = await request(app)
      .post('/api/admin/products')
      .set('Cookie', cookies)
      .send({
        name: 'Blocked Product',
        slug: 'blocked-product',
        description: 'Blocked',
        sku: 'BLK-2',
        price: 10,
        categoryId: category.id,
      })

    expect(response.status).toBe(403)
  })

  it('allows ADMIN product creation', async () => {
    const category = await createTestCategory()
    const cookies = await loginAdmin()
    const suffix = uniqueSuffix()
    const response = await request(app)
      .post('/api/admin/products')
      .set('Cookie', cookies)
      .send({
        name: `Phase4 Admin Product ${suffix}`,
        slug: `phase4-admin-product-${suffix}`,
        description: 'Created by admin',
        sku: `P4A-${suffix}`,
        price: 19.5,
        categoryId: category.id,
        initialInventoryQuantity: 7,
        lowStockThreshold: 3,
        isActive: true,
      })

    expect(response.status).toBe(201)
    expect(response.body.data.inventory.quantity).toBe(7)
    expect(response.body.data.inventory.lowStockThreshold).toBe(3)
    createdProductIds.push(response.body.data.id)
  })
})

describe('admin categories', () => {
  it('updates a category', async () => {
    const category = await createTestCategory()
    const cookies = await loginAdmin()
    const suffix = uniqueSuffix()

    const response = await request(app)
      .patch(`/api/admin/categories/${category.id}`)
      .set('Cookie', cookies)
      .send({ name: `Phase4 Updated ${suffix}` })

    expect(response.status).toBe(200)
    expect(response.body.data.name).toBe(`Phase4 Updated ${suffix}`)
  })

  it('rejects a duplicate category slug', async () => {
    const first = await createTestCategory()
    const second = await createTestCategory()
    const cookies = await loginAdmin()

    const response = await request(app)
      .patch(`/api/admin/categories/${second.id}`)
      .set('Cookie', cookies)
      .send({ slug: first.slug })

    expect(response.status).toBe(409)
  })

  it('does not delete a category that still has products', async () => {
    const category = await createTestCategory()
    await createTestProduct({ categoryId: category.id })
    const cookies = await loginAdmin()

    const response = await request(app)
      .delete(`/api/admin/categories/${category.id}`)
      .set('Cookie', cookies)

    expect(response.status).toBe(409)
  })

  it('deletes an empty category', async () => {
    const category = await createTestCategory()
    const cookies = await loginAdmin()

    const response = await request(app)
      .delete(`/api/admin/categories/${category.id}`)
      .set('Cookie', cookies)

    expect(response.status).toBe(200)
    expect(response.body.data.id).toBe(category.id)
    createdCategoryIds.splice(createdCategoryIds.indexOf(category.id), 1)
  })
})

describe('admin products', () => {
  it('creates product inventory in the same transaction', async () => {
    const category = await createTestCategory()
    const cookies = await loginAdmin()
    const suffix = uniqueSuffix()

    const response = await request(app)
      .post('/api/admin/products')
      .set('Cookie', cookies)
      .send({
        name: `Phase4 Tx Product ${suffix}`,
        slug: `phase4-tx-product-${suffix}`,
        description: 'Inventory should exist',
        sku: `P4T-${suffix}`,
        price: 42,
        categoryId: category.id,
        initialInventoryQuantity: 4,
        lowStockThreshold: 1,
      })

    expect(response.status).toBe(201)
    createdProductIds.push(response.body.data.id)

    const inventory = await prisma.inventory.findUnique({
      where: { productId: response.body.data.id },
    })
    expect(inventory?.quantity).toBe(4)
  })

  it('updates a product', async () => {
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    const cookies = await loginAdmin()

    const response = await request(app)
      .patch(`/api/admin/products/${product.id}`)
      .set('Cookie', cookies)
      .send({ name: 'Phase4 Renamed Product' })

    expect(response.status).toBe(200)
    expect(response.body.data.name).toBe('Phase4 Renamed Product')
  })

  it('updates inventory', async () => {
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      quantity: 3,
    })
    const cookies = await loginAdmin()

    const response = await request(app)
      .patch(`/api/admin/products/${product.id}/inventory`)
      .set('Cookie', cookies)
      .send({ quantity: 11, lowStockThreshold: 4 })

    expect(response.status).toBe(200)
    expect(response.body.data.quantity).toBe(11)
    expect(response.body.data.lowStockThreshold).toBe(4)
  })

  it('rejects negative inventory', async () => {
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    const cookies = await loginAdmin()

    const response = await request(app)
      .patch(`/api/admin/products/${product.id}/inventory`)
      .set('Cookie', cookies)
      .send({ quantity: -1 })

    expect(response.status).toBe(400)
  })

  it('rejects a duplicate SKU', async () => {
    const category = await createTestCategory()
    const existing = await createTestProduct({ categoryId: category.id })
    const cookies = await loginAdmin()
    const suffix = uniqueSuffix()

    const response = await request(app)
      .post('/api/admin/products')
      .set('Cookie', cookies)
      .send({
        name: `Phase4 Dup Sku ${suffix}`,
        slug: `phase4-dup-sku-${suffix}`,
        description: 'Duplicate SKU',
        sku: existing.sku,
        price: 10,
        categoryId: category.id,
      })

    expect(response.status).toBe(409)
  })

  it('rejects a duplicate product slug', async () => {
    const category = await createTestCategory()
    const existing = await createTestProduct({ categoryId: category.id })
    const cookies = await loginAdmin()
    const suffix = uniqueSuffix()

    const response = await request(app)
      .post('/api/admin/products')
      .set('Cookie', cookies)
      .send({
        name: `Phase4 Dup Slug ${suffix}`,
        slug: existing.slug,
        description: 'Duplicate slug',
        sku: `P4D-${suffix}`,
        price: 10,
        categoryId: category.id,
      })

    expect(response.status).toBe(409)
  })

  it('archives a product instead of deleting it', async () => {
    const category = await createTestCategory()
    const product = await createTestProduct({ categoryId: category.id })
    const cookies = await loginAdmin()

    const response = await request(app)
      .delete(`/api/admin/products/${product.id}`)
      .set('Cookie', cookies)

    expect(response.status).toBe(200)
    expect(response.body.data.isActive).toBe(false)

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
      include: { inventory: true },
    })
    expect(stored).not.toBeNull()
    expect(stored?.isActive).toBe(false)
    expect(stored?.inventory).not.toBeNull()
  })

  it('hides archived products from the public list and detail routes', async () => {
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      name: 'Phase4 Soon Archived',
    })
    const cookies = await loginAdmin()

    await request(app)
      .delete(`/api/admin/products/${product.id}`)
      .set('Cookie', cookies)

    const list = await request(app).get(
      `/api/products?category=${category.slug}`,
    )
    const detail = await request(app).get(`/api/products/${product.slug}`)

    expect(
      list.body.data.some((item: { id: string }) => item.id === product.id),
    ).toBe(false)
    expect(detail.status).toBe(404)
  })
})

describe('Phase 4 audit guards', () => {
  it('rejects malformed admin IDs with 400', async () => {
    const cookies = await loginAdmin()

    const categoryPatch = await request(app)
      .patch('/api/admin/categories/not-a-uuid')
      .set('Cookie', cookies)
      .send({ name: 'Invalid' })
    const productPatch = await request(app)
      .patch('/api/admin/products/not-a-uuid')
      .set('Cookie', cookies)
      .send({ name: 'Invalid' })
    const inventoryPatch = await request(app)
      .patch('/api/admin/products/not-a-uuid/inventory')
      .set('Cookie', cookies)
      .send({ quantity: 1 })
    const productArchive = await request(app)
      .delete('/api/admin/products/not-a-uuid')
      .set('Cookie', cookies)

    expect(categoryPatch.status).toBe(400)
    expect(productPatch.status).toBe(400)
    expect(inventoryPatch.status).toBe(400)
    expect(productArchive.status).toBe(400)
  })

  it('rejects invalid money, sort, and pagination query values', async () => {
    const unknownSort = await request(app).get('/api/products?sort=popularity')
    const invertedPrice = await request(app).get(
      '/api/products?minPrice=100&maxPrice=10',
    )
    const infinitePrice = await request(app).get(
      '/api/products?minPrice=Infinity',
    )
    const tooMany = await request(app).get('/api/products?limit=101')
    const pageZero = await request(app).get('/api/products?page=0')

    expect(unknownSort.status).toBe(400)
    expect(invertedPrice.status).toBe(400)
    expect(infinitePrice.status).toBe(400)
    expect(tooMany.status).toBe(400)
    expect(pageZero.status).toBe(400)
  })

  it('returns an empty list for an unknown category slug', async () => {
    const response = await request(app).get(
      '/api/products?category=phase4-no-such-category',
    )

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([])
    expect(response.body.pagination.total).toBe(0)
  })

  it('treats missing inventory as out of stock without crashing', async () => {
    const category = await createTestCategory()
    const suffix = uniqueSuffix()
    const product = await prisma.product.create({
      data: {
        name: `Phase4 Orphan Inventory ${suffix}`,
        slug: `phase4-orphan-${suffix}`,
        description: 'No inventory row',
        sku: `P4O-${suffix}`,
        price: '15.00',
        categoryId: category.id,
        isActive: true,
      },
    })
    createdProductIds.push(product.id)

    const detail = await request(app).get(`/api/products/${product.slug}`)
    const outOfStock = await request(app).get(
      `/api/products?category=${category.slug}&inStock=false`,
    )
    const inStock = await request(app).get(
      `/api/products?category=${category.slug}&inStock=true`,
    )

    expect(detail.status).toBe(200)
    expect(detail.body.data.inventory).toEqual({
      quantity: 0,
      inStock: false,
    })
    expect(
      outOfStock.body.data.some((item: { id: string }) => item.id === product.id),
    ).toBe(true)
    expect(
      inStock.body.data.some((item: { id: string }) => item.id === product.id),
    ).toBe(false)
  })

  it('does not delete a category that still has archived products', async () => {
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      isActive: false,
    })
    const cookies = await loginAdmin()

    const response = await request(app)
      .delete(`/api/admin/categories/${category.id}`)
      .set('Cookie', cookies)

    expect(response.status).toBe(409)
    const stored = await prisma.product.findUnique({ where: { id: product.id } })
    expect(stored).not.toBeNull()
  })

  it('lets an admin update an archived product', async () => {
    const category = await createTestCategory()
    const product = await createTestProduct({
      categoryId: category.id,
      isActive: false,
    })
    const cookies = await loginAdmin()

    const response = await request(app)
      .patch(`/api/admin/products/${product.id}`)
      .set('Cookie', cookies)
      .send({ name: 'Phase4 Archived Still Editable' })

    expect(response.status).toBe(200)
    expect(response.body.data.isActive).toBe(false)
    expect(response.body.data.name).toBe('Phase4 Archived Still Editable')
  })

  it('rejects unexpected fields and extra decimal places on product writes', async () => {
    const category = await createTestCategory()
    const cookies = await loginAdmin()
    const suffix = uniqueSuffix()

    const extraFields = await request(app)
      .post('/api/admin/products')
      .set('Cookie', cookies)
      .send({
        name: `Phase4 Strict ${suffix}`,
        slug: `phase4-strict-${suffix}`,
        description: 'Unexpected fields',
        sku: `P4S-${suffix}`,
        price: 10,
        categoryId: category.id,
        quantity: 500,
        role: 'ADMIN',
        id: randomUUID(),
      })

    const extraDecimals = await request(app)
      .post('/api/admin/products')
      .set('Cookie', cookies)
      .send({
        name: `Phase4 Money ${suffix}`,
        slug: `phase4-money-${suffix}`,
        description: 'Too many decimals',
        sku: `P4M-${suffix}`,
        price: 19.999,
        categoryId: category.id,
      })

    expect(extraFields.status).toBe(400)
    expect(extraDecimals.status).toBe(400)
  })

  it('rejects a duplicate category name', async () => {
    const first = await createTestCategory()
    const cookies = await loginAdmin()
    const suffix = uniqueSuffix()

    const response = await request(app)
      .post('/api/admin/categories')
      .set('Cookie', cookies)
      .send({
        name: first.name,
        slug: `phase4-dup-name-${suffix}`,
      })

    expect(response.status).toBe(409)
  })
})
