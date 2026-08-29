import type { NextFunction, Request, Response } from 'express'

export class AppError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
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
    },
  })
}
