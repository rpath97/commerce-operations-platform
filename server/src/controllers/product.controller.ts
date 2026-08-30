import type { Request, Response } from 'express'
import {
  getPublicProductBySlug,
  listPublicProducts,
} from '../services/product.service.js'
import {
  productQuerySchema,
  slugParamSchema,
} from '../validators/catalog.validator.js'
import { parseInput } from '../validators/parse.js'

export async function listPublicProductsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseInput(productQuerySchema, req.query)
  const result = await listPublicProducts(query)
  res.status(200).json(result)
}

export async function getPublicProductHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { slug } = parseInput(slugParamSchema, req.params)
  const data = await getPublicProductBySlug(slug)
  res.status(200).json({ data })
}
