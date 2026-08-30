export type CartProduct = {
  id: string
  slug: string
  name: string
  sku: string
  price: string
  isActive: boolean
  inStock: boolean
  availableQuantity: number
  category: {
    id: string
    name: string
    slug: string
  }
}

export type CartItem = {
  id: string
  quantity: number
  lineTotal: string
  product: CartProduct
}

export type Cart = {
  id: string | null
  items: CartItem[]
  summary: {
    itemCount: number
    subtotal: string
  }
}

export const emptyCart: Cart = {
  id: null,
  items: [],
  summary: {
    itemCount: 0,
    subtotal: '0.00',
  },
}
