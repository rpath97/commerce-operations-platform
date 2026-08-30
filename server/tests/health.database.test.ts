import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

const { prisma } = await import('../src/lib/prisma.js')
const { app } = await import('../src/app.js')

const queryRawMock = vi.mocked(prisma.$queryRaw)

describe('GET /api/health/database', () => {
  beforeEach(() => {
    queryRawMock.mockReset()
  })

  it('returns connected when the database responds', async () => {
    queryRawMock.mockResolvedValue([{ '?column?': 1 }] as never)

    const response = await request(app).get('/api/health/database')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: 'ok',
      database: 'connected',
    })
  })

  it('returns 503 when the database is unavailable', async () => {
    queryRawMock.mockRejectedValue(new Error('connect ECONNREFUSED'))

    const response = await request(app).get('/api/health/database')

    expect(response.status).toBe(503)
    expect(response.body).toEqual({
      status: 'error',
      database: 'disconnected',
    })
  })
})
