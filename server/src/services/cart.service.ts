import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AddCartItemInput, UpdateCartItemInput } from '../validators/cart.validator.js'
import { toCartDto, type CartDto } from './cart.mapper.js'

// Cart validates current stock but does not reserve or decrement inventory.
// Checkout and order creation must revalidate availability.

type Tx = Prisma.TransactionClient

const cartInclude = {
  items: {
    include: {
      product: {
        include: {
          category: true,
          inventory: true,
        },
      },
    },
    orderBy: { product: { name: 'asc' as const } },
  },
} satisfies Prisma.CartInclude

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

async function getOrCreateCart(tx: Tx, userId: string) {
  return tx.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })
}

async function loadCartDto(tx: Tx, userId: string): Promise<CartDto> {
  const cart = await tx.cart.findUnique({
    where: { userId },
    include: cartInclude,
  })

  if (!cart) {
    const created = await getOrCreateCart(tx, userId)
    return {
      id: created.id,
      items: [],
      summary: {
        itemCount: 0,
        subtotal: '0.00',
      },
    }
  }

  return toCartDto(cart)
}

function availableQuantity(
  inventory: { quantity: number } | null | undefined,
): number {
  return inventory?.quantity ?? 0
}

function assertCanPurchase(options: {
  isActive: boolean
  available: number
  nextQuantity: number
}): void {
  if (!options.isActive) {
    throw new AppError(409, 'Product is no longer available')
  }

  if (options.available <= 0) {
    throw new AppError(409, 'Product is out of stock')
  }

  if (options.nextQuantity > options.available) {
    throw new AppError(409, 'Requested quantity exceeds available stock')
  }
}

export async function getCartForUser(userId: string): Promise<CartDto> {
  return prisma.$transaction(async (tx) => {
    await getOrCreateCart(tx, userId)
    return loadCartDto(tx, userId)
  })
}

export async function addCartItem(
  userId: string,
  input: AddCartItemInput,
): Promise<CartDto> {
  return prisma.$transaction(async (tx) => {
    const cart = await getOrCreateCart(tx, userId)
    const product = await tx.product.findUnique({
      where: { id: input.productId },
      include: { inventory: true },
    })

    if (!product) {
      throw new AppError(404, 'Product not found')
    }

    const existing = await tx.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: input.productId,
        },
      },
    })
    const nextQuantity = (existing?.quantity ?? 0) + input.quantity
    const available = availableQuantity(product.inventory)

    assertCanPurchase({
      isActive: product.isActive,
      available,
      nextQuantity,
    })

    if (existing) {
      await tx.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQuantity },
      })
    } else {
      try {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId: input.productId,
            quantity: input.quantity,
          },
        })
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error
        }

        const raced = await tx.cartItem.findUnique({
          where: {
            cartId_productId: {
              cartId: cart.id,
              productId: input.productId,
            },
          },
        })

        if (!raced) {
          throw error
        }

        const racedNext = raced.quantity + input.quantity
        assertCanPurchase({
          isActive: product.isActive,
          available,
          nextQuantity: racedNext,
        })

        await tx.cartItem.update({
          where: { id: raced.id },
          data: { quantity: racedNext },
        })
      }
    }

    return loadCartDto(tx, userId)
  })
}

export async function updateCartItem(
  userId: string,
  itemId: string,
  input: UpdateCartItemInput,
): Promise<CartDto> {
  return prisma.$transaction(async (tx) => {
    await getOrCreateCart(tx, userId)

    const item = await tx.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
      include: {
        product: {
          include: { inventory: true },
        },
      },
    })

    if (!item) {
      throw new AppError(404, 'Cart item not found')
    }

    assertCanPurchase({
      isActive: item.product.isActive,
      available: availableQuantity(item.product.inventory),
      nextQuantity: input.quantity,
    })

    await tx.cartItem.update({
      where: { id: item.id },
      data: { quantity: input.quantity },
    })

    return loadCartDto(tx, userId)
  })
}

export async function removeCartItem(
  userId: string,
  itemId: string,
): Promise<CartDto> {
  return prisma.$transaction(async (tx) => {
    await getOrCreateCart(tx, userId)

    const item = await tx.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
    })

    if (!item) {
      throw new AppError(404, 'Cart item not found')
    }

    await tx.cartItem.delete({
      where: { id: item.id },
    })

    return loadCartDto(tx, userId)
  })
}

export async function clearCart(userId: string): Promise<CartDto> {
  return prisma.$transaction(async (tx) => {
    const cart = await getOrCreateCart(tx, userId)

    await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    })

    return loadCartDto(tx, userId)
  })
}
