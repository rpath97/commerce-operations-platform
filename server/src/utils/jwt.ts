import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'
import { JWT_EXPIRES_IN, type AuthTokenPayload } from '../config/auth.js'
import { env } from '../config/env.js'
import { AppError } from '../middleware/errorHandler.js'

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  try {
    const decoded: unknown = jwt.verify(token, env.jwtSecret)

    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('userId' in decoded) ||
      !('role' in decoded) ||
      typeof decoded.userId !== 'string' ||
      (decoded.role !== 'CUSTOMER' && decoded.role !== 'ADMIN')
    ) {
      throw new AppError(401, 'Authentication required')
    }

    return {
      userId: decoded.userId,
      role: decoded.role as Role,
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }

    throw new AppError(401, 'Authentication required')
  }
}
