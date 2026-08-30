import { z } from 'zod'

export const adminProductQuerySchema = z
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
    status: z.preprocess(
      (value) => (value === undefined || value === '' ? 'all' : value),
      z.enum(['all', 'active', 'archived']),
    ),
    sort: z
      .enum(['newest', 'name-asc', 'name-desc', 'price-asc', 'price-desc'])
      .default('newest'),
  })
  .strict()

export const adminOrderQuerySchema = z
  .object({
    page: z.preprocess(
      (value) => (value === undefined || value === '' ? 1 : value),
      z.coerce.number().int().positive(),
    ),
    limit: z.preprocess(
      (value) => (value === undefined || value === '' ? 20 : value),
      z.coerce.number().int().positive().max(50),
    ),
    search: z.string().trim().min(1).max(120).optional(),
    status: z
      .enum([
        'PENDING',
        'PAID',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
      ])
      .optional(),
  })
  .strict()

export const updateAdminOrderStatusSchema = z
  .object({
    status: z.enum([
      'PENDING',
      'PAID',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ]),
  })
  .strict()

export type AdminProductQuery = z.infer<typeof adminProductQuerySchema>
export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>
export type UpdateAdminOrderStatusInput = z.infer<
  typeof updateAdminOrderStatusSchema
>
