export type StockStatus = 'healthy' | 'low-stock' | 'out-of-stock'

export type InventoryProductStatus = 'all' | 'active' | 'archived'

export type InventoryStockFilter = 'all' | StockStatus

export type InventorySort =
  | 'name-asc'
  | 'name-desc'
  | 'quantity-asc'
  | 'quantity-desc'
  | 'updated-desc'

export type InventoryMovementType =
  | 'INITIAL_STOCK'
  | 'RECEIPT'
  | 'ADJUSTMENT'
  | 'ORDER_PLACED'
  | 'ORDER_CANCELLED'

export type InventoryState = {
  quantity: number
  lowStockThreshold: number
  inStock: boolean
  isLowStock: boolean
  stockStatus: StockStatus
  updatedAt: string
}

export type InventoryProduct = {
  id: string
  name: string
  slug: string
  sku: string
  isActive: boolean
  category: {
    id: string
    name: string
    slug: string
  }
}

export type InventoryListItem = {
  product: InventoryProduct
  inventory: InventoryState
}

export type InventorySummary = {
  totalProducts: number
  healthy: number
  lowStock: number
  outOfStock: number
  archivedProducts: number
}

export type InventoryListParams = {
  page?: number
  limit?: number
  search?: string
  category?: string
  stockStatus?: InventoryStockFilter
  productStatus?: InventoryProductStatus
  sort?: InventorySort
}

export type InventoryListResponse = {
  data: InventoryListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: InventorySummary
}

export type InventoryMovement = {
  id: string
  type: InventoryMovementType
  quantityDelta: number
  quantityBefore: number
  quantityAfter: number
  note: string | null
  referenceType: string | null
  referenceId: string | null
  createdAt: string
  actor: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
}

export type InventoryDetail = {
  product: InventoryProduct
  inventory: InventoryState
  recentMovements: InventoryMovement[]
}

export type InventoryMovementListResponse = {
  data: InventoryMovement[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
