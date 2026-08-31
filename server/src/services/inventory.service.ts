import { Prisma, type Inventory } from '@prisma/client'
import { writeAuditLog } from '../lib/audit.js'
import {
  stockStatus,
  toMovementDto,
  writeInventoryMovement,
} from '../lib/inventory-movement.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type {
  AdjustInventoryInput,
  AdminInventoryQuery,
  InventoryMovementQuery,
  InventorySettingsInput,
  ReceiveInventoryInput,
} from '../validators/inventory.validator.js'

const RETRY_LIMIT = 3

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  )
}

function toInventoryState(inventory: Inventory) {
  const quantity = inventory.quantity
  const status = stockStatus(quantity, inventory.lowStockThreshold)
  return {
    quantity,
    lowStockThreshold: inventory.lowStockThreshold,
    inStock: quantity > 0,
    isLowStock: status === 'low-stock',
    stockStatus: status,
    updatedAt: inventory.updatedAt,
  }
}

async function requireInventory(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: true,
      inventory: true,
    },
  })

  if (!product || !product.inventory) {
    throw new AppError(404, 'Product inventory was not found.')
  }

  return product
}

function inventoryListWhere(
  query: AdminInventoryQuery,
  comparedStockIds: string[] | null,
): Prisma.ProductWhereInput {
  const filters: Prisma.ProductWhereInput[] = [
    { inventory: { isNot: null } },
  ]

  if (query.productStatus === 'active') {
    filters.push({ isActive: true })
  } else if (query.productStatus === 'archived') {
    filters.push({ isActive: false })
  }

  if (query.search) {
    filters.push({
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ],
    })
  }

  if (query.category) {
    filters.push({ category: { slug: query.category } })
  }

  if (query.stockStatus === 'out-of-stock') {
    filters.push({ inventory: { quantity: 0 } })
  }

  if (comparedStockIds) {
    filters.push({ id: { in: comparedStockIds } })
  }

  return { AND: filters }
}

async function productIdsForComparedStockStatus(
  stockStatus: AdminInventoryQuery['stockStatus'],
): Promise<string[] | null> {
  if (stockStatus === 'low-stock') {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id
      FROM "Product" p
      INNER JOIN "Inventory" i ON i."productId" = p.id
      WHERE i.quantity > 0
        AND i.quantity <= i."lowStockThreshold"
    `
    return rows.map((row) => row.id)
  }

  if (stockStatus === 'healthy') {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id
      FROM "Product" p
      INNER JOIN "Inventory" i ON i."productId" = p.id
      WHERE i.quantity > i."lowStockThreshold"
    `
    return rows.map((row) => row.id)
  }

  return null
}

async function inventorySummary() {
  const [totalProducts, archivedProducts, inventories] = await prisma.$transaction([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: false } }),
    prisma.inventory.findMany({
      select: { quantity: true, lowStockThreshold: true },
    }),
  ])

  let healthy = 0
  let lowStock = 0
  let outOfStock = 0
  for (const row of inventories) {
    const status = stockStatus(row.quantity, row.lowStockThreshold)
    if (status === 'healthy') {
      healthy += 1
    } else if (status === 'low-stock') {
      lowStock += 1
    } else {
      outOfStock += 1
    }
  }

  return {
    totalProducts,
    healthy,
    lowStock,
    outOfStock,
    archivedProducts,
  }
}

function inventoryOrderBy(
  sort: AdminInventoryQuery['sort'],
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'name-asc':
      return [{ name: 'asc' }]
    case 'name-desc':
      return [{ name: 'desc' }]
    case 'quantity-asc':
      return [{ inventory: { quantity: 'asc' } }]
    case 'quantity-desc':
      return [{ inventory: { quantity: 'desc' } }]
    default:
      return [{ inventory: { updatedAt: 'desc' } }]
  }
}

