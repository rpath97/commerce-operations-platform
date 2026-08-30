import type { Request, Response } from 'express'
import {
  getCategoryBySlug,
  listCategories,
} from '../services/category.service.js'
import { parseInput } from '../validators/parse.js'
import { slugParamSchema } from '../validators/catalog.validator.js'

export async function listPublicCategories(
  _req: Request,
  res: Response,
): Promise<void> {
  const data = await listCategories()
  res.status(200).json({ data })
}

export async function getPublicCategory(
  req: Request,
  res: Response,
): Promise<void> {
  const { slug } = parseInput(slugParamSchema, req.params)
  const data = await getCategoryBySlug(slug)
  res.status(200).json({ data })
}
