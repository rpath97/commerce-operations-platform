import { api } from './apiClient.ts'
import type {
  AdminProduct,
  AdminProductCreateInput,
  AdminProductListParams,
  AdminProductListResponse,
  AdminProductUpdateInput,
} from '../types/admin.ts'

type DataResponse<T> = {
  data: T
}

export async function listAdminProducts(
  params: AdminProductListParams = {},
  signal?: AbortSignal,
): Promise<AdminProductListResponse> {
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
  if (params.category) {
    query.category = params.category
  }
  if (params.status) {
    query.status = params.status
  }
  if (params.sort) {
    query.sort = params.sort
  }

  const response = await api.get<AdminProductListResponse>('/admin/products', {
    params: query,
    signal,
  })
  return response.data
}

export async function getAdminProduct(
  id: string,
  signal?: AbortSignal,
): Promise<AdminProduct> {
  const response = await api.get<DataResponse<AdminProduct>>(
    `/admin/products/${encodeURIComponent(id)}`,
    { signal },
  )
  return response.data.data
}

export async function createAdminProduct(
  input: AdminProductCreateInput,
): Promise<AdminProduct> {
  const response = await api.post<DataResponse<AdminProduct>>(
    '/admin/products',
    input,
  )
  return response.data.data
}

export async function updateAdminProduct(
  id: string,
  input: AdminProductUpdateInput,
): Promise<AdminProduct> {
  const response = await api.patch<DataResponse<AdminProduct>>(
    `/admin/products/${encodeURIComponent(id)}`,
    input,
  )
  return response.data.data
}

export async function archiveAdminProduct(id: string): Promise<AdminProduct> {
  const response = await api.delete<DataResponse<AdminProduct>>(
    `/admin/products/${encodeURIComponent(id)}`,
  )
  return response.data.data
}
