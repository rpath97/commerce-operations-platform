import { Router } from 'express'
import {
  addCartItemHandler,
  clearCartHandler,
  getCartHandler,
  removeCartItemHandler,
  updateCartItemHandler,
} from '../controllers/cart.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const cartRouter = Router()

cartRouter.use(requireAuth)

cartRouter.get('/', getCartHandler)
cartRouter.delete('/', clearCartHandler)
cartRouter.post('/items', addCartItemHandler)
cartRouter.patch('/items/:itemId', updateCartItemHandler)
cartRouter.delete('/items/:itemId', removeCartItemHandler)

export { cartRouter }
