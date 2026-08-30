import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

const password = 'SecurePassword123!'
const createdEmails: string[] = []

function uniqueEmail(): string {
  const email = `phase8-address-${randomUUID()}@example.com`
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
    lastName: 'Address',
    email,
    password,
  })
  return cookieHeader(response)
}

const validAddress = {
  firstName: 'Ryan',
  lastName: 'Pathirana',
  addressLine1: '10 Example Street',
  suburb: 'Melbourne',
  state: 'VIC',
  postcode: '3000',
  country: 'Australia',
}

afterEach(async () => {
  if (createdEmails.length === 0) {
    return
  }

  await prisma.user.deleteMany({
    where: { email: { in: [...createdEmails] } },
  })
  createdEmails.length = 0
})

describe('address authentication', () => {
  it('rejects GET /api/addresses without a session', async () => {
    const response = await request(app).get('/api/addresses')
    expect(response.status).toBe(401)
  })

  it('rejects POST /api/addresses without a session', async () => {
    const response = await request(app).post('/api/addresses').send(validAddress)
    expect(response.status).toBe(401)
  })

  it('rejects PATCH /api/addresses/:addressId without a session', async () => {
    const response = await request(app)
      .patch(`/api/addresses/${randomUUID()}`)
      .send({ suburb: 'Sydney' })
    expect(response.status).toBe(401)
  })

  it('rejects DELETE /api/addresses/:addressId without a session', async () => {
    const response = await request(app).delete(`/api/addresses/${randomUUID()}`)
    expect(response.status).toBe(401)
  })
})

describe('customer addresses', () => {
  it('creates a valid address', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .post('/api/addresses')
      .set('Cookie', cookies)
      .send(validAddress)

    expect(response.status).toBe(201)
    expect(response.body.data).toMatchObject(validAddress)
    expect(response.body.data.addressLine2).toBeNull()
    expect(response.body.data.phone).toBeNull()
    expect(typeof response.body.data.postcode).toBe('string')
  })

  it('lists only the current user addresses', async () => {
    const cookies = await registerCustomer()
    await request(app)
      .post('/api/addresses')
      .set('Cookie', cookies)
      .send(validAddress)

    const response = await request(app)
      .get('/api/addresses')
      .set('Cookie', cookies)

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].addressLine1).toBe('10 Example Street')
  })

  it('updates an owned address', async () => {
    const cookies = await registerCustomer()
    const created = await request(app)
      .post('/api/addresses')
      .set('Cookie', cookies)
      .send(validAddress)

    const response = await request(app)
      .patch(`/api/addresses/${created.body.data.id}`)
      .set('Cookie', cookies)
      .send({ addressLine1: '50 New Street' })

    expect(response.status).toBe(200)
    expect(response.body.data.addressLine1).toBe('50 New Street')
    expect(response.body.data.suburb).toBe('Melbourne')
  })

  it('deletes an owned address', async () => {
    const cookies = await registerCustomer()
    const created = await request(app)
      .post('/api/addresses')
      .set('Cookie', cookies)
      .send(validAddress)

    const response = await request(app)
      .delete(`/api/addresses/${created.body.data.id}`)
      .set('Cookie', cookies)

    expect(response.status).toBe(204)

    const list = await request(app).get('/api/addresses').set('Cookie', cookies)
    expect(list.body.data).toEqual([])
  })

  it('rejects a malformed address UUID', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .patch('/api/addresses/not-a-uuid')
      .set('Cookie', cookies)
      .send({ suburb: 'Sydney' })

    expect(response.status).toBe(400)
  })

  it('returns 404 for an unknown address', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .patch(`/api/addresses/${randomUUID()}`)
      .set('Cookie', cookies)
      .send({ suburb: 'Sydney' })

    expect(response.status).toBe(404)
    expect(response.body.error.message).toBe('Address not found')
  })

  it('cannot update another user address', async () => {
    const owner = await registerCustomer()
    const other = await registerCustomer()
    const created = await request(app)
      .post('/api/addresses')
      .set('Cookie', owner)
      .send(validAddress)

    const response = await request(app)
      .patch(`/api/addresses/${created.body.data.id}`)
      .set('Cookie', other)
      .send({ suburb: 'Sydney' })

    expect(response.status).toBe(404)

    const original = await request(app)
      .get('/api/addresses')
      .set('Cookie', owner)
    expect(original.body.data[0].suburb).toBe('Melbourne')
  })

  it('cannot delete another user address', async () => {
    const owner = await registerCustomer()
    const other = await registerCustomer()
    const created = await request(app)
      .post('/api/addresses')
      .set('Cookie', owner)
      .send(validAddress)

    const response = await request(app)
      .delete(`/api/addresses/${created.body.data.id}`)
      .set('Cookie', other)

    expect(response.status).toBe(404)

    const list = await request(app).get('/api/addresses').set('Cookie', owner)
    expect(list.body.data).toHaveLength(1)
  })

  it('rejects extra body fields', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .post('/api/addresses')
      .set('Cookie', cookies)
      .send({ ...validAddress, userId: randomUUID() })

    expect(response.status).toBe(400)
  })

  it('rejects invalid required fields', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .post('/api/addresses')
      .set('Cookie', cookies)
      .send({ ...validAddress, firstName: '' })

    expect(response.status).toBe(400)
  })

  it('keeps postcode as a string including a leading zero', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .post('/api/addresses')
      .set('Cookie', cookies)
      .send({ ...validAddress, postcode: '0800' })

    expect(response.status).toBe(201)
    expect(response.body.data.postcode).toBe('0800')
    expect(typeof response.body.data.postcode).toBe('string')
  })

  it('accepts optional addressLine2', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .post('/api/addresses')
      .set('Cookie', cookies)
      .send({ ...validAddress, addressLine2: 'Unit 4' })

    expect(response.status).toBe(201)
    expect(response.body.data.addressLine2).toBe('Unit 4')
  })

  it('accepts optional phone', async () => {
    const cookies = await registerCustomer()
    const response = await request(app)
      .post('/api/addresses')
      .set('Cookie', cookies)
      .send({ ...validAddress, phone: '+61 400 000 000' })

    expect(response.status).toBe(201)
    expect(response.body.data.phone).toBe('+61 400 000 000')
  })
})
