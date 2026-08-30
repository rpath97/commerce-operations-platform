import type { Request, Response } from 'express'
import { requireUserId } from '../lib/request-auth.js'
import {
  createCategory,
  deleteCategory,
  listAdminCategories,
  updateCategory,
} from '../services/category.service.js'
import {
  createCategorySchema,
  idParamSchema,
  updateCategorySchema,
} from '../validators/catalog.validator.js'
import { parseInput } from '../validators/parse.js'

export async function listAdminCategoriesHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const data = await listAdminCategories()
  res.status(200).json({ data })
}

export async function createCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseInput(createCategorySchema, req.body)
  const data = await createCategory(input, requireUserId(req))
  res.status(201).json({ data })
}

export async function updateCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseInput(idParamSchema, req.params)
  const input = parseInput(updateCategorySchema, req.body)
  const data = await updateCategory(id, input, requireUserId(req))
  res.status(200).json({ data })
}

export async function deleteCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseInput(idParamSchema, req.params)
  const data = await deleteCategory(id, requireUserId(req))
  res.status(200).json({ data })
}
