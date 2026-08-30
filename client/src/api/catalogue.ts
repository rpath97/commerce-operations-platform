import { api } from './apiClient.ts'
import type {
  Category,
  Product,
  ProductListParams,
  ProductListResponse,
} from '../types/catalogue.ts'

type DataResponse<T> = {
  data: T
}

export async function listCategories(signal?: AbortSignal): Promise<Category[]> {
  const response = await api.get<DataResponse<Category[]>>('/categories', {
    signal,
  })
  return response.data.data
}

export async function getCategoryBySlug(
  slug: string,
  signal?: AbortSignal,
): Promise<Category> {
  const response = await api.get<DataResponse<Category>>(
    `/categories/${encodeURIComponent(slug)}`,
    { signal },
  )
  return response.data.data
}

export async function listProducts(
  params: ProductListParams = {},
  signal?: AbortSignal,
): Promise<ProductListResponse> {
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
  if (params.category) {
    query.category = params.category
  }
  if (params.sort) {
    query.sort = params.sort
  }
  if (params.minPrice) {
    query.minPrice = params.minPrice
  }
  if (params.maxPrice) {
    query.maxPrice = params.maxPrice
  }
  if (params.inStock === true) {
    query.inStock = 'true'
  }
  if (params.inStock === false) {
    query.inStock = 'false'
  }

  const response = await api.get<ProductListResponse>('/products', {
    signal,
    params: query,
  })
  return response.data
}

export async function getProductBySlug(
  slug: string,
  signal?: AbortSignal,
): Promise<Product> {
  const response = await api.get<DataResponse<Product>>(
    `/products/${encodeURIComponent(slug)}`,
    { signal },
  )
  return response.data.data
}
