import type { OrderStatus } from './order.ts'

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all'

export type AnalyticsPeriod = {
  range: AnalyticsRange
  from: string | null
  to: string
  generatedAt: string
}

export type AnalyticsSummary = {
  totalOrders: number
  nonCancelledOrders: number
  cancelledOrders: number
  deliveredOrders: number
  openOrders: number
  nonCancelledOrderValue: string
  averageOrderValue: string
  discountValue: string
  unitsOrdered: number
  promotedOrders: number
  newCustomers: number
}

export type OrdersByDay = {
  date: string
  totalOrders: number
  nonCancelledOrders: number
  cancelledOrders: number
  nonCancelledOrderValue: string
}

export type StatusDistribution = {
  status: OrderStatus
  count: number
}

export type AnalyticsTopProduct = {
  productName: string
  sku: string
  unitsOrdered: number
  orderCount: number
  orderValue: string
}

export type PromotionPerformance = {
  code: string
  orderCount: number
  orderValue: string
  discountValue: string
}

export type CustomersByDay = {
  date: string
  newCustomers: number
}

export type InventorySnapshot = {
  activeProducts: number
  totalUnits: number
  healthyProducts: number
  lowStockProducts: number
  outOfStockProducts: number
}

export type AdminAnalytics = {
  period: AnalyticsPeriod
  summary: AnalyticsSummary
  ordersByDay: OrdersByDay[]
  statusDistribution: StatusDistribution[]
  topProducts: AnalyticsTopProduct[]
  promotionPerformance: PromotionPerformance[]
  customersByDay: CustomersByDay[]
  inventorySnapshot: InventorySnapshot
}
