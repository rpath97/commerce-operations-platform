import type { Prisma } from '@prisma/client'

export type AuditClient = {
  auditLog: {
    create: (args: {
      data: {
        userId?: string | null
        action: string
        entityType: string
        entityId?: string | null
        metadata?: Prisma.InputJsonValue
      }
    }) => Promise<unknown>
  }
}

export async function writeAuditLog(
  client: AuditClient,
  input: {
    userId: string
    action: string
    entityType: string
    entityId: string
    metadata?: Prisma.InputJsonValue
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? {},
    },
  })
}
