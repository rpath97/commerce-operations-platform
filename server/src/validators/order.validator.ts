import { z } from 'zod'

const optionalPromotionCodeSchema = z.preprocess(
  (value) => (value === undefined || value === null || value === '' ? undefined : value),
  z
    .string()
    .min(1)
    .max(64)
    .transform((value) => value.trim().toUpperCase())
    .refine((value) => /^[A-Z0-9_-]{3,32}$/.test(value), {
      message:
        'Promotion code must be 3–32 characters using letters, numbers, hyphen, or underscore.',
    })
    .optional(),
)

export const createOrderSchema = z
  .object({
    addressId: z.string().uuid(),
    promotionCode: optionalPromotionCodeSchema,
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
