import { Prisma } from '@prisma/client'
import type { Cart, CartItem, Category, Inventory, Product } from '@prisma/client'

export type CartProductDto = {
  id: string
  slug: string
  name: string
  sku: string
  price: string
  isActive: boolean
  inStock: boolean
  availableQuantity: number
  category: {
    id: string
    name: string
    slug: string
  }
}

export type CartItemDto = {
  id: string
  quantity: number
  lineTotal: string
  product: CartProductDto
}

export type CartDto = {
  id: string
  items: CartItemDto[]
  summary: {
    itemCount: number
    subtotal: string
  }
}

type CartRecord = Cart & {
  items: Array<
    CartItem & {
      product: Product & {
        category: Category
        inventory: Inventory | null
      }
    }
  >
}

function toMoney(value: Prisma.Decimal): string {
  return value.toFixed(2)
}

export function toCartDto(cart: CartRecord): CartDto {
  let itemCount = 0
  let subtotal = new Prisma.Decimal(0)

  const items = cart.items.map((item) => {
    const availableQuantity = item.product.inventory?.quantity ?? 0
    const lineTotal = item.product.price.mul(item.quantity)
    itemCount += item.quantity
    subtotal = subtotal.plus(lineTotal)

    return {
      id: item.id,
      quantity: item.quantity,
      lineTotal: toMoney(lineTotal),
      product: {
        id: item.product.id,
        slug: item.product.slug,
        name: item.product.name,
        sku: item.product.sku,
        price: toMoney(item.product.price),
        isActive: item.product.isActive,
        inStock: item.product.isActive && availableQuantity > 0,
        availableQuantity,
        category: {
          id: item.product.category.id,
          name: item.product.category.name,
          slug: item.product.category.slug,
        },
      },
    }
  })

  return {
    id: cart.id,
    items,
    summary: {
      itemCount,
      subtotal: toMoney(subtotal),
    },
  }
}
