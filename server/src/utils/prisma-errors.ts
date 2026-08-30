import { Prisma } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'

export function throwIfUniqueConflict(
  error: unknown,
  messages: Record<string, string>,
): never | void {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return
  }

  const target = error.meta?.target
  const fields = Array.isArray(target)
    ? target.map((field) => String(field))
    : typeof target === 'string'
      ? [target]
      : []
  const haystack = fields.join(' ').toLowerCase()

  for (const field of Object.keys(messages)) {
    if (fields.includes(field) || haystack.includes(field.toLowerCase())) {
      throw new AppError(409, messages[field])
    }
  }

  throw new AppError(409, 'A record with these details already exists')
}
