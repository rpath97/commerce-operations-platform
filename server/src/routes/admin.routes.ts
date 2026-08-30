import { Router } from 'express'
import {
  createCategoryHandler,
  deleteCategoryHandler,
  updateCategoryHandler,
} from '../controllers/admin-category.controller.js'
import {
  archiveProductHandler,
  createProductHandler,
  updateInventoryHandler,
  updateProductHandler,
} from '../controllers/admin-product.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireRole } from '../middleware/role.middleware.js'

const adminRouter = Router()

adminRouter.use(requireAuth, requireRole('ADMIN'))

adminRouter.post('/categories', createCategoryHandler)
adminRouter.patch('/categories/:id', updateCategoryHandler)
adminRouter.delete('/categories/:id', deleteCategoryHandler)

adminRouter.post('/products', createProductHandler)
adminRouter.patch('/products/:id', updateProductHandler)
adminRouter.patch('/products/:id/inventory', updateInventoryHandler)
adminRouter.delete('/products/:id', archiveProductHandler)

export { adminRouter }
