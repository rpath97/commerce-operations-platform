import { Router } from 'express'
import {
  getPublicCategory,
  listPublicCategories,
} from '../controllers/category.controller.js'

const categoryRouter = Router()

categoryRouter.get('/', listPublicCategories)
categoryRouter.get('/:slug', getPublicCategory)

export { categoryRouter }
