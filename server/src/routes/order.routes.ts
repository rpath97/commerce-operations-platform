import { Router } from 'express'
import {
  createOrderHandler,
  getOrderHandler,
  listOrdersHandler,
} from '../controllers/order.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const orderRouter = Router()

orderRouter.use(requireAuth)

orderRouter.get('/', listOrdersHandler)
orderRouter.post('/', createOrderHandler)
orderRouter.get('/:orderId', getOrderHandler)

export { orderRouter }
