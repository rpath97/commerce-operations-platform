import type { Request, Response } from 'express'
import { requireUserId } from '../lib/request-auth.js'
import {
  createPromotion,
  getAdminPromotion,
  listAdminPromotions,
  updatePromotion,
} from '../services/promotion.service.js'
import { parseInput } from '../validators/parse.js'
import {
  adminPromotionQuerySchema,
  createPromotionSchema,
  promotionIdParamSchema,
  updatePromotionSchema,
} from '../validators/promotion.validator.js'

export async function listAdminPromotionsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseInput(adminPromotionQuerySchema, req.query)
  const result = await listAdminPromotions(query)
  res.status(200).json(result)
}

export async function getAdminPromotionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { promotionId } = parseInput(promotionIdParamSchema, req.params)
  const data = await getAdminPromotion(promotionId)
  res.status(200).json({ data })
}

export async function createPromotionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseInput(createPromotionSchema, req.body)
  const data = await createPromotion(input, requireUserId(req))
  res.status(201).json({ data })
}

export async function updatePromotionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { promotionId } = parseInput(promotionIdParamSchema, req.params)
  const input = parseInput(updatePromotionSchema, req.body)
  const data = await updatePromotion(promotionId, input, requireUserId(req))
  res.status(200).json({ data })
}
