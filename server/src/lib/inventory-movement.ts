import type { InventoryMovementType, Prisma } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'

export type InventoryMovementClient = {
  inventoryMovement: {
    create: (args: {
      data: {
        productId: string
        type: InventoryMovementType
        quantityDelta: number
        quantityBefore: number
        quantityAfter: number
        note?: string | null
        referenceType?: string | null
        referenceId?: string | null
        actorUserId?: string | null
      }
    }) => Promise<unknown>
  }
}

export function stockStatus(
  quantity: number,
  lowStockThreshold: number,
): 'healthy' | 'low-stock' | 'out-of-stock' {
  if (quantity <= 0) {
    return 'out-of-stock'
  }
  if (quantity <= lowStockThreshold) {
    return 'low-stock'
  }
  return 'healthy'
}

export function assertMovementInvariant(
  quantityBefore: number,
  quantityDelta: number,
  quantityAfter: number,
): void {
  if (quantityAfter < 0) {
    throw new AppError(409, 'Inventory quantity cannot be negative')
  }
  if (quantityAfter !== quantityBefore + quantityDelta) {
    throw new AppError(500, 'Inventory movement values are inconsistent')
  }
}

export async function writeInventoryMovement(
  client: InventoryMovementClient,
  input: {
    productId: string
    type: InventoryMovementType
    quantityDelta: number
    quantityBefore: number
    quantityAfter: number
    note?: string | null
    referenceType?: string | null
    referenceId?: string | null
    actorUserId?: string | null
  },
): Promise<void> {
  assertMovementInvariant(
    input.quantityBefore,
    input.quantityDelta,
    input.quantityAfter,
  )

  await client.inventoryMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantityDelta: input.quantityDelta,
      quantityBefore: input.quantityBefore,
      quantityAfter: input.quantityAfter,
      note: input.note ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      actorUserId: input.actorUserId ?? null,
    },
  })
}

export type MovementActor = {
  id: string
  firstName: string
  lastName: string
  email: string
} | null

export function toMovementDto(movement: {
  id: string
  type: InventoryMovementType
  quantityDelta: number
  quantityBefore: number
  quantityAfter: number
  note: string | null
  referenceType: string | null
  referenceId: string | null
  createdAt: Date
  actor: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
}) {
  return {
    id: movement.id,
    type: movement.type,
    quantityDelta: movement.quantityDelta,
    quantityBefore: movement.quantityBefore,
    quantityAfter: movement.quantityAfter,
    note: movement.note,
    referenceType: movement.referenceType,
    referenceId: movement.referenceId,
    createdAt: movement.createdAt,
    actor: movement.actor
      ? {
          id: movement.actor.id,
          firstName: movement.actor.firstName,
          lastName: movement.actor.lastName,
          email: movement.actor.email,
        }
      : null,
  }
}

export type TxClient = Prisma.TransactionClient
