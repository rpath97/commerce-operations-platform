import { api } from './apiClient.ts'
import type { AdminDashboard } from '../types/admin.ts'

type DataResponse<T> = {
  data: T
}

export async function getAdminDashboard(
  signal?: AbortSignal,
): Promise<AdminDashboard> {
  const response = await api.get<DataResponse<AdminDashboard>>('/admin/dashboard', {
    signal,
  })
  return response.data.data
}
