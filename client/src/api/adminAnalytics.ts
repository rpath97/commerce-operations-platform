import { api } from './apiClient.ts'
import type { AdminAnalytics, AnalyticsRange } from '../types/analytics.ts'

type DataResponse<T> = {
  data: T
}

export async function getAdminAnalytics(
  range: AnalyticsRange = '30d',
  signal?: AbortSignal,
): Promise<AdminAnalytics> {
  const response = await api.get<DataResponse<AdminAnalytics>>(
    '/admin/analytics',
    {
      params: { range },
      signal,
    },
  )
  return response.data.data
}
