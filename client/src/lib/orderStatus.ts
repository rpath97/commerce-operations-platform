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
