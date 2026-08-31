import { Prisma, type DiscountType, type Promotion } from '@prisma/client'
import { AppError } from '../middleware/errorHandler.js'

export const PROMOTION_CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/

export type PromotionStatus = 'ACTIVE' | 'UPCOMING' | 'EXPIRED' | 'DISABLED'

const ZERO = new Prisma.Decimal(0)
const HUNDRED = new Prisma.Decimal(100)

export function normalizePromotionCode(raw: string): string {
  return raw.trim().toUpperCase()
}

export function assertNormalizedPromotionCode(code: string): string {
  const normalized = normalizePromotionCode(code)
  if (!PROMOTION_CODE_PATTERN.test(normalized)) {
    throw new AppError(
      400,
      'Promotion code must be 3–32 characters using letters, numbers, hyphen, or underscore.',
    )
  }
  return normalized
}

export function toMoneyDecimal(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

export function toMoneyString(value: Prisma.Decimal): string {
  return toMoneyDecimal(value).toFixed(2)
}

export function derivePromotionStatus(
  promotion: Pick<Promotion, 'isActive' | 'startsAt' | 'endsAt'>,
  now = new Date(),
): PromotionStatus {
  if (!promotion.isActive) {
    return 'DISABLED'
  }
  if (now < promotion.startsAt) {
    return 'UPCOMING'
  }
  if (now >= promotion.endsAt) {
    return 'EXPIRED'
  }
  return 'ACTIVE'
}

export function assertPromotionSchedule(startsAt: Date, endsAt: Date): void {
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
    throw new AppError(400, 'Start date must be a valid date.')
  }
  if (!(endsAt instanceof Date) || Number.isNaN(endsAt.getTime())) {
    throw new AppError(400, 'End date must be a valid date.')
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new AppError(400, 'End date must be after the start date.')
  }
}

export function assertDiscountConfiguration(
  discountType: DiscountType,
  discountValue: Prisma.Decimal,
): void {
  if (discountValue.lte(ZERO)) {
    throw new AppError(400, 'Discount value must be greater than zero.')
  }

  if (discountType === 'PERCENTAGE' && discountValue.gt(HUNDRED)) {
    throw new AppError(400, 'Percentage discounts cannot exceed 100.')
  }
}

export function assertMinimumOrderValue(
  minimumOrderValue: Prisma.Decimal | null,
): void {
  if (minimumOrderValue !== null && minimumOrderValue.lt(ZERO)) {
    throw new AppError(400, 'Minimum order value cannot be negative.')
  }
}

export function calculateDiscountAmount(
  subtotal: Prisma.Decimal,
  discountType: DiscountType,
  discountValue: Prisma.Decimal,
): Prisma.Decimal {
  if (subtotal.lte(ZERO)) {
    return ZERO
  }

  if (discountType === 'PERCENTAGE') {
    const raw = subtotal.mul(discountValue).div(HUNDRED)
    return Prisma.Decimal.min(toMoneyDecimal(raw), subtotal)
  }

  return Prisma.Decimal.min(toMoneyDecimal(discountValue), subtotal)
}

export function promotionUnusableMessage(
  status: PromotionStatus,
): string {
  if (status === 'DISABLED') {
    return 'This promotion is currently disabled.'
  }
  if (status === 'UPCOMING') {
    return 'This promotion has not started yet.'
  }
  if (status === 'EXPIRED') {
    return 'This promotion has expired.'
  }
  return 'This promotion is not currently active.'
}

export function minimumOrderMessage(minimumOrderValue: Prisma.Decimal): string {
  return `This promotion requires a minimum order of A$${toMoneyString(minimumOrderValue)}.`
}

export function assertPromotionUsable(
  promotion: Promotion,
  subtotal: Prisma.Decimal,
  now = new Date(),
): void {
  const status = derivePromotionStatus(promotion, now)
  if (status !== 'ACTIVE') {
    throw new AppError(409, promotionUnusableMessage(status))
  }

  assertDiscountConfiguration(promotion.discountType, promotion.discountValue)

  if (
    promotion.minimumOrderValue !== null &&
    subtotal.lt(promotion.minimumOrderValue)
  ) {
    throw new AppError(409, minimumOrderMessage(promotion.minimumOrderValue))
  }
}
