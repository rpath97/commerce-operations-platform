import type { ZodType } from 'zod'
import { AppError } from '../middleware/errorHandler.js'

export function parseInput<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    throw new AppError(400, 'Validation failed', result.error.flatten())
  }

  return result.data
}
