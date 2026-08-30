import type { OrderStatus } from '../types/order.ts'

const labels: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export function formatOrderStatus(status: OrderStatus): string {
  return labels[status] ?? status
}

const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

export function getNextAdminStatuses(status: OrderStatus): OrderStatus[] {
  return nextStatuses[status] ?? []
}

export function formatStatusAction(status: OrderStatus): string {
  switch (status) {
    case 'PROCESSING':
      return 'Mark as processing'
    case 'SHIPPED':
      return 'Mark as shipped'
    case 'DELIVERED':
      return 'Mark as delivered'
    case 'CANCELLED':
      return 'Cancel order'
    default:
      return `Mark as ${formatOrderStatus(status).toLowerCase()}`
  }
}
