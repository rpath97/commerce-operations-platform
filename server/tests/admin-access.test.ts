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

function uniqueEmail(prefix = 'phase9-admin'): string {
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
  const email = uniqueEmail()
  await prisma.user.create({
    data: {
      firstName: 'Phase9',
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
  const email = uniqueEmail('phase9-customer')
  const response = await request(app).post('/api/auth/register').send({
    firstName: 'Phase9',
    lastName: 'Customer',
    email,
    password,
  })

  return cookieHeader(response)
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

describe('admin access control', () => {
  it('rejects guest access to admin dashboard, lists, detail, and status', async () => {
    const orderId = randomUUID()
    const endpoints = [
      request(app).get('/api/admin/dashboard'),
      request(app).get('/api/admin/analytics'),
      request(app).get('/api/admin/products'),
      request(app).get('/api/admin/categories'),
      request(app).get('/api/admin/inventory'),
      request(app).get('/api/admin/promotions'),
      request(app).get('/api/admin/orders'),
      request(app).get(`/api/admin/orders/${orderId}`),
      request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .send({ status: 'PROCESSING' }),
    ]

    const responses = await Promise.all(endpoints)
    for (const response of responses) {
      expect(response.status).toBe(401)
    }
  })

  it('rejects customer access to admin dashboard, lists, detail, and status', async () => {
    const cookies = await loginCustomer()
    const orderId = randomUUID()
    const endpoints = [
      request(app).get('/api/admin/dashboard').set('Cookie', cookies),
      request(app).get('/api/admin/analytics').set('Cookie', cookies),
      request(app).get('/api/admin/products').set('Cookie', cookies),
      request(app).get('/api/admin/categories').set('Cookie', cookies),
      request(app).get('/api/admin/inventory').set('Cookie', cookies),
      request(app).get('/api/admin/promotions').set('Cookie', cookies),
      request(app).get('/api/admin/orders').set('Cookie', cookies),
      request(app).get(`/api/admin/orders/${orderId}`).set('Cookie', cookies),
      request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Cookie', cookies)
        .send({ status: 'PROCESSING' }),
    ]

    const responses = await Promise.all(endpoints)
    for (const response of responses) {
      expect(response.status).toBe(403)
    }
  })

  it('allows an admin to load dashboard, product, category, and order lists', async () => {
    const cookies = await loginAdmin()

    const dashboard = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', cookies)
    const products = await request(app)
      .get('/api/admin/products')
      .set('Cookie', cookies)
    const categories = await request(app)
      .get('/api/admin/categories')
      .set('Cookie', cookies)
    const orders = await request(app)
      .get('/api/admin/orders')
      .set('Cookie', cookies)

    expect(dashboard.status).toBe(200)
    expect(products.status).toBe(200)
    expect(categories.status).toBe(200)
    expect(orders.status).toBe(200)
  })
})
