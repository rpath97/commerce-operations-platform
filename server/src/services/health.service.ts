import { prisma } from '../lib/prisma.js'

export type HealthStatus = {
  status: 'ok'
  service: string
}

export type DatabaseHealthStatus =
  | {
      status: 'ok'
      database: 'connected'
    }
  | {
      status: 'error'
      database: 'disconnected'
    }

export function getHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    service: 'CommerceOps API',
  }
}

export async function getDatabaseHealthStatus(): Promise<DatabaseHealthStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return {
      status: 'ok',
      database: 'connected',
    }
  } catch {
    return {
      status: 'error',
      database: 'disconnected',
    }
  }
}
