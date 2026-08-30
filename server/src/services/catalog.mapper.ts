import { Prisma } from '@prisma/client'
import type { Category, Inventory, Product } from '@prisma/client'

type PublicCategory = {
  id: string
  name: string
  slug: string
  description: string | null
}

type PublicInventory = {
  quantity: number
  inStock: boolean
}

type PublicCategorySummary = {
  id: string
  name: string
  slug: string
}

export type PublicProduct = {
  id: string
  name: string
  slug: string
  description: string
  sku: string
  price: string
  category: PublicCategorySummary
  inventory: PublicInventory
  createdAt: Date
}

export type AdminProduct = PublicProduct & {
  isActive: boolean
  inventory: PublicInventory & {
    lowStockThreshold: number
  }
}

export function toPublicCategory(category: Category): PublicCategory {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
  }
}

function toMoney(value: Prisma.Decimal): string {
  return value.toFixed(2)
}

function toPublicInventory(inventory: Inventory | null): PublicInventory {
  const quantity = inventory?.quantity ?? 0
  return {
    quantity,
    inStock: quantity > 0,
  }
}

export function toPublicProduct(
  product: Product & { category: Category; inventory: Inventory | null },
): PublicProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    sku: product.sku,
    price: toMoney(product.price),
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    },
    inventory: toPublicInventory(product.inventory),
    createdAt: product.createdAt,
  }
}

export function toAdminProduct(
  product: Product & { category: Category; inventory: Inventory | null },
): AdminProduct {
  return {
    ...toPublicProduct(product),
    isActive: product.isActive,
    inventory: {
      ...toPublicInventory(product.inventory),
      lowStockThreshold: product.inventory?.lowStockThreshold ?? 5,
    },
  }
}
