import type { Role } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'
import { AppError } from './errorHandler.js'

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AppError(401, 'Authentication required'))
      return
    }

    if (!roles.includes(req.auth.role)) {
      next(new AppError(403, 'Insufficient permissions'))
      return
    }

    next()
  }
}
