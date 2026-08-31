import type { Request, Response } from 'express'
import { requireUserId } from '../lib/request-auth.js'
import {
  adjustInventory,
  getAdminInventory,
  listAdminInventory,
  listInventoryMovements,
  receiveInventory,
  updateInventorySettings,
} from '../services/inventory.service.js'
import {
  adjustInventorySchema,
  adminInventoryQuerySchema,
  inventoryMovementQuerySchema,
  inventorySettingsSchema,
  productIdParamSchema,
  receiveInventorySchema,
} from '../validators/inventory.validator.js'
import { parseInput } from '../validators/parse.js'

export async function listAdminInventoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseInput(adminInventoryQuerySchema, req.query)
  const result = await listAdminInventory(query)
  res.status(200).json(result)
}

export async function getAdminInventoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { productId } = parseInput(productIdParamSchema, req.params)
  const data = await getAdminInventory(productId)
  res.status(200).json({ data })
}

export async function receiveInventoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { productId } = parseInput(productIdParamSchema, req.params)
  const input = parseInput(receiveInventorySchema, req.body)
  const data = await receiveInventory(productId, input, requireUserId(req))
  res.status(200).json({ data })
}

export async function adjustInventoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { productId } = parseInput(productIdParamSchema, req.params)
  const input = parseInput(adjustInventorySchema, req.body)
  const data = await adjustInventory(productId, input, requireUserId(req))
  res.status(200).json({ data })
}

export async function updateInventorySettingsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { productId } = parseInput(productIdParamSchema, req.params)
  const input = parseInput(inventorySettingsSchema, req.body)
  const data = await updateInventorySettings(
    productId,
    input,
    requireUserId(req),
  )
  res.status(200).json({ data })
}

export async function listInventoryMovementsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { productId } = parseInput(productIdParamSchema, req.params)
  const query = parseInput(inventoryMovementQuerySchema, req.query)
  const result = await listInventoryMovements(productId, query)
  res.status(200).json(result)
}
