import { Router } from 'express'
import { authRouter } from './auth.routes.js'
import { healthRouter } from './health.routes.js'

const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/auth', authRouter)

export { apiRouter }
