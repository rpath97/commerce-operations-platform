import type { CookieOptions } from 'express'
import { AUTH_COOKIE_MAX_AGE_MS } from './auth.js'
import { env } from './env.js'

export function buildAuthCookieBaseOptions(nodeEnv: string): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: nodeEnv === 'production',
    path: '/',
  }
}

function authCookieBaseOptions(): CookieOptions {
  return buildAuthCookieBaseOptions(env.nodeEnv)
}

export function authCookieOptions(): CookieOptions {
  return {
    ...authCookieBaseOptions(),
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  }
}

export function authCookieClearOptions(): CookieOptions {
  return authCookieBaseOptions()
}
