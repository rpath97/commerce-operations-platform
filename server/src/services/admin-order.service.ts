import type { OrderStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { writeAuditLog } from '../lib/audit.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AdminOrderQuery } from '../validators/admin.validator.js'
import {
  toAdminOrderDetailDto,
  toAdminOrderSummaryDto,
  type AdminOrderDetailDto,
  type AdminOrderSummaryDto,
} from './admin.mapper.js'

const STATUS_RETRY_LIMIT = 3

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  )
}

function adminOrderWhere(query: AdminOrderQuery): Prisma.OrderWhereInput {
  const filters: Prisma.OrderWhereInput[] = []

  if (query.status) {
    filters.push({ status: query.status })
  }

  if (query.search) {
    filters.push({
      OR: [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
      ],
    })
  }

  if (filters.length === 0) {
    return {}
  }

  return { AND: filters }
}

export async function listAdminOrders(query: AdminOrderQuery): Promise<{
  data: AdminOrderSummaryDto[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}> {
  const where = adminOrderWhere(query)
  const skip = (query.page - 1) * query.limit

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
      include: {
        items: true,
        user: true,
      },
    }),
  ])

  return {
    data: orders.map(toAdminOrderSummaryDto),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  }
}

export async function getAdminOrder(
  orderId: string,
): Promise<AdminOrderDetailDto> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      shippingAddress: true,
      user: true,
    },
  })

  if (!order) {
    throw new AppError(404, 'Order not found')
  }

  return toAdminOrderDetailDto(order)
}

async function runStatusUpdate(
  orderId: string,
  nextStatus: OrderStatus,
  adminUserId: string,
): Promise<AdminOrderDetailDto> {
  return prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      })

      if (!order) {
        throw new AppError(404, 'Order not found')
      }

      const allowed = ALLOWED_TRANSITIONS[order.status]
      if (!allowed.includes(nextStatus)) {
        throw new AppError(409, 'Invalid status transition')
      }

      const updated = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: nextStatus },
      })

      if (updated.count !== 1) {
        throw new AppError(
          409,
          'Order status could not be updated because it has already changed',
        )
      }

      if (nextStatus === 'CANCELLED') {
        for (const item of order.items) {
          if (!item.productId) {
            continue
          }

          await tx.inventory.updateMany({
            where: { productId: item.productId },
            data: { quantity: { increment: item.quantity } },
          })
        }
      }

      await writeAuditLog(tx, {
        userId: adminUserId,
        action: 'ORDER_STATUS_UPDATED',
        entityType: 'Order',
        entityId: order.id,
        metadata: {
          fromStatus: order.status,
          toStatus: nextStatus,
        },
      })

      const refreshed = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          shippingAddress: true,
          user: true,
        },
      })

      return toAdminOrderDetailDto(refreshed)
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  )
}

export async function updateAdminOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
  adminUserId: string,
): Promise<AdminOrderDetailDto> {
  let lastError: unknown

  for (let attempt = 1; attempt <= STATUS_RETRY_LIMIT; attempt += 1) {
    try {
      return await runStatusUpdate(orderId, nextStatus, adminUserId)
    } catch (error) {
      lastError = error
      if (isSerializationConflict(error) && attempt < STATUS_RETRY_LIMIT) {
        continue
      }
      throw error
    }
  }

  throw lastError
}
