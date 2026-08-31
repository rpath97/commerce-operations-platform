import type { Request, Response } from 'express'
import { getAdminAnalytics } from '../services/admin-analytics.service.js'
import { analyticsQuerySchema } from '../validators/analytics.validator.js'
import { parseInput } from '../validators/parse.js'

export async function getAdminAnalyticsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseInput(analyticsQuerySchema, req.query)
  const data = await getAdminAnalytics(query.range)
  res.status(200).json({ data })
}
