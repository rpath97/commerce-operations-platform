import type { Request, Response } from 'express'
import { getAdminDashboard } from '../services/admin-dashboard.service.js'

export async function getAdminDashboardHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const result = await getAdminDashboard()
  res.status(200).json(result)
}
