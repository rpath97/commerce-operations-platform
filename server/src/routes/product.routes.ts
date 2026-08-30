import { Router } from 'express'
import {
  getPublicProductHandler,
  listPublicProductsHandler,
} from '../controllers/product.controller.js'

const productRouter = Router()

productRouter.get('/', listPublicProductsHandler)
productRouter.get('/:slug', getPublicProductHandler)

export { productRouter }
