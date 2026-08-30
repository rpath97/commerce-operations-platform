import { Router } from 'express'
import {
  getDatabaseHealth,
  getHealth,
} from '../controllers/health.controller.js'

const healthRouter = Router()

healthRouter.get('/database', getDatabaseHealth)
healthRouter.get('/', getHealth)

export { healthRouter }
