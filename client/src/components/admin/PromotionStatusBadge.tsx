import { formatPromotionStatus } from '../../lib/promotionStatus.ts'
import type { PromotionStatus } from '../../types/promotion.ts'

export function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  return (
    <span className="chip max-w-full truncate">
      {formatPromotionStatus(status)}
    </span>
  )
}
