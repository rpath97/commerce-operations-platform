import { Router } from 'express'
import { login, logout, me, register } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import {
  loginRateLimiter,
  registerRateLimiter,
} from '../middleware/authRateLimit.js'

const authRouter = Router()

authRouter.post('/register', registerRateLimiter, register)
authRouter.post('/login', loginRateLimiter, login)
authRouter.post('/logout', logout)
authRouter.get('/me', requireAuth, me)

export { authRouter }
