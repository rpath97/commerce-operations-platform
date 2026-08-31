import type { InventoryMovementType, StockStatus } from '../types/inventory.ts'

const stockLabels: Record<StockStatus, string> = {
  healthy: 'Healthy',
  'low-stock': 'Low stock',
  'out-of-stock': 'Out of stock',
}

const movementLabels: Record<InventoryMovementType, string> = {
  INITIAL_STOCK: 'Initial stock',
  RECEIPT: 'Stock received',
  ADJUSTMENT: 'Manual adjustment',
  ORDER_PLACED: 'Order placed',
  ORDER_CANCELLED: 'Order cancelled',
}

export function formatStockStatus(status: StockStatus): string {
  return stockLabels[status] ?? status
}

export function formatMovementType(type: InventoryMovementType): string {
  return movementLabels[type] ?? type
}

export function formatQuantityDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta)
}
