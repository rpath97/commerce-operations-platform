import type { OrderStatus } from './order.ts'

export type AdminDashboardCounts = {
  customers: number
  activeProducts: number
  archivedProducts: number
  categories: number
  totalOrders: number
  openOrders: number
  lowStockProducts: number
}

export type AdminDashboardRecentOrder = {
  id: string
  orderNumber: string
  status: OrderStatus
  createdAt: string
  customer: {
    firstName: string
    lastName: string
    email: string
  }
  itemCount: number
  total: string
}

export type AdminDashboard = {
  counts: AdminDashboardCounts
  recentOrders: AdminDashboardRecentOrder[]
}

export type AdminInventory = {
  quantity: number
  inStock: boolean
  lowStockThreshold: number
  isLowStock: boolean
}

export type AdminProduct = {
  id: string
  name: string
  slug: string
  description: string
  sku: string
  price: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  category: {
    id: string
    name: string
    slug: string
  }
  inventory: AdminInventory
}

export type AdminProductStatusFilter = 'all' | 'active' | 'archived'

export type AdminProductSort =
  | 'newest'
  | 'name-asc'
  | 'name-desc'
  | 'price-asc'
  | 'price-desc'

export type AdminProductListParams = {
  page?: number
  limit?: number
  search?: string
  category?: string
  status?: AdminProductStatusFilter
  sort?: AdminProductSort
}

export type AdminProductListResponse = {
  data: AdminProduct[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type AdminProductCreateInput = {
  name: string
  slug: string
  description: string
  sku: string
  price: string
  categoryId: string
  initialInventoryQuantity: number
  lowStockThreshold: number
  isActive: boolean
}

export type AdminProductUpdateInput = {
  name?: string
  slug?: string
  description?: string
  sku?: string
  price?: string
  categoryId?: string
  isActive?: boolean
}

export type AdminCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  createdAt: string
  updatedAt: string
  productCount: number
}

export type AdminCategoryInput = {
  name: string
  slug: string
  description?: string | null
}

export type AdminOrderCustomer = {
  id: string
  firstName: string
  lastName: string
  email: string
}

export type AdminOrderSummary = {
  id: string
  orderNumber: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  customer: AdminOrderCustomer
  itemCount: number
  total: string
}

export type AdminOrderDetail = {
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
  customer: AdminOrderCustomer
  shippingAddress: {
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
  items: Array<{
    id: string
    productId: string | null
    productName: string
    sku: string
    unitPrice: string
    quantity: number
    lineTotal: string
  }>
}

export type AdminOrderListParams = {
  page?: number
  limit?: number
  search?: string
  status?: OrderStatus
}

export type AdminOrderListResponse = {
  data: AdminOrderSummary[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
