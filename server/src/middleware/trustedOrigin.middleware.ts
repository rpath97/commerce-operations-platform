import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'
import { AppError } from './errorHandler.js'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function requireTrustedOrigin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!UNSAFE_METHODS.has(req.method.toUpperCase())) {
    next()
    return
  }

  const origin = req.get('origin')

  if (!origin) {
    next()
    return
  }

  if (origin === env.clientOrigin) {
    next()
    return
  }

  next(new AppError(403, 'Forbidden'))
}
