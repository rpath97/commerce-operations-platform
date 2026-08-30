import { z } from 'zod'

export const createOrderSchema = z
  .object({
    addressId: z.string().uuid(),
  })
  .strict()

export const orderIdParamSchema = z.object({
  orderId: z.string().uuid(),
})

export const orderListQuerySchema = z
  .object({
    page: z.preprocess(
      (value) => (value === undefined || value === '' ? 1 : value),
      z.coerce.number().int().positive(),
    ),
    limit: z.preprocess(
      (value) => (value === undefined || value === '' ? 10 : value),
      z.coerce.number().int().positive().max(50),
    ),
  })
  .strict()

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type OrderListQuery = z.infer<typeof orderListQuerySchema>
