import type { Promotion } from '@prisma/client'
import {
  derivePromotionStatus,
  toMoneyString,
  type PromotionStatus,
} from '../lib/promotion.js'

export type AdminPromotionDto = {
  id: string
  code: string
  description: string | null
  discountType: Promotion['discountType']
  discountValue: string
  minimumOrderValue: string | null
  startsAt: Date
  endsAt: Date
  isActive: boolean
  status: PromotionStatus
  createdAt: Date
  updatedAt: Date
}

export type PromotionPreviewDto = {
  code: string
  description: string | null
  discountType: Promotion['discountType']
  discountValue: string
  minimumOrderValue: string | null
  subtotal: string
  discountAmount: string
  totalAfterDiscount: string
}

export function toAdminPromotionDto(
  promotion: Promotion,
  now = new Date(),
): AdminPromotionDto {
  return {
    id: promotion.id,
    code: promotion.code,
    description: promotion.description,
    discountType: promotion.discountType,
    discountValue: toMoneyString(promotion.discountValue),
    minimumOrderValue:
      promotion.minimumOrderValue === null
        ? null
        : toMoneyString(promotion.minimumOrderValue),
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    isActive: promotion.isActive,
    status: derivePromotionStatus(promotion, now),
    createdAt: promotion.createdAt,
    updatedAt: promotion.updatedAt,
  }
}
