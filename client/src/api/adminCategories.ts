import { api } from './apiClient.ts'
import type { AdminCategory, AdminCategoryInput } from '../types/admin.ts'

type DataResponse<T> = {
  data: T
}

export async function listAdminCategories(
  signal?: AbortSignal,
): Promise<AdminCategory[]> {
  const response = await api.get<DataResponse<AdminCategory[]>>(
    '/admin/categories',
    { signal },
  )
  return response.data.data
}

export async function createAdminCategory(
  input: AdminCategoryInput,
): Promise<AdminCategory> {
  const response = await api.post<DataResponse<AdminCategory>>(
    '/admin/categories',
    input,
  )
  return response.data.data
}

export async function updateAdminCategory(
  id: string,
  input: AdminCategoryInput,
): Promise<AdminCategory> {
  const response = await api.patch<DataResponse<AdminCategory>>(
    `/admin/categories/${encodeURIComponent(id)}`,
    input,
  )
  return response.data.data
}

export async function deleteAdminCategory(id: string): Promise<{ id: string }> {
  const response = await api.delete<DataResponse<{ id: string }>>(
    `/admin/categories/${encodeURIComponent(id)}`,
  )
  return response.data.data
}
