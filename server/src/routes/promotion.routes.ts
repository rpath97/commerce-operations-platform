import { Router } from 'express'
import { validatePromotionHandler } from '../controllers/promotion.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const promotionRouter = Router()

promotionRouter.use(requireAuth)
promotionRouter.post('/validate', validatePromotionHandler)

export { promotionRouter }
