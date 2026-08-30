import 'dotenv/config'

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

function jwtSecretFromEnv(): string {
  const value = process.env.JWT_SECRET

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

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parsePort(process.env.PORT, 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: jwtSecretFromEnv(),
} as const
