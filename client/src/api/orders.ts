import { api } from './apiClient.ts'
import type { OrderDetail, OrderListResponse } from '../types/order.ts'

type OrderResponse = {
  data: OrderDetail
}

export async function createOrder(
  addressId: string,
  promotionCode?: string,
): Promise<OrderDetail> {
  const response = await api.post<OrderResponse>('/orders', {
    addressId,
    ...(promotionCode ? { promotionCode } : {}),
  })
  return response.data.data
}

export async function listOrders(
  page = 1,
  limit = 10,
  signal?: AbortSignal,
): Promise<OrderListResponse> {
  const response = await api.get<OrderListResponse>('/orders', {
    params: { page, limit },
    signal,
  })
  return response.data
}

export async function getOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<OrderDetail> {
  const response = await api.get<OrderResponse>(`/orders/${orderId}`, { signal })
  return response.data.data
}
