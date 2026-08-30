import type { ProductSort } from '../types/catalogue.ts'
import { describePriceRange, parseOptionalMoney } from './moneyInput.ts'

export const PRODUCT_SORTS: readonly ProductSort[] = [
  'newest',
  'price-asc',
  'price-desc',
  'name-asc',
  'name-desc',
]

export const SORT_LABELS: Record<ProductSort, string> = {
  newest: 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  'name-asc': 'Name: A to Z',
  'name-desc': 'Name: Z to A',
}

export type ShopQuery = {
  category?: string
  page: number
  sort: ProductSort
  search?: string
  minPrice?: string
  maxPrice?: string
  inStock?: boolean
}

function isProductSort(value: string): value is ProductSort {
  return (PRODUCT_SORTS as readonly string[]).includes(value)
}

export function parseShopQuery(params: URLSearchParams): ShopQuery {
  const category = params.get('category')?.trim() || undefined
  const search = params.get('search')?.trim() || undefined
  const sortParam = params.get('sort')?.trim() ?? 'newest'
  const pageValue = Number.parseInt(params.get('page') ?? '1', 10)
  const stock = params.get('inStock')?.trim()

  return {
    category,
    search,
    minPrice: parseOptionalMoney(params.get('minPrice')),
    maxPrice: parseOptionalMoney(params.get('maxPrice')),
    inStock: stock === 'true' ? true : stock === 'false' ? false : undefined,
    sort: isProductSort(sortParam) ? sortParam : 'newest',
    page: Number.isInteger(pageValue) && pageValue >= 1 ? pageValue : 1,
  }
}

export function toShopSearchParams(query: ShopQuery): URLSearchParams {
  const params = new URLSearchParams()

  if (query.category) {
    params.set('category', query.category)
  }
  if (query.search) {
    params.set('search', query.search)
  }
  if (query.minPrice) {
    params.set('minPrice', query.minPrice)
  }
  if (query.maxPrice) {
    params.set('maxPrice', query.maxPrice)
  }
  if (query.inStock === true) {
    params.set('inStock', 'true')
  }
  if (query.inStock === false) {
    params.set('inStock', 'false')
  }
  if (query.sort !== 'newest') {
    params.set('sort', query.sort)
  }
  if (query.page > 1) {
    params.set('page', String(query.page))
  }

  return params
}

export function shopPath(query: ShopQuery): string {
  const params = toShopSearchParams(query)
  const queryString = params.toString()
  return queryString.length > 0 ? `/shop?${queryString}` : '/shop'
}

export function hasActiveFilters(query: ShopQuery): boolean {
  return Boolean(
    query.category ||
      query.search ||
      query.minPrice ||
      query.maxPrice ||
      query.inStock !== undefined,
  )
}

export function clearShopFilters(query: ShopQuery): ShopQuery {
  return {
    page: 1,
    sort: query.sort,
    category: undefined,
    search: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    inStock: undefined,
  }
}

export function shopPriceRangeError(query: ShopQuery): string | undefined {
  return describePriceRange(query.minPrice, query.maxPrice)
}
