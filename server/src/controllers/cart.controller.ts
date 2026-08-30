import type { Request, Response } from 'express'
import { AppError } from '../middleware/errorHandler.js'
import {
  addCartItem,
  clearCart,
  getCartForUser,
  removeCartItem,
  updateCartItem,
} from '../services/cart.service.js'
import {
  addCartItemSchema,
  cartItemIdParamSchema,
  updateCartItemSchema,
} from '../validators/cart.validator.js'
import { parseInput } from '../validators/parse.js'

function requireUserId(req: Request): string {
  if (!req.auth) {
    throw new AppError(401, 'Authentication required')
  }

  return req.auth.id
}

export async function getCartHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const data = await getCartForUser(requireUserId(req))
  res.status(200).json({ data })
}

export async function addCartItemHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = parseInput(addCartItemSchema, req.body)
  const data = await addCartItem(requireUserId(req), input)
  res.status(200).json({ data })
}

export async function updateCartItemHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { itemId } = parseInput(cartItemIdParamSchema, req.params)
  const input = parseInput(updateCartItemSchema, req.body)
  const data = await updateCartItem(requireUserId(req), itemId, input)
  res.status(200).json({ data })
}

export async function removeCartItemHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { itemId } = parseInput(cartItemIdParamSchema, req.params)
  const data = await removeCartItem(requireUserId(req), itemId)
  res.status(200).json({ data })
}

export async function clearCartHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const data = await clearCart(requireUserId(req))
  res.status(200).json({ data })
}
