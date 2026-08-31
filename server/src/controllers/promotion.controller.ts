import type { Request, Response } from 'express'
import { requireUserId } from '../lib/request-auth.js'
import { validatePromotionForUser } from '../services/promotion.service.js'
import { parseInput } from '../validators/parse.js'
import { validatePromotionSchema } from '../validators/promotion.validator.js'

export async function validatePromotionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { code } = parseInput(validatePromotionSchema, req.body)
  const data = await validatePromotionForUser(requireUserId(req), code)
  res.status(200).json({ data })
}
