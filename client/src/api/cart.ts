import { api } from './apiClient.ts'
import type { Cart } from '../types/cart.ts'

type CartResponse = {
  data: Cart
}

export async function getCart(signal?: AbortSignal): Promise<Cart> {
  const response = await api.get<CartResponse>('/cart', { signal })
  return response.data.data
}

export async function addCartItem(
  productId: string,
  quantity: number,
): Promise<Cart> {
  const response = await api.post<CartResponse>('/cart/items', {
    productId,
    quantity,
  })
  return response.data.data
}

export async function updateCartItem(
  itemId: string,
  quantity: number,
): Promise<Cart> {
  const response = await api.patch<CartResponse>(`/cart/items/${itemId}`, {
    quantity,
  })
  return response.data.data
}

export async function removeCartItem(itemId: string): Promise<Cart> {
  const response = await api.delete<CartResponse>(`/cart/items/${itemId}`)
  return response.data.data
}

export async function clearCart(): Promise<Cart> {
  const response = await api.delete<CartResponse>('/cart')
  return response.data.data
}
