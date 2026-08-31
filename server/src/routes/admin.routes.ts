import { Router } from 'express'
import {
  createCategoryHandler,
  deleteCategoryHandler,
  listAdminCategoriesHandler,
  updateCategoryHandler,
} from '../controllers/admin-category.controller.js'
import { getAdminDashboardHandler } from '../controllers/admin-dashboard.controller.js'
import {
  getAdminOrderHandler,
  listAdminOrdersHandler,
  updateAdminOrderStatusHandler,
} from '../controllers/admin-order.controller.js'
import {
  adjustInventoryHandler,
  getAdminInventoryHandler,
  listAdminInventoryHandler,
  listInventoryMovementsHandler,
  receiveInventoryHandler,
  updateInventorySettingsHandler,
} from '../controllers/admin-inventory.controller.js'
import {
  archiveProductHandler,
  createProductHandler,
  getAdminProductHandler,
  listAdminProductsHandler,
  updateInventoryHandler,
  updateProductHandler,
} from '../controllers/admin-product.controller.js'
import {
  createPromotionHandler,
  getAdminPromotionHandler,
  listAdminPromotionsHandler,
  updatePromotionHandler,
} from '../controllers/admin-promotion.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireRole } from '../middleware/role.middleware.js'

const adminRouter = Router()

adminRouter.use(requireAuth, requireRole('ADMIN'))

adminRouter.get('/dashboard', getAdminDashboardHandler)

adminRouter.get('/categories', listAdminCategoriesHandler)
adminRouter.post('/categories', createCategoryHandler)
adminRouter.patch('/categories/:id', updateCategoryHandler)
adminRouter.delete('/categories/:id', deleteCategoryHandler)

adminRouter.get('/products', listAdminProductsHandler)
adminRouter.get('/products/:id', getAdminProductHandler)
adminRouter.post('/products', createProductHandler)
adminRouter.patch('/products/:id', updateProductHandler)
adminRouter.patch('/products/:id/inventory', updateInventoryHandler)
adminRouter.delete('/products/:id', archiveProductHandler)

adminRouter.get('/inventory', listAdminInventoryHandler)
adminRouter.get('/inventory/:productId/movements', listInventoryMovementsHandler)
adminRouter.post('/inventory/:productId/receive', receiveInventoryHandler)
adminRouter.post('/inventory/:productId/adjust', adjustInventoryHandler)
adminRouter.patch('/inventory/:productId/settings', updateInventorySettingsHandler)
adminRouter.get('/inventory/:productId', getAdminInventoryHandler)

adminRouter.get('/orders', listAdminOrdersHandler)
adminRouter.get('/orders/:orderId', getAdminOrderHandler)
adminRouter.patch('/orders/:orderId/status', updateAdminOrderStatusHandler)

adminRouter.get('/promotions', listAdminPromotionsHandler)
adminRouter.get('/promotions/:promotionId', getAdminPromotionHandler)
adminRouter.post('/promotions', createPromotionHandler)
adminRouter.patch('/promotions/:promotionId', updatePromotionHandler)

export { adminRouter }
