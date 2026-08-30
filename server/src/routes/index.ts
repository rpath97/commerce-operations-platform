import { Router } from 'express'
import { adminRouter } from './admin.routes.js'
import { authRouter } from './auth.routes.js'
import { categoryRouter } from './category.routes.js'
import { healthRouter } from './health.routes.js'
import { productRouter } from './product.routes.js'

const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/categories', categoryRouter)
apiRouter.use('/products', productRouter)
apiRouter.use('/admin', adminRouter)

export { apiRouter }
