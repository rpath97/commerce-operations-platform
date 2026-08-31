import type { Request, Response } from 'express'
import { requireUserId } from '../lib/request-auth.js'
import {
  archiveProduct,
  createProduct,
  getAdminProduct,
  listAdminProducts,
  updateProduct,
  updateProductInventory,
} from '../services/product.service.js'
import {
  adminProductQuerySchema,
} from '../validators/admin.validator.js'
import {
  createProductSchema,
  idParamSchema,
  updateInventorySchema,
  updateProductSchema,
} from '../validators/catalog.validator.js'
import { parseInput } from '../validators/parse.js'

export async function listAdminProductsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseInput(adminProductQuerySchema, req.query)
  const result = await listAdminProducts(query)
  res.status(200).json(result)
}

export async function getAdminProductHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseInput(idParamSchema, req.params)
  const data = await getAdminProduct(id)
  res.status(200).json({ data })
}

export async function createProductHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseInput(createProductSchema, req.body)
  const data = await createProduct(input, requireUserId(req))
  res.status(201).json({ data })
}

export async function updateProductHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseInput(idParamSchema, req.params)
  const input = parseInput(updateProductSchema, req.body)
  const data = await updateProduct(id, input, requireUserId(req))
  res.status(200).json({ data })
}

export async function updateInventoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseInput(idParamSchema, req.params)
  const input = parseInput(updateInventorySchema, req.body)
  const data = await updateProductInventory(id, input, requireUserId(req))
  res.status(200).json({ data })
}

export async function archiveProductHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseInput(idParamSchema, req.params)
  const data = await archiveProduct(id, requireUserId(req))
  res.status(200).json({ data })
}
