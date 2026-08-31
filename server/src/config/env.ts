import 'dotenv/config'
import { parseTrustProxyHops } from './trustProxy.js'

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT value: ${value}`)
  }

  return parsed
}

const JWT_SECRET_MIN_LENGTH = 32

export function jwtSecretFromEnv(value: string | undefined): string {
  if (!value) {
    throw new Error('Missing environment variable: JWT_SECRET')
  }

  if (value.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`,
    )
  }

  return value
}

export function clientOriginFromEnv(
  nodeEnv: string,
  value: string | undefined,
): string {
  const origin = value?.trim()

  if (origin) {
    return origin
  }

  if (nodeEnv === 'production') {
    throw new Error('Missing environment variable: CLIENT_ORIGIN')
  }

  return 'http://localhost:5173'
}

const nodeEnv = process.env.NODE_ENV ?? 'development'

export const env = {
  nodeEnv,
  port: parsePort(process.env.PORT, 3001),
  clientOrigin: clientOriginFromEnv(nodeEnv, process.env.CLIENT_ORIGIN),
  jwtSecret: jwtSecretFromEnv(process.env.JWT_SECRET),
  trustProxyHops: parseTrustProxyHops(process.env.TRUST_PROXY_HOPS),
} as const
