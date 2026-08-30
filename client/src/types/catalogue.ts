export type Category = {
  id: string
  name: string
  slug: string
  description: string | null
}

export type CategorySummary = {
  id: string
  name: string
  slug: string
}

export type Inventory = {
  quantity: number
  inStock: boolean
}

export type Product = {
  id: string
  name: string
  slug: string
  description: string
  sku: string
  price: string
  category: CategorySummary
  inventory: Inventory
  createdAt: string
}

export type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type ProductListResponse = {
  data: Product[]
  pagination: Pagination
}

export type ProductSort =
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'name-asc'
  | 'name-desc'

export type ProductListParams = {
  page?: number
  limit?: number
  search?: string
  category?: string
  sort?: ProductSort
}
