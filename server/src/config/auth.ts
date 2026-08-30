import type { Role } from '@prisma/client'

export const AUTH_COOKIE_NAME = 'commerceops_token'
export const BCRYPT_COST_FACTOR = 12
export const JWT_EXPIRES_IN = '7d'
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type AuthTokenPayload = {
  userId: string
  role: Role
}

export type PublicUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: Role
}
