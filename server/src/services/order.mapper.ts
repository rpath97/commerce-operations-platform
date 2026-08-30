import type { Order, OrderItem, OrderShippingAddress } from '@prisma/client'
import { Prisma } from '@prisma/client'

export type OrderShippingAddressDto = {
  firstName: string
  lastName: string
  addressLine1: string
  addressLine2: string | null
  suburb: string
  state: string
  postcode: string
  country: string
  phone: string | null
}

export type OrderItemDto = {
  id: string
  productId: string | null
  productName: string
  sku: string
  unitPrice: string
  quantity: number
  lineTotal: string
}

export type OrderSummaryDto = {
  id: string
  orderNumber: string
  status: Order['status']
  createdAt: Date
  itemCount: number
  total: string
}

export type OrderDetailDto = {
  id: string
  orderNumber: string
  status: Order['status']
  createdAt: Date
  updatedAt: Date
  subtotal: string
  discountAmount: string
  shippingAmount: string
  total: string
  shippingAddress: OrderShippingAddressDto
  items: OrderItemDto[]
}

function toMoney(value: Prisma.Decimal): string {
  return value.toFixed(2)
}

function itemCount(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

export function toOrderSummaryDto(
  order: Order & { items: OrderItem[] },
): OrderSummaryDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    itemCount: itemCount(order.items),
    total: toMoney(order.total),
  }
}

export function toOrderDetailDto(
  order: Order & {
    items: OrderItem[]
    shippingAddress: OrderShippingAddress | null
  },
): OrderDetailDto {
  if (!order.shippingAddress) {
    throw new Error('Order is missing a shipping address snapshot')
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    subtotal: toMoney(order.subtotal),
    discountAmount: toMoney(order.discountAmount),
    shippingAmount: toMoney(order.shippingAmount),
    total: toMoney(order.total),
    shippingAddress: {
      firstName: order.shippingAddress.firstName,
      lastName: order.shippingAddress.lastName,
      addressLine1: order.shippingAddress.addressLine1,
      addressLine2: order.shippingAddress.addressLine2,
      suburb: order.shippingAddress.suburb,
      state: order.shippingAddress.state,
      postcode: order.shippingAddress.postcode,
      country: order.shippingAddress.country,
      phone: order.shippingAddress.phone,
    },
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      unitPrice: toMoney(item.unitPrice),
      quantity: item.quantity,
      lineTotal: toMoney(item.lineTotal),
    })),
  }
}
