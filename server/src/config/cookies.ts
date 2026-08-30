import type { CookieOptions } from 'express'
import { AUTH_COOKIE_MAX_AGE_MS } from './auth.js'
import { env } from './env.js'

function authCookieBaseOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    path: '/',
  }
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
