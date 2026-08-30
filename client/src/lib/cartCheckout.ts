import type { Cart } from '../types/cart.ts'

export function cartCheckoutBlocked(cart: Cart): boolean {
  if (cart.items.length === 0) {
    return true
  }

  return cart.items.some(
    (item) =>
      !item.product.isActive ||
      item.product.availableQuantity <= 0 ||
      item.quantity > item.product.availableQuantity,
  )
}
