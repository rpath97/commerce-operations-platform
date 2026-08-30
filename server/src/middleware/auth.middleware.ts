import type { NextFunction, Request, Response } from 'express'
import { AUTH_COOKIE_NAME } from '../config/auth.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from './errorHandler.js'
import { verifyAuthToken } from '../utils/jwt.js'

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[AUTH_COOKIE_NAME]

  if (typeof token !== 'string' || token.length === 0) {
    next(new AppError(401, 'Authentication required'))
    return
  }

  try {
    const payload = verifyAuthToken(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    })

    if (!user) {
      next(new AppError(401, 'Authentication required'))
      return
    }

    req.auth = user
    next()
  } catch (error) {
    next(error)
  }
}
