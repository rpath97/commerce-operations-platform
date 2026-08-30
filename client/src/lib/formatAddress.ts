import type { Address } from '../types/address.ts'
import type { OrderShippingAddress } from '../types/order.ts'

export function formatAddressLines(
  address: Address | OrderShippingAddress,
): string[] {
  const lines = [
    `${address.firstName} ${address.lastName}`.trim(),
    address.addressLine1,
  ]

  if (address.addressLine2) {
    lines.push(address.addressLine2)
  }

  lines.push(`${address.suburb} ${address.state} ${address.postcode}`.trim())
  lines.push(address.country)

  if (address.phone) {
    lines.push(address.phone)
  }

  return lines.filter((line) => line.length > 0)
}
