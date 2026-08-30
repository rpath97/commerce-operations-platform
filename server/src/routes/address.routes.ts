import { Router } from 'express'
import {
  createAddressHandler,
  deleteAddressHandler,
  listAddressesHandler,
  updateAddressHandler,
} from '../controllers/address.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const addressRouter = Router()

addressRouter.use(requireAuth)

addressRouter.get('/', listAddressesHandler)
addressRouter.post('/', createAddressHandler)
addressRouter.patch('/:addressId', updateAddressHandler)
addressRouter.delete('/:addressId', deleteAddressHandler)

export { addressRouter }
