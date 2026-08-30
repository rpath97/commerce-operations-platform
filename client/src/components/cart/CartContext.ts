import { createContext } from 'react'
import type { Cart } from '../../types/cart.ts'

export type CartStatus = 'idle' | 'loading' | 'ready' | 'error'

export type CartContextValue = {
  cart: Cart
  status: CartStatus
  notice: string | null
  error: string | null
  pendingKeys: string[]
  itemCount: number
  refreshCart: () => Promise<void>
  addItem: (productId: string, quantity: number) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  clearItems: () => Promise<void>
}

export const CartContext = createContext<CartContextValue | undefined>(
  undefined,
)
