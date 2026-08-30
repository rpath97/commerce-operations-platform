import type { Request, Response } from 'express'
import { requireUserId } from '../lib/request-auth.js'
import {
  getAdminOrder,
  listAdminOrders,
  updateAdminOrderStatus,
} from '../services/admin-order.service.js'
import {
  adminOrderQuerySchema,
  updateAdminOrderStatusSchema,
} from '../validators/admin.validator.js'
import { orderIdParamSchema } from '../validators/order.validator.js'
import { parseInput } from '../validators/parse.js'

export async function listAdminOrdersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseInput(adminOrderQuerySchema, req.query)
  const result = await listAdminOrders(query)
  res.status(200).json(result)
}

export async function getAdminOrderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { orderId } = parseInput(orderIdParamSchema, req.params)
  const data = await getAdminOrder(orderId)
  res.status(200).json({ data })
}

export async function updateAdminOrderStatusHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { orderId } = parseInput(orderIdParamSchema, req.params)
  const { status } = parseInput(updateAdminOrderStatusSchema, req.body)
  const data = await updateAdminOrderStatus(
    orderId,
    status,
    requireUserId(req),
  )
  res.status(200).json({ data })
}
