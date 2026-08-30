import type { Request, Response } from 'express'
import {
  getDatabaseHealthStatus,
  getHealthStatus,
} from '../services/health.service.js'

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json(getHealthStatus())
}

export async function getDatabaseHealth(
  _req: Request,
  res: Response,
): Promise<void> {
  const payload = await getDatabaseHealthStatus()
  const statusCode = payload.status === 'ok' ? 200 : 503

  res.status(statusCode).json(payload)
}
