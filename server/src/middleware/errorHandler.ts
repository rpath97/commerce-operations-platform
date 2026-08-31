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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBodyParserType(err: unknown, type: string): boolean {
  return isRecord(err) && err.type === type
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (
    isBodyParserType(err, 'entity.parse.failed') ||
    (err instanceof SyntaxError && isRecord(err) && 'body' in err)
  ) {
    res.status(400).json({
      error: {
        message: 'Invalid JSON body',
      },
    })
    return
  }

  if (isBodyParserType(err, 'entity.too.large')) {
    res.status(413).json({
      error: {
        message: 'Request body too large',
      },
    })
    return
  }

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
