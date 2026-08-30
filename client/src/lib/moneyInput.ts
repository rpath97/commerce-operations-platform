export const MONEY_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/

export function moneyToCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
}

export function parseOptionalMoney(raw: string | null): string | undefined {
  const value = raw?.trim()
  if (!value) {
    return undefined
  }
  return MONEY_PATTERN.test(value) ? value : undefined
}

export function describeMoneyInput(raw: string): string | undefined {
  const value = raw.trim()
  if (value.length === 0) {
    return undefined
  }
  if (value.startsWith('-')) {
    return 'Price cannot be negative'
  }
  if (!MONEY_PATTERN.test(value)) {
    return 'Enter a whole number or up to 2 decimal places'
  }
  return undefined
}

export function describePriceRange(
  minPrice?: string,
  maxPrice?: string,
): string | undefined {
  if (!minPrice || !maxPrice) {
    return undefined
  }
  if (moneyToCents(minPrice) > moneyToCents(maxPrice)) {
    return 'Minimum price cannot be greater than maximum price'
  }
  return undefined
}
