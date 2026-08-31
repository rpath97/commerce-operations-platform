import type { DiscountType, PromotionStatus } from '../types/promotion.ts'

export function formatPromotionStatus(status: PromotionStatus): string {
  if (status === 'ACTIVE') {
    return 'Active'
  }
  if (status === 'UPCOMING') {
    return 'Upcoming'
  }
  if (status === 'EXPIRED') {
    return 'Expired'
  }
  return 'Disabled'
}

export function formatDiscountLabel(
  discountType: DiscountType,
  discountValue: string,
): string {
  if (discountType === 'PERCENTAGE') {
    const whole = discountValue.endsWith('.00')
      ? discountValue.slice(0, -3)
      : discountValue
    return `${whole}% off`
  }
  return `A$${discountValue} off`
}