export async function listAdminInventory(query: AdminInventoryQuery) {
  const comparedStockIds = await productIdsForComparedStockStatus(
    query.stockStatus,
  )

  if (comparedStockIds && comparedStockIds.length === 0) {
    const summary = await inventorySummary()
    return {
      data: [],
      pagination: {
        page: query.page,
        limit: query.limit,
        total: 0,
        totalPages: 0,
      },
      summary,
    }
  }

  const where = inventoryListWhere(query, comparedStockIds)
  const skip = (query.page - 1) * query.limit

  const [total, pageItems] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        category: true,
        inventory: true,
      },
      orderBy: inventoryOrderBy(query.sort),
      skip,
      take: query.limit,
    }),
  ])

  const summary = await inventorySummary()

  return {
    data: pageItems.map((product) => ({
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        isActive: product.isActive,
        category: {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug,
        },
      },
      inventory: toInventoryState(product.inventory!),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
    summary,
  }
}

export async function getAdminInventory(productId: string) {
  const product = await requireInventory(productId)
  const recent = await prisma.inventoryMovement.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      actor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  })

  return {
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      isActive: product.isActive,
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
    },
    inventory: toInventoryState(product.inventory!),
    recentMovements: recent.map(toMovementDto),
  }
}

async function runReceive(
  productId: string,
  input: ReceiveInventoryInput,
  actorId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { productId },
      })

      if (!inventory) {
        throw new AppError(404, 'Product inventory was not found.')
      }

      const quantityBefore = inventory.quantity
      const updated = await tx.inventory.update({
        where: { productId },
        data: { quantity: { increment: input.quantity } },
      })

      await writeInventoryMovement(tx, {
        productId,
        type: 'RECEIPT',
        quantityDelta: input.quantity,
        quantityBefore,
        quantityAfter: updated.quantity,
        note: input.note ?? null,
        actorUserId: actorId,
      })

      await writeAuditLog(tx, {
        userId: actorId,
        action: 'INVENTORY_RECEIVED',
        entityType: 'Inventory',
        entityId: productId,
        metadata: {
          productId,
          quantity: input.quantity,
          before: quantityBefore,
          after: updated.quantity,
        },
      })

      return toInventoryState(updated)
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function receiveInventory(
  productId: string,
  input: ReceiveInventoryInput,
  actorId: string,
) {
  let lastError: unknown
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt += 1) {
    try {
      return await runReceive(productId, input, actorId)
    } catch (error) {
      lastError = error
      if (isSerializationConflict(error) && attempt < RETRY_LIMIT) {
        continue
      }
      throw error
    }
  }
  throw lastError
}

async function runAdjust(
  productId: string,
  input: AdjustInventoryInput,
  actorId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { productId },
      })

      if (!inventory) {
        throw new AppError(404, 'Product inventory was not found.')
      }

      const quantityBefore = inventory.quantity
      let quantityAfter: number

      if (input.quantityDelta > 0) {
        const updated = await tx.inventory.update({
          where: { productId },
          data: { quantity: { increment: input.quantityDelta } },
        })
        quantityAfter = updated.quantity
      } else {
        const amount = Math.abs(input.quantityDelta)
        const updated = await tx.inventory.updateMany({
          where: {
            productId,
            quantity: { gte: amount },
          },
          data: {
            quantity: { decrement: amount },
          },
        })

        if (updated.count !== 1) {
          throw new AppError(409, 'Not enough stock for this adjustment.')
        }

        const refreshed = await tx.inventory.findUniqueOrThrow({
          where: { productId },
        })
        quantityAfter = refreshed.quantity
      }

      const latest = await tx.inventory.findUniqueOrThrow({
        where: { productId },
      })

      await writeInventoryMovement(tx, {
        productId,
        type: 'ADJUSTMENT',
        quantityDelta: input.quantityDelta,
        quantityBefore,
        quantityAfter,
        note: input.reason,
        actorUserId: actorId,
      })

      await writeAuditLog(tx, {
        userId: actorId,
        action: 'INVENTORY_ADJUSTED',
        entityType: 'Inventory',
        entityId: productId,
        metadata: {
          productId,
          quantityDelta: input.quantityDelta,
          before: quantityBefore,
          after: quantityAfter,
        },
      })

      return toInventoryState(latest)
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function adjustInventory(
  productId: string,
  input: AdjustInventoryInput,
  actorId: string,
) {
  let lastError: unknown
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt += 1) {
    try {
      return await runAdjust(productId, input, actorId)
    } catch (error) {
      lastError = error
      if (isSerializationConflict(error) && attempt < RETRY_LIMIT) {
        continue
      }
      throw error
    }
  }
  throw lastError
}

