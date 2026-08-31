import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { writeInventoryMovement } from '../lib/inventory-movement.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { OrderListQuery } from '../validators/order.validator.js'
import {
  toOrderDetailDto,
  toOrderSummaryDto,
  type OrderDetailDto,
  type OrderSummaryDto,
} from './order.mapper.js'

const CHECKOUT_RETRY_LIMIT = 3
const ZERO = new Prisma.Decimal(0)

function createOrderNumber(): string {
  return `CO-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`
}

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  )
}

function isOrderNumberConflict(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false
  }

  const target = error.meta?.target
  const fields = Array.isArray(target)
    ? target.map((field) => String(field))
    : typeof target === 'string'
      ? [target]
      : []

  return fields.includes('orderNumber') || fields.join(' ').includes('orderNumber')
}

async function runCheckoutTransaction(
  userId: string,
  addressId: string,
): Promise<OrderDetailDto> {
  return prisma.$transaction(
    async (tx) => {
      const address = await tx.address.findFirst({
        where: { id: addressId, userId },
      })

      if (!address) {
        throw new AppError(404, 'Address not found')
      }

      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                include: { inventory: true },
              },
            },
          },
        },
      })

      if (!cart || cart.items.length === 0) {
        throw new AppError(409, 'Your cart is empty')
      }

      const sortedItems = [...cart.items].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      )

      const lines: Array<{
        productId: string
        productName: string
        sku: string
        unitPrice: Prisma.Decimal
        quantity: number
        lineTotal: Prisma.Decimal
        quantityBefore: number
        quantityAfter: number
      }> = []

      let subtotal = ZERO

      for (const item of sortedItems) {
        const product = item.product

        if (!product.isActive) {
          throw new AppError(409, 'Product is no longer available')
        }

        const available = product.inventory?.quantity ?? 0
        if (available <= 0) {
          throw new AppError(409, 'Product is out of stock')
        }

        if (item.quantity > available) {
          throw new AppError(409, 'Requested quantity exceeds available stock')
        }

        const decremented = await tx.inventory.updateMany({
          where: {
            productId: product.id,
            quantity: { gte: item.quantity },
          },
          data: {
            quantity: { decrement: item.quantity },
          },
        })

        if (decremented.count !== 1) {
          throw new AppError(409, 'Requested quantity exceeds available stock')
        }

        const lineTotal = product.price.mul(item.quantity)
        subtotal = subtotal.plus(lineTotal)
        lines.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unitPrice: product.price,
          quantity: item.quantity,
          lineTotal,
          quantityBefore: available,
          quantityAfter: available - item.quantity,
        })
      }

      const discountAmount = ZERO
      const shippingAmount = ZERO
      const total = subtotal.minus(discountAmount).plus(shippingAmount)

      const order = await tx.order.create({
        data: {
          userId,
          orderNumber: createOrderNumber(),
          status: 'PENDING',
          subtotal,
          discountAmount,
          shippingAmount,
          total,
          shippingAddress: {
            create: {
              firstName: address.firstName,
              lastName: address.lastName,
              addressLine1: address.addressLine1,
              addressLine2: address.addressLine2,
              suburb: address.suburb,
              state: address.state,
              postcode: address.postcode,
              country: address.country,
              phone: address.phone,
            },
          },
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              productName: line.productName,
              sku: line.sku,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: {
          items: true,
          shippingAddress: true,
        },
      })

      for (const line of lines) {
        await writeInventoryMovement(tx, {
          productId: line.productId,
          type: 'ORDER_PLACED',
          quantityDelta: -line.quantity,
          quantityBefore: line.quantityBefore,
          quantityAfter: line.quantityAfter,
          referenceType: 'Order',
          referenceId: order.id,
          actorUserId: userId,
        })
      }

      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      })

      return toOrderDetailDto(order)
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  )
}

export async function createOrderFromCart(
  userId: string,
  addressId: string,
): Promise<OrderDetailDto> {
  let lastError: unknown

  for (let attempt = 1; attempt <= CHECKOUT_RETRY_LIMIT; attempt += 1) {
    try {
      return await runCheckoutTransaction(userId, addressId)
    } catch (error) {
      lastError = error
      if (
        (isSerializationConflict(error) || isOrderNumberConflict(error)) &&
        attempt < CHECKOUT_RETRY_LIMIT
      ) {
        continue
      }
      throw error
    }
  }

  throw lastError
}

export async function listOrdersForUser(
  userId: string,
  query: OrderListQuery,
): Promise<{
  data: OrderSummaryDto[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}> {
  const skip = (query.page - 1) * query.limit

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where: { userId } }),
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
      include: { items: true },
    }),
  ])

  return {
    data: orders.map(toOrderSummaryDto),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  }
}

export async function getOrderForUser(
  userId: string,
  orderId: string,
): Promise<OrderDetailDto> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: true,
      shippingAddress: true,
    },
  })

  if (!order) {
    throw new AppError(404, 'Order not found')
  }

  return toOrderDetailDto(order)
}
