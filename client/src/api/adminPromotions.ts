import { api } from './apiClient.ts'
import type {
  AdminPromotion,
  AdminPromotionCreateInput,
  AdminPromotionListParams,
  AdminPromotionListResponse,
  AdminPromotionUpdateInput,
} from '../types/promotion.ts'

type DataResponse<T> = {
  data: T
}

export async function listAdminPromotions(
  params: AdminPromotionListParams = {},
  signal?: AbortSignal,
): Promise<AdminPromotionListResponse> {
  const query: Record<string, string | number> = {}

  if (params.page !== undefined) {
    query.page = params.page
  }
  if (params.limit !== undefined) {
    query.limit = params.limit
  }
  if (params.search) {
    query.search = params.search
  }
  if (params.status) {
    query.status = params.status
  }
  if (params.discountType) {
    query.discountType = params.discountType
  }
  if (params.sort) {
    query.sort = params.sort
  }

  const response = await api.get<AdminPromotionListResponse>('/admin/promotions', {
    params: query,
    signal,
  })
  return response.data
}

export async function getAdminPromotion(
  promotionId: string,
  signal?: AbortSignal,
): Promise<AdminPromotion> {
  const response = await api.get<DataResponse<AdminPromotion>>(
    `/admin/promotions/${encodeURIComponent(promotionId)}`,
    { signal },
  )
  return response.data.data
}

export async function createAdminPromotion(
  input: AdminPromotionCreateInput,
): Promise<AdminPromotion> {
  const response = await api.post<DataResponse<AdminPromotion>>(
    '/admin/promotions',
    input,
  )
  return response.data.data
}

export async function updateAdminPromotion(
  promotionId: string,
  input: AdminPromotionUpdateInput,
): Promise<AdminPromotion> {
  const response = await api.patch<DataResponse<AdminPromotion>>(
    `/admin/promotions/${encodeURIComponent(promotionId)}`,
    input,
  )
  return response.data.data
}
