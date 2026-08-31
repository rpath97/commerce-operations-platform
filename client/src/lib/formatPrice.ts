export function formatAud(price: string): string {
  return `A$${price}`
}

export function formatDiscountAud(amount: string): string {
  return `-A$${amount}`
}
