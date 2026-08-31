export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT'

export type PromotionStatus = 'ACTIVE' | 'UPCOMING' | 'EXPIRED' | 'DISABLED'

export type PromotionStatusFilter = 'all' | 'active' | 'upcoming' | 'expired' | 'disabled'

export type PromotionDiscountFilter = 'all' | 'percentage' | 'fixed'

export type PromotionSort =
  | 'newest'
  | 'code-asc'
  | 'code-desc'
  | 'starts-soonest'
  | 'ends-soonest'

export type PromotionPreview = {
  code: string
  description: string | null
  discountType: DiscountType
  discountValue: string
  minimumOrderValue: string | null
  subtotal: string
  discountAmount: string
  totalAfterDiscount: string
}

export type AdminPromotion = {
  id: string
  code: string
  description: string | null
  discountType: DiscountType
  discountValue: string
  minimumOrderValue: string | null
  startsAt: string
  endsAt: string
  isActive: boolean
  status: PromotionStatus
  createdAt: string
  updatedAt: string
}

export type AdminPromotionListParams = {
  page?: number
  limit?: number
  search?: string
  status?: PromotionStatusFilter
  discountType?: PromotionDiscountFilter
  sort?: PromotionSort
}

export type AdminPromotionListResponse = {
  data: AdminPromotion[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    active: number
    upcoming: number
    expired: number
    disabled: number
  }
}

export type AdminPromotionCreateInput = {
  code: string
  description?: string | null
  discountType: DiscountType
  discountValue: string
  minimumOrderValue?: string | null
  startsAt: string
  endsAt: string
  isActive: boolean
}

export type AdminPromotionUpdateInput = {
  code?: string
  description?: string | null
  discountType?: DiscountType
  discountValue?: string
  minimumOrderValue?: string | null
  startsAt?: string
  endsAt?: string
  isActive?: boolean
}
