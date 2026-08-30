import type { NextFunction, Request, Response } from 'express'

export class AppError extends Error {
  readonly statusCode: number
  readonly details?: unknown

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.details = details
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isAppError = err instanceof AppError
  const statusCode = isAppError ? err.statusCode : 500
  const message = isAppError ? err.message : 'Internal server error'

  if (process.env.NODE_ENV !== 'test') {
    console.error(err)
  }

  res.status(statusCode).json({
    error: {
      message,
      ...(isAppError && err.details !== undefined ? { details: err.details } : {}),
    },
  })
}
