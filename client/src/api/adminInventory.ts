import { api } from './apiClient.ts'
import type {
  InventoryDetail,
  InventoryListParams,
  InventoryListResponse,
  InventoryMovementListResponse,
  InventoryMovementType,
  InventoryState,
} from '../types/inventory.ts'

type DataResponse<T> = {
  data: T
}

export async function listAdminInventory(
  params: InventoryListParams = {},
  signal?: AbortSignal,
): Promise<InventoryListResponse> {
  const query: Record<string, string | number> = {}
  if (params.page !== undefined) query.page = params.page
  if (params.limit !== undefined) query.limit = params.limit
  if (params.search) query.search = params.search
  if (params.category) query.category = params.category
  if (params.stockStatus) query.stockStatus = params.stockStatus
  if (params.productStatus) query.productStatus = params.productStatus
  if (params.sort) query.sort = params.sort

  const response = await api.get<InventoryListResponse>('/admin/inventory', {
    params: query,
    signal,
  })
  return response.data
}

export async function getAdminInventory(
  productId: string,
  signal?: AbortSignal,
): Promise<InventoryDetail> {
  const response = await api.get<DataResponse<InventoryDetail>>(
    `/admin/inventory/${encodeURIComponent(productId)}`,
    { signal },
  )
  return response.data.data
}

export async function receiveAdminInventory(
  productId: string,
  input: { quantity: number; note?: string },
): Promise<InventoryState> {
  const response = await api.post<DataResponse<InventoryState>>(
    `/admin/inventory/${encodeURIComponent(productId)}/receive`,
    input,
  )
  return response.data.data
}

export async function adjustAdminInventory(
  productId: string,
  input: { quantityDelta: number; reason: string },
): Promise<InventoryState> {
  const response = await api.post<DataResponse<InventoryState>>(
    `/admin/inventory/${encodeURIComponent(productId)}/adjust`,
    input,
  )
  return response.data.data
}

export async function updateInventorySettings(
  productId: string,
  lowStockThreshold: number,
): Promise<InventoryState> {
  const response = await api.patch<DataResponse<InventoryState>>(
    `/admin/inventory/${encodeURIComponent(productId)}/settings`,
    { lowStockThreshold },
  )
  return response.data.data
}

export async function listInventoryMovements(
  productId: string,
  params: { page?: number; limit?: number; type?: InventoryMovementType } = {},
  signal?: AbortSignal,
): Promise<InventoryMovementListResponse> {
  const query: Record<string, string | number> = {}
  if (params.page !== undefined) query.page = params.page
  if (params.limit !== undefined) query.limit = params.limit
  if (params.type) query.type = params.type

  const response = await api.get<InventoryMovementListResponse>(
    `/admin/inventory/${encodeURIComponent(productId)}/movements`,
    { params: query, signal },
  )
  return response.data
}
