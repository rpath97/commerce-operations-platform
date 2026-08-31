import type { StockStatus } from '../../types/inventory.ts'
import { formatStockStatus } from '../../lib/inventoryStatus.ts'

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return <span className="chip max-w-full truncate">{formatStockStatus(status)}</span>
}
