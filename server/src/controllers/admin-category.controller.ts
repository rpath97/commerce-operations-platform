import type { Request, Response } from 'express'
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from '../services/category.service.js'
import {
  createCategorySchema,
  idParamSchema,
  updateCategorySchema,
} from '../validators/catalog.validator.js'
import { parseInput } from '../validators/parse.js'

export async function createCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseInput(createCategorySchema, req.body)
  const data = await createCategory(input)
  res.status(201).json({ data })
}

export async function updateCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseInput(idParamSchema, req.params)
  const input = parseInput(updateCategorySchema, req.body)
  const data = await updateCategory(id, input)
  res.status(200).json({ data })
}

export async function deleteCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = parseInput(idParamSchema, req.params)
  const data = await deleteCategory(id)
  res.status(200).json({ data })
}
