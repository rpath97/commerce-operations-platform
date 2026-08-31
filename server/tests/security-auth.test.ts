import { randomUUID } from 'node:crypto'
import cookieParser from 'cookie-parser'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import {
  AUTH_COOKIE_MAX_AGE_MS,
  AUTH_COOKIE_NAME,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from '../src/config/auth.js'
import { env } from '../src/config/env.js'
import { prisma } from '../src/lib/prisma.js'
import { createAuthRateLimiter } from '../src/middleware/authRateLimit.js'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { login } from '../src/controllers/auth.controller.js'
import { hashPassword } from '../src/utils/password.js'

const password = 'SecurePassword123!'
const createdEmails: string[] = []

function uniqueEmail(): string {
  const email = `phase13-sec-${randomUUID()}@example.com`
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

function authCookieValue(response: request.Response): string {
  const line = cookieHeader(response).find((value) =>
    value.startsWith(`${AUTH_COOKIE_NAME}=`),
  )
  if (!line) {
    throw new Error('Missing auth cookie')
  }
  return line
}

function signToken(
  payload: Record<string, unknown>,
  overrides: jwt.SignOptions = {},
): string {
  return jwt.sign(payload, env.jwtSecret, {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: '1h',
    ...overrides,
  })
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

describe('auth cookie attributes', () => {
  it('issues an HttpOnly SameSite=Lax session cookie', async () => {
    const email = uniqueEmail()
    const response = await request(app).post('/api/auth/register').send({
      firstName: 'Phase13',
      lastName: 'Cookie',
      email,
      password,
    })

    expect(response.status).toBe(201)
    const cookie = authCookieValue(response)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Path=\//i)
    expect(cookie).toMatch(new RegExp(`Max-Age=${AUTH_COOKIE_MAX_AGE_MS / 1000}`))
    expect(cookie).not.toMatch(/Secure/i)
    expect(response.body).not.toHaveProperty('token')
  })

  it('clears the cookie with compatible attributes', async () => {
    const email = uniqueEmail()
    const registered = await request(app).post('/api/auth/register').send({
      firstName: 'Phase13',
      lastName: 'Logout',
      email,
      password,
    })

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookieHeader(registered))

    expect(response.status).toBe(200)
    const cookie = authCookieValue(response)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Path=\//i)
    expect(cookie).toMatch(/Max-Age=0|Expires=/i)
  })
})

describe('JWT verification', () => {
  it('rejects missing, malformed, tampered, expired, and policy-mismatched tokens', async () => {
    const email = uniqueEmail()
    const user = await prisma.user.create({
      data: {
        firstName: 'Phase13',
        lastName: 'Jwt',
        email,
        passwordHash: await hashPassword(password),
        role: 'CUSTOMER',
      },
    })

    const valid = signToken({ userId: user.id, role: 'CUSTOMER' })
    const tampered = `${valid.slice(0, -4)}abcd`
    const expired = jwt.sign(
      {
        userId: user.id,
        role: 'CUSTOMER',
        exp: Math.floor(Date.now() / 1000) - 30,
      },
      env.jwtSecret,
      {
        algorithm: JWT_ALGORITHM,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      },
    )
    const wrongIssuer = signToken(
      { userId: user.id, role: 'CUSTOMER' },
      { issuer: 'not-commerceops' },
    )
    const wrongAudience = signToken(
      { userId: user.id, role: 'CUSTOMER' },
      { audience: 'not-commerceops' },
    )
    const wrongAlgorithm = jwt.sign(
      { userId: user.id, role: 'CUSTOMER' },
      env.jwtSecret,
      {
        algorithm: 'HS384',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: '1h',
      },
    )
    const missingUser = signToken({ userId: randomUUID(), role: 'CUSTOMER' })

    const cases = [
      { cookie: undefined, label: 'missing' },
      { cookie: [`${AUTH_COOKIE_NAME}=not-a-jwt`], label: 'malformed' },
      { cookie: [`${AUTH_COOKIE_NAME}=${tampered}`], label: 'tampered' },
      { cookie: [`${AUTH_COOKIE_NAME}=${expired}`], label: 'expired' },
      { cookie: [`${AUTH_COOKIE_NAME}=${wrongIssuer}`], label: 'issuer' },
      { cookie: [`${AUTH_COOKIE_NAME}=${wrongAudience}`], label: 'audience' },
      { cookie: [`${AUTH_COOKIE_NAME}=${wrongAlgorithm}`], label: 'algorithm' },
      { cookie: [`${AUTH_COOKIE_NAME}=${missingUser}`], label: 'deleted-user' },
    ]

    for (const testCase of cases) {
      const requestBuilder = request(app).get('/api/auth/me')
      if (testCase.cookie) {
        requestBuilder.set('Cookie', testCase.cookie)
      }

      const response = await requestBuilder
      expect(response.status, testCase.label).toBe(401)
      expect(response.body).toEqual({
        error: { message: 'Authentication required' },
      })
      expect(JSON.stringify(response.body)).not.toMatch(
        /jwt|expired|signature|issuer|audience|algorithm/i,
      )
    }
  })

  it('authorizes from the database role, not a forged ADMIN claim', async () => {
    const email = uniqueEmail()
    const user = await prisma.user.create({
      data: {
        firstName: 'Phase13',
        lastName: 'Customer',
        email,
        passwordHash: await hashPassword(password),
        role: 'CUSTOMER',
      },
    })

    const forged = signToken({ userId: user.id, role: 'ADMIN' })
    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${forged}`])

    expect(response.status).toBe(403)
    expect(response.body.error.message).toBe('Insufficient permissions')
  })
})

describe('login rate limit', () => {
  it('returns 429 JSON after repeated failed logins', async () => {
    const limiter = createAuthRateLimiter({ max: 2, windowMs: 60_000 })
    const testApp = express()
    testApp.use(express.json())
    testApp.use(cookieParser())
    testApp.post('/login', limiter, login)
    testApp.use(errorHandler)

    const payload = {
      email: uniqueEmail(),
      password: 'WrongPassword123!',
    }

    const first = await request(testApp).post('/login').send(payload)
    const second = await request(testApp).post('/login').send(payload)
    const limited = await request(testApp).post('/login').send(payload)

    expect(first.status).toBe(401)
    expect(second.status).toBe(401)
    expect(limited.status).toBe(429)
    expect(limited.body).toEqual({
      error: {
        message: 'Too many login attempts. Please try again later.',
      },
    })
    expect(JSON.stringify(limited.body)).not.toMatch(/remaining|limit|hits|count/i)
    expect(limited.headers['content-type']).toMatch(/json/)
  })
})

describe('input validation security', () => {
  it('rejects checkout computed-money mass assignment', async () => {
    const email = uniqueEmail()
    const registered = await request(app).post('/api/auth/register').send({
      firstName: 'Phase13',
      lastName: 'Order',
      email,
      password,
    })

    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', cookieHeader(registered))
      .send({
        addressId: randomUUID(),
        total: '0.01',
        subtotal: '0.01',
        discountAmount: '999.00',
        shippingAmount: '0.00',
        status: 'DELIVERED',
      })

    expect(response.status).toBe(400)
    expect(response.body.error.message).toBe('Validation failed')
  })

  it('treats an injection-like catalogue search as data', async () => {
    const response = await request(app).get(
      `/api/products?search=${encodeURIComponent("' OR 1=1 --")}`,
    )

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('data')
    expect(Array.isArray(response.body.data)).toBe(true)
    expect(JSON.stringify(response.body)).not.toMatch(
      /Prisma|SQL syntax|syntax error/i,
    )
  })

  it('rejects an invalid analytics range', async () => {
    const email = uniqueEmail()
    await prisma.user.create({
      data: {
        firstName: 'Phase13',
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

    const response = await request(app)
      .get('/api/admin/analytics?range=forever')
      .set('Cookie', cookieHeader(loggedIn))

    expect(response.status).toBe(400)
    expect(response.body.error.message).toBe('Validation failed')
  })
})
