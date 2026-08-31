import { z } from 'zod'

export const productIdParamSchema = z.object({
  productId: z.string().uuid(),
})

export const adminInventoryQuerySchema = z
  .object({
    page: z.preprocess(
      (value) => (value === undefined || value === '' ? 1 : value),
      z.coerce.number().int().positive(),
    ),
    limit: z.preprocess(
      (value) => (value === undefined || value === '' ? 20 : value),
      z.coerce.number().int().positive().max(100),
    ),
    search: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(120).optional(),
    stockStatus: z.preprocess(
      (value) => (value === undefined || value === '' ? 'all' : value),
      z.enum(['all', 'healthy', 'low-stock', 'out-of-stock']),
    ),
    productStatus: z.preprocess(
      (value) => (value === undefined || value === '' ? 'all' : value),
      z.enum(['all', 'active', 'archived']),
    ),
    sort: z
      .enum([
        'name-asc',
        'name-desc',
        'quantity-asc',
        'quantity-desc',
        'updated-desc',
      ])
      .default('updated-desc'),
  })
  .strict()

export const receiveInventorySchema = z
  .object({
    quantity: z.number().int().min(1).max(100_000),
    note: z.string().trim().max(500).optional(),
  })
  .strict()

export const adjustInventorySchema = z
  .object({
    quantityDelta: z
      .number()
      .int()
      .min(-100_000)
      .max(100_000)
      .refine((value) => value !== 0, {
        message: 'quantityDelta cannot be 0',
      }),
    reason: z.string().trim().min(3).max(500),
  })
  .strict()

export const inventorySettingsSchema = z
  .object({
    lowStockThreshold: z.number().int().nonnegative(),
  })
  .strict()

export const inventoryMovementQuerySchema = z
  .object({
    page: z.preprocess(
      (value) => (value === undefined || value === '' ? 1 : value),
      z.coerce.number().int().positive(),
    ),
    limit: z.preprocess(
      (value) => (value === undefined || value === '' ? 20 : value),
      z.coerce.number().int().positive().max(50),
    ),
    type: z
      .enum([
        'INITIAL_STOCK',
        'RECEIPT',
        'ADJUSTMENT',
        'ORDER_PLACED',
        'ORDER_CANCELLED',
      ])
      .optional(),
  })
  .strict()

export type AdminInventoryQuery = z.infer<typeof adminInventoryQuerySchema>
export type ReceiveInventoryInput = z.infer<typeof receiveInventorySchema>
export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>
export type InventorySettingsInput = z.infer<typeof inventorySettingsSchema>
export type InventoryMovementQuery = z.infer<typeof inventoryMovementQuerySchema>
