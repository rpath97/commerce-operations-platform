import type { OrderStatus } from '../../types/order.ts'
import { formatOrderStatus } from '../../lib/orderStatus.ts'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="chip max-w-full truncate">
      {formatOrderStatus(status)}
    </span>
  )
}
