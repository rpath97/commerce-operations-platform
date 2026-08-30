import type { Request, Response } from 'express'
import { AUTH_COOKIE_NAME } from '../config/auth.js'
import {
  authCookieClearOptions,
  authCookieOptions,
} from '../config/cookies.js'
import { loginUser, registerUser } from '../services/auth.service.js'
import { loginSchema, registerSchema } from '../validators/auth.validator.js'
import { AppError } from '../middleware/errorHandler.js'
import type { ZodType } from 'zod'

function parseBody<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    throw new AppError(400, 'Validation failed', result.error.flatten())
  }

  return result.data
}

export async function register(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseBody(registerSchema, req.body)
  const { user, token } = await registerUser(input)

  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions())
  res.status(201).json({ user })
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = parseBody(loginSchema, req.body)
  const { user, token } = await loginUser(input)

  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions())
  res.status(200).json({ user })
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieClearOptions())
  res.status(200).json({ message: 'Logged out' })
}

export function me(req: Request, res: Response): void {
  if (!req.auth) {
    throw new AppError(401, 'Authentication required')
  }

  res.status(200).json({ user: req.auth })
}
