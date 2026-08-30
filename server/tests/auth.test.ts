import { randomUUID } from 'node:crypto'
import cookieParser from 'cookie-parser'
import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import { AUTH_COOKIE_NAME } from '../src/config/auth.js'
import { prisma } from '../src/lib/prisma.js'
import { requireAuth } from '../src/middleware/auth.middleware.js'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { requireRole } from '../src/middleware/role.middleware.js'
import { hashPassword } from '../src/utils/password.js'

const createdEmails: string[] = []
const password = 'SecurePassword123!'

function uniqueEmail(): string {
  const email = `phase3-auth-${randomUUID()}@example.com`
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

function hasAuthCookie(response: request.Response): boolean {
  return cookieHeader(response).some((value) =>
    value.startsWith(`${AUTH_COOKIE_NAME}=`),
  )
}

function createAdminOnlyTestApp() {
  const testApp = express()
  testApp.use(cookieParser())
  testApp.get(
    '/admin-only',
    requireAuth,
    requireRole('ADMIN'),
    (_req, res) => {
      res.status(200).json({ ok: true })
    },
  )
  testApp.use(errorHandler)
  return testApp
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

describe('POST /api/auth/register', () => {
  it('registers a customer, hashes the password, and issues an auth cookie', async () => {
    const email = uniqueEmail()

    const response = await request(app).post('/api/auth/register').send({
      firstName: 'Ryan',
      lastName: 'Pathirana',
      email,
      password,
    })

    expect(response.status).toBe(201)
    expect(response.body.user).toMatchObject({
      firstName: 'Ryan',
      lastName: 'Pathirana',
      email,
      role: 'CUSTOMER',
    })
    expect(response.body.user.id).toEqual(expect.any(String))
    expect(response.body.user).not.toHaveProperty('passwordHash')
    expect(response.body).not.toHaveProperty('token')
    expect(hasAuthCookie(response)).toBe(true)
    expect(
      cookieHeader(response).some((value) => value.includes('HttpOnly')),
    ).toBe(true)

    const stored = await prisma.user.findUnique({ where: { email } })
    expect(stored).not.toBeNull()
    expect(stored?.passwordHash).not.toBe(password)
    expect(stored?.passwordHash.startsWith('$2b$')).toBe(true)
    expect(stored?.role).toBe('CUSTOMER')
  })

  it('rejects unexpected fields including a requested ADMIN role', async () => {
    const email = uniqueEmail()

    const response = await request(app).post('/api/auth/register').send({
      firstName: 'Ryan',
      lastName: 'Pathirana',
      email,
      password,
      role: 'ADMIN',
    })

    expect(response.status).toBe(400)
    expect(response.body.error.message).toBe('Validation failed')

    const stored = await prisma.user.findUnique({ where: { email } })
    expect(stored).toBeNull()
  })

  it('rejects a duplicate email', async () => {
    const email = uniqueEmail()

    await request(app).post('/api/auth/register').send({
      firstName: 'Ryan',
      lastName: 'Pathirana',
      email,
      password,
    })

    const response = await request(app).post('/api/auth/register').send({
      firstName: 'Ryan',
      lastName: 'Pathirana',
      email,
      password,
    })

    expect(response.status).toBe(409)
    expect(response.body.error.message).toMatch(/already exists/i)
  })

  it('rejects invalid registration payloads', async () => {
    const response = await request(app).post('/api/auth/register').send({
      firstName: '',
      lastName: 'Pathirana',
      email: 'not-an-email',
      password: 'short',
    })

    expect(response.status).toBe(400)
    expect(response.body.error.message).toBe('Validation failed')
  })
})

describe('POST /api/auth/login', () => {
  it('authenticates valid credentials and sets the auth cookie', async () => {
    const email = uniqueEmail()

    await request(app).post('/api/auth/register').send({
      firstName: 'Ryan',
      lastName: 'Pathirana',
      email,
      password,
    })

    const response = await request(app).post('/api/auth/login').send({
      email,
      password,
    })

    expect(response.status).toBe(200)
    expect(response.body.user.email).toBe(email)
    expect(response.body.user.role).toBe('CUSTOMER')
    expect(response.body.user).not.toHaveProperty('passwordHash')
    expect(response.body).not.toHaveProperty('token')
    expect(hasAuthCookie(response)).toBe(true)
  })

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const email = uniqueEmail()

    await request(app).post('/api/auth/register').send({
      firstName: 'Ryan',
      lastName: 'Pathirana',
      email,
      password,
    })

    const wrongPassword = await request(app).post('/api/auth/login').send({
      email,
      password: 'WrongPassword123!',
    })

    const unknownEmail = await request(app).post('/api/auth/login').send({
      email: uniqueEmail(),
      password,
    })

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.body).toEqual(unknownEmail.body)
    expect(wrongPassword.body.error.message).toBe('Invalid email or password')
  })
})

describe('GET /api/auth/me', () => {
  it('returns the authenticated user', async () => {
    const email = uniqueEmail()
    const agent = request.agent(app)

    await agent.post('/api/auth/register').send({
      firstName: 'Ryan',
      lastName: 'Pathirana',
      email,
      password,
    })

    const response = await agent.get('/api/auth/me')

    expect(response.status).toBe(200)
    expect(response.body.user.email).toBe(email)
    expect(response.body.user).not.toHaveProperty('passwordHash')
  })

  it('returns 401 without a valid session', async () => {
    const response = await request(app).get('/api/auth/me')

    expect(response.status).toBe(401)
    expect(response.body.error.message).toBe('Authentication required')
  })

  it('returns 401 if the user no longer exists', async () => {
    const email = uniqueEmail()
    const agent = request.agent(app)

    await agent.post('/api/auth/register').send({
      firstName: 'Ryan',
      lastName: 'Pathirana',
      email,
      password,
    })

    await prisma.user.delete({ where: { email } })

    const response = await agent.get('/api/auth/me')

    expect(response.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the authentication cookie', async () => {
    const email = uniqueEmail()
    const agent = request.agent(app)

    await agent.post('/api/auth/register').send({
      firstName: 'Ryan',
      lastName: 'Pathirana',
      email,
      password,
    })

    const logoutResponse = await agent.post('/api/auth/logout')
    expect(logoutResponse.status).toBe(200)

    const meResponse = await agent.get('/api/auth/me')
    expect(meResponse.status).toBe(401)
  })
})

describe('requireRole middleware', () => {
  const adminOnlyApp = createAdminOnlyTestApp()

  it('rejects CUSTOMER access to an ADMIN-only route', async () => {
    const email = uniqueEmail()

    const registered = await request(app).post('/api/auth/register').send({
      firstName: 'Ryan',
      lastName: 'Pathirana',
      email,
      password,
    })

    const response = await request(adminOnlyApp)
      .get('/admin-only')
      .set('Cookie', cookieHeader(registered))

    expect(response.status).toBe(403)
    expect(response.body.error.message).toBe('Insufficient permissions')
  })

  it('allows an ADMIN user through requireRole', async () => {
    const email = uniqueEmail()
    await prisma.user.create({
      data: {
        firstName: 'Ops',
        lastName: 'Admin',
        email,
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
      },
    })

    const loggedIn = await request(app).post('/api/auth/login').send({
      email,
      password,
    })

    const response = await request(adminOnlyApp)
      .get('/admin-only')
      .set('Cookie', cookieHeader(loggedIn))

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true })
  })
})
