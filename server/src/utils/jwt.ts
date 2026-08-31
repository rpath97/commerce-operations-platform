import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_EXPIRES_IN,
  JWT_ISSUER,
  type AuthTokenPayload,
} from '../config/auth.js'
import { env } from '../config/env.js'
import { AppError } from '../middleware/errorHandler.js'

const signVerifyOptions = {
  algorithm: JWT_ALGORITHM,
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
} as const

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(
    { userId: payload.userId, role: payload.role },
    env.jwtSecret,
    {
      expiresIn: JWT_EXPIRES_IN,
      ...signVerifyOptions,
    },
  )
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  try {
    const decoded: unknown = jwt.verify(token, env.jwtSecret, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })

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
