import { AppError } from '../middleware/errorHandler.js'
import type { Request } from 'express'

export function requireUserId(req: Request): string {
  if (!req.auth) {
    throw new AppError(401, 'Authentication required')
  }

  return req.auth.id
}
