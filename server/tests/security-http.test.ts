import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import {
  clientOriginFromEnv,
  env,
  jwtSecretFromEnv,
} from '../src/config/env.js'
import { buildAuthCookieBaseOptions } from '../src/config/cookies.js'
import {
  applyTrustProxy,
  parseTrustProxyHops,
} from '../src/config/trustProxy.js'
import { AppError, errorHandler } from '../src/middleware/errorHandler.js'
import { notFound } from '../src/middleware/notFound.js'

describe('HTTP security headers', () => {
  it('sets Helmet headers and does not advertise Express', async () => {
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.headers['x-powered-by']).toBeUndefined()
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['referrer-policy']).toEqual(expect.any(String))
    expect(
      response.headers['x-frame-options'] ??
        response.headers['content-security-policy'],
    ).toBeTruthy()
  })
})

describe('JSON body parser', () => {
  it('returns 400 for malformed JSON without leaking parser details', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      error: { message: 'Invalid JSON body' },
    })
    expect(JSON.stringify(response.body)).not.toMatch(/SyntaxError|stack|Unexpected/i)
  })

  it('returns 413 for an oversized JSON body', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: `${'a'.repeat(110_000)}@example.com`, password: 'x' })

    expect(response.status).toBe(413)
    expect(response.body).toEqual({
      error: { message: 'Request body too large' },
    })
    expect(JSON.stringify(response.body)).not.toMatch(/entity|limit|stack/i)
  })
})

describe('CORS', () => {
  it('allows the configured client origin with credentials', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', env.clientOrigin)

    expect(response.status).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBe(env.clientOrigin)
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  it('does not grant a foreign origin credentialed access', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil.example')

    expect(response.status).toBe(200)
    expect(response.headers['access-control-allow-origin']).not.toBe(
      'https://evil.example',
    )
    expect(response.headers['access-control-allow-origin']).not.toBe('*')
  })
})

describe('trusted origin defence-in-depth', () => {
  it('rejects an unsafe method from an explicit foreign Origin', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Origin', 'https://evil.example')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: { message: 'Forbidden' },
    })
  })

  it('allows an unsafe method from the configured client origin', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Origin', env.clientOrigin)

    expect(response.status).toBe(200)
  })

  it('allows an unsafe method when Origin is absent', async () => {
    const response = await request(app).post('/api/auth/logout')

    expect(response.status).toBe(200)
  })
})

describe('error handler', () => {
  it('preserves AppError status and message', async () => {
    const testApp = express()
    testApp.get('/denied', () => {
      throw new AppError(409, 'Conflict example')
    })
    testApp.use(errorHandler)

    const response = await request(testApp).get('/denied')
    expect(response.status).toBe(409)
    expect(response.body).toEqual({
      error: { message: 'Conflict example' },
    })
  })

  it('returns a generic 500 for unknown errors', async () => {
    const testApp = express()
    testApp.get('/boom', () => {
      throw new Error('Prisma query failed at /secret/path with DATABASE_URL')
    })
    testApp.use(errorHandler)

    const response = await request(testApp).get('/boom')
    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      error: { message: 'Internal server error' },
    })
    expect(JSON.stringify(response.body)).not.toMatch(
      /Prisma|DATABASE_URL|secret\/path|stack/i,
    )
  })

  it('returns a safe 404 for unknown API routes', async () => {
    const response = await request(app).get('/api/definitely-missing')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({
      error: { message: 'Route not found' },
    })
    expect(notFound).toEqual(expect.any(Function))
  })
})

describe('cookie production options', () => {
  it('sets Secure only in production', () => {
    expect(buildAuthCookieBaseOptions('development').secure).toBe(false)
    expect(buildAuthCookieBaseOptions('test').secure).toBe(false)
    expect(buildAuthCookieBaseOptions('production').secure).toBe(true)
    expect(buildAuthCookieBaseOptions('production').httpOnly).toBe(true)
    expect(buildAuthCookieBaseOptions('production').sameSite).toBe('lax')
    expect(buildAuthCookieBaseOptions('production').path).toBe('/')
  })
})

describe('production environment rules', () => {
  it('requires JWT_SECRET of at least 32 characters', () => {
    expect(() => jwtSecretFromEnv(undefined)).toThrow(
      'Missing environment variable: JWT_SECRET',
    )
    expect(() => jwtSecretFromEnv('short')).toThrow(
      'JWT_SECRET must be at least 32 characters',
    )
    const secret = 'replace-with-a-long-random-secret-at-least-32-characters'
    expect(secret.length).toBeGreaterThanOrEqual(32)
    expect(jwtSecretFromEnv(secret)).toBe(secret)
  })

  it('defaults CLIENT_ORIGIN only outside production', () => {
    expect(clientOriginFromEnv('development', undefined)).toBe(
      'http://localhost:5173',
    )
    expect(clientOriginFromEnv('test', undefined)).toBe(
      'http://localhost:5173',
    )
    expect(() => clientOriginFromEnv('production', undefined)).toThrow(
      'Missing environment variable: CLIENT_ORIGIN',
    )
    expect(clientOriginFromEnv('production', 'https://app.example.com')).toBe(
      'https://app.example.com',
    )
  })
})

describe('trust proxy', () => {
  it('parses TRUST_PROXY_HOPS as a positive integer', () => {
    expect(parseTrustProxyHops(undefined)).toBe(1)
    expect(parseTrustProxyHops('')).toBe(1)
    expect(parseTrustProxyHops('   ')).toBe(1)
    expect(parseTrustProxyHops('1')).toBe(1)
    expect(parseTrustProxyHops('2')).toBe(2)
    expect(() => parseTrustProxyHops('0')).toThrow(
      'Invalid TRUST_PROXY_HOPS value: 0',
    )
    expect(() => parseTrustProxyHops('-1')).toThrow(
      'Invalid TRUST_PROXY_HOPS value: -1',
    )
    expect(() => parseTrustProxyHops('1.5')).toThrow(
      'Invalid TRUST_PROXY_HOPS value: 1.5',
    )
    expect(() => parseTrustProxyHops('true')).toThrow(
      'Invalid TRUST_PROXY_HOPS value: true',
    )
  })

  it('does not trust proxy chains outside production', () => {
    const developmentApp = express()
    applyTrustProxy(developmentApp, 'development', 2)
    expect(developmentApp.get('trust proxy')).toBeFalsy()
    expect(developmentApp.get('trust proxy')).not.toBe(true)

    const testEnvApp = express()
    applyTrustProxy(testEnvApp, 'test', 2)
    expect(testEnvApp.get('trust proxy')).toBeFalsy()
    expect(testEnvApp.get('trust proxy')).not.toBe(true)
  })

  it('applies the configured hop count in production and never uses true', () => {
    const oneHopApp = express()
    applyTrustProxy(oneHopApp, 'production', 1)
    expect(oneHopApp.get('trust proxy')).toBe(1)
    expect(oneHopApp.get('trust proxy')).not.toBe(true)

    const twoHopApp = express()
    applyTrustProxy(twoHopApp, 'production', 2)
    expect(twoHopApp.get('trust proxy')).toBe(2)
    expect(twoHopApp.get('trust proxy')).not.toBe(true)
  })

  it('rejects a non-positive hop count in production', () => {
    const testApp = express()
    expect(() => applyTrustProxy(testApp, 'production', 0)).toThrow(
      'Invalid TRUST_PROXY_HOPS value: 0',
    )
    expect(testApp.get('trust proxy')).toBeFalsy()
  })
})
