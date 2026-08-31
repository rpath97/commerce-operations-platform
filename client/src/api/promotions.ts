import { api } from './apiClient.ts'
import type { PromotionPreview } from '../types/promotion.ts'

type DataResponse<T> = {
  data: T
}

export async function validatePromotionCode(
  code: string,
): Promise<PromotionPreview> {
  const response = await api.post<DataResponse<PromotionPreview>>(
    '/promotions/validate',
    { code },
  )
  return response.data.data
}
