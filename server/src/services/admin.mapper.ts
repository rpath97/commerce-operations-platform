import type { Order, OrderItem, Prisma, User } from '@prisma/client'
import { toOrderDetailDto, type OrderDetailDto } from './order.mapper.js'

function toMoney(value: Prisma.Decimal): string {
  return value.toFixed(2)
}

function itemCount(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

export type AdminCustomerSummaryDto = {
  id: string
  firstName: string
  lastName: string
  email: string
}

export type AdminOrderSummaryDto = {
  id: string
  orderNumber: string
  status: Order['status']
  createdAt: Date
  updatedAt: Date
  customer: AdminCustomerSummaryDto
  itemCount: number
  total: string
}

export type AdminDashboardRecentOrderDto = {
  id: string
  orderNumber: string
  status: Order['status']
  createdAt: Date
  customer: {
    firstName: string
    lastName: string
    email: string
  }
  itemCount: number
  total: string
}

export type AdminOrderDetailDto = OrderDetailDto & {
  customer: AdminCustomerSummaryDto
}

function toCustomer(user: User): AdminCustomerSummaryDto {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  }
}

export function toAdminOrderSummaryDto(
  order: Order & { items: OrderItem[]; user: User },
): AdminOrderSummaryDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: toCustomer(order.user),
    itemCount: itemCount(order.items),
    total: toMoney(order.total),
  }
}

export function toAdminDashboardRecentOrderDto(
  order: Order & { items: OrderItem[]; user: User },
): AdminDashboardRecentOrderDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    customer: {
      firstName: order.user.firstName,
      lastName: order.user.lastName,
      email: order.user.email,
    },
    itemCount: itemCount(order.items),
    total: toMoney(order.total),
  }
}

export function toAdminOrderDetailDto(
  order: Parameters<typeof toOrderDetailDto>[0] & { user: User },
): AdminOrderDetailDto {
  return {
    ...toOrderDetailDto(order),
    customer: toCustomer(order.user),
  }
}
