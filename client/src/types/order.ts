export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

export type OrderShippingAddress = {
  firstName: string
  lastName: string
  addressLine1: string
  addressLine2: string | null
  suburb: string
  state: string
  postcode: string
  country: string
  phone: string | null
}

export type OrderItem = {
  id: string
  productId: string | null
  productName: string
  sku: string
  unitPrice: string
  quantity: number
  lineTotal: string
}

export type OrderSummary = {
  id: string
  orderNumber: string
  status: OrderStatus
  createdAt: string
  itemCount: number
  total: string
}

export type OrderDetail = {
  id: string
  orderNumber: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  subtotal: string
  discountAmount: string
  shippingAmount: string
  total: string
  promotionCode: string | null
  shippingAddress: OrderShippingAddress
  items: OrderItem[]
}

export type OrderListResponse = {
  data: OrderSummary[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
