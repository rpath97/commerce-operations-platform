import { rateLimit } from 'express-rate-limit'
import { env } from '../config/env.js'

const WINDOW_MS = 15 * 60 * 1000
const PRODUCTION_MAX = 10
const TEST_MAX = 10_000

type AuthRateLimitOptions = {
  max?: number
  windowMs?: number
  message?: string
}

export function createAuthRateLimiter(options: AuthRateLimitOptions = {}) {
  const message =
    options.message ?? 'Too many login attempts. Please try again later.'

  return rateLimit({
    windowMs: options.windowMs ?? WINDOW_MS,
    limit: options.max ?? (env.nodeEnv === 'test' ? TEST_MAX : PRODUCTION_MAX),
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
      default: true,
    },
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          message,
        },
      })
    },
  })
}

export const loginRateLimiter = createAuthRateLimiter()

export const registerRateLimiter = createAuthRateLimiter({
  message: 'Too many registration attempts. Please try again later.',
})
