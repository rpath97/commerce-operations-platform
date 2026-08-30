import type { Request, Response } from 'express'
import { requireUserId } from '../lib/request-auth.js'
import {
  createOrderFromCart,
  getOrderForUser,
  listOrdersForUser,
} from '../services/order.service.js'
import {
  createOrderSchema,
  orderIdParamSchema,
  orderListQuerySchema,
} from '../validators/order.validator.js'
import { parseInput } from '../validators/parse.js'

export async function createOrderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { addressId } = parseInput(createOrderSchema, req.body)
  const data = await createOrderFromCart(requireUserId(req), addressId)
  res.status(201).json({ data })
}

export async function listOrdersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseInput(orderListQuerySchema, req.query)
  const result = await listOrdersForUser(requireUserId(req), query)
  res.status(200).json(result)
}

export async function getOrderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { orderId } = parseInput(orderIdParamSchema, req.params)
  const data = await getOrderForUser(requireUserId(req), orderId)
  res.status(200).json({ data })
}
