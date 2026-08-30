import { api } from './apiClient.ts'
import type { OrderStatus } from '../types/order.ts'
import type {
  AdminOrderDetail,
  AdminOrderListParams,
  AdminOrderListResponse,
} from '../types/admin.ts'

type DataResponse<T> = {
  data: T
}

export async function listAdminOrders(
  params: AdminOrderListParams = {},
  signal?: AbortSignal,
): Promise<AdminOrderListResponse> {
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

  const response = await api.get<AdminOrderListResponse>('/admin/orders', {
    params: query,
    signal,
  })
  return response.data
}

export async function getAdminOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<AdminOrderDetail> {
  const response = await api.get<DataResponse<AdminOrderDetail>>(
    `/admin/orders/${encodeURIComponent(orderId)}`,
    { signal },
  )
  return response.data.data
}

export async function updateAdminOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<AdminOrderDetail> {
  const response = await api.patch<DataResponse<AdminOrderDetail>>(
    `/admin/orders/${encodeURIComponent(orderId)}/status`,
    { status },
  )
  return response.data.data
}
