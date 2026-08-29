export type HealthStatus = {
  status: 'ok'
  service: string
}

export function getHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    service: 'CommerceOps API',
  }
}