export async function updateInventorySettings(
  productId: string,
  input: InventorySettingsInput,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.findUnique({
      where: { productId },
    })

    if (!inventory) {
      throw new AppError(404, 'Product inventory was not found.')
    }

    const updated = await tx.inventory.update({
      where: { productId },
      data: { lowStockThreshold: input.lowStockThreshold },
    })

    await writeAuditLog(tx, {
      userId: actorId,
      action: 'INVENTORY_THRESHOLD_UPDATED',
      entityType: 'Inventory',
      entityId: productId,
      metadata: {
        productId,
        oldThreshold: inventory.lowStockThreshold,
        newThreshold: updated.lowStockThreshold,
      },
    })

    return toInventoryState(updated)
  })
}

export async function listInventoryMovements(
  productId: string,
  query: InventoryMovementQuery,
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { inventory: true },
  })

  if (!product || !product.inventory) {
    throw new AppError(404, 'Product inventory was not found.')
  }

  const where: Prisma.InventoryMovementWhereInput = {
    productId,
    ...(query.type ? { type: query.type } : {}),
  }
  const skip = (query.page - 1) * query.limit

  const [total, movements] = await prisma.$transaction([
    prisma.inventoryMovement.count({ where }),
    prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
  ])

  return {
    data: movements.map(toMovementDto),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  }
}

export async function applyLegacyInventoryUpdate(
  productId: string,
  input: { quantity?: number; lowStockThreshold?: number },
  actorId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { productId },
      })

      if (!inventory) {
        throw new AppError(404, 'Product inventory not found')
      }

      let current = inventory

      if (
        input.quantity !== undefined &&
        input.quantity !== inventory.quantity
      ) {
        const quantityDelta = input.quantity - inventory.quantity
        if (quantityDelta < 0) {
          const amount = Math.abs(quantityDelta)
          const updated = await tx.inventory.updateMany({
            where: {
              productId,
              quantity: { gte: amount },
            },
            data: { quantity: { decrement: amount } },
          })
          if (updated.count !== 1) {
            throw new AppError(409, 'Not enough stock for this adjustment.')
          }
        } else {
          await tx.inventory.update({
            where: { productId },
            data: { quantity: { increment: quantityDelta } },
          })
        }

        current = await tx.inventory.findUniqueOrThrow({
          where: { productId },
        })

        await writeInventoryMovement(tx, {
          productId,
          type: 'ADJUSTMENT',
          quantityDelta,
          quantityBefore: inventory.quantity,
          quantityAfter: current.quantity,
          note: 'Absolute inventory update via legacy endpoint',
          actorUserId: actorId,
        })

        await writeAuditLog(tx, {
          userId: actorId,
          action: 'INVENTORY_ADJUSTED',
          entityType: 'Inventory',
          entityId: productId,
          metadata: {
            productId,
            quantityDelta,
            before: inventory.quantity,
            after: current.quantity,
            source: 'legacy-absolute',
          },
        })
      }

      if (
        input.lowStockThreshold !== undefined &&
        input.lowStockThreshold !== current.lowStockThreshold
      ) {
        const previousThreshold = current.lowStockThreshold
        current = await tx.inventory.update({
          where: { productId },
          data: { lowStockThreshold: input.lowStockThreshold },
        })

        await writeAuditLog(tx, {
          userId: actorId,
          action: 'INVENTORY_THRESHOLD_UPDATED',
          entityType: 'Inventory',
          entityId: productId,
          metadata: {
            productId,
            oldThreshold: previousThreshold,
            newThreshold: current.lowStockThreshold,
            source: 'legacy-absolute',
          },
        })
      }

      return {
        productId,
        quantity: current.quantity,
        lowStockThreshold: current.lowStockThreshold,
        inStock: current.quantity > 0,
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
