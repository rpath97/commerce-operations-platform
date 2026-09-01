import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import {
  attachProductionFrontend,
  isApiPath,
  resolveClientDist,
} from '../src/frontend.js'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { notFound } from '../src/middleware/notFound.js'

describe('production frontend path helpers', () => {
  it('resolves client/dist from the compiled server module location', () => {
    const resolved = resolveClientDist()
    const normalized = resolved.replaceAll('\\', '/')

    expect(normalized.endsWith('/client/dist')).toBe(true)
  })

  it('treats only /api paths as API requests', () => {
    expect(isApiPath('/api')).toBe(true)
    expect(isApiPath('/api/health')).toBe(true)
    expect(isApiPath('/api/definitely-missing')).toBe(true)
    expect(isApiPath('/')).toBe(false)
    expect(isApiPath('/shop')).toBe(false)
    expect(isApiPath('/admin/orders')).toBe(false)
    expect(isApiPath('/apifake')).toBe(false)
  })
})

describe('non-production Express process', () => {
  it('does not serve the React SPA from the API process', async () => {
    const response = await request(app).get('/shop')

    expect(response.status).toBe(404)
    expect(response.headers['content-type']).toMatch(/json/)
    expect(response.body).toEqual({
      error: { message: 'Route not found' },
    })
  })
})

describe('production frontend serving', () => {
  let distDir: string
  let productionApp: express.Express

  beforeAll(() => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noryx-spa-'))
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<!doctype html><html><head><title>Noryx SPA</title></head><body>spa-shell</body></html>',
    )
    fs.writeFileSync(path.join(distDir, 'asset.js'), 'window.__SPA_ASSET__=1')

    productionApp = express()
    productionApp.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', service: 'Noryx API' })
    })
    productionApp.use('/api', notFound)
    attachProductionFrontend(productionApp, distDir)
    productionApp.use(notFound)
    productionApp.use(errorHandler)
  })

  afterAll(() => {
    fs.rmSync(distDir, { recursive: true, force: true })
  })

  it('serves the React application at GET /', async () => {
    const response = await request(productionApp).get('/')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/html/)
    expect(response.text).toContain('Noryx SPA')
  })

  it('serves the React application for a client-side route', async () => {
    const response = await request(productionApp).get('/shop')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/html/)
    expect(response.text).toContain('spa-shell')
  })

  it('serves hashed static assets from the client build', async () => {
    const response = await request(productionApp).get('/asset.js')

    expect(response.status).toBe(200)
    expect(response.text).toContain('window.__SPA_ASSET__=1')
  })

  it('returns API JSON for GET /api/health', async () => {
    const response = await request(productionApp).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/json/)
    expect(response.body).toEqual({
      status: 'ok',
      service: 'Noryx API',
    })
    expect(response.text).not.toContain('spa-shell')
  })

  it('does not fall through to index.html for an unknown /api path', async () => {
    const response = await request(productionApp).get('/api/definitely-missing')

    expect(response.status).toBe(404)
    expect(response.headers['content-type']).toMatch(/json/)
    expect(response.body).toEqual({
      error: { message: 'Route not found' },
    })
    expect(response.text).not.toContain('spa-shell')
    expect(response.text).not.toContain('<!doctype html>')
  })
})
