import type { Express } from 'express'

const DEFAULT_TRUST_PROXY_HOPS = 1

/**
 * Production hop count is environment-driven. Hosts may put more than one
 * proxy in front of the process; do not assume a fixed topology, and never
 * set `trust proxy` to `true`.
 */
export function parseTrustProxyHops(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_TRUST_PROXY_HOPS
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid TRUST_PROXY_HOPS value: ${value}`)
  }

  return parsed
}

export function applyTrustProxy(
  app: Express,
  nodeEnv: string,
  hops: number,
): void {
  if (nodeEnv !== 'production') {
    return
  }

  if (!Number.isInteger(hops) || hops <= 0) {
    throw new Error(`Invalid TRUST_PROXY_HOPS value: ${hops}`)
  }

  app.set('trust proxy', hops)
}
