import { z } from 'zod'

const uuidParam = z.string().uuid()

export const idParamSchema = z.object({
  id: uuidParam,
})

export const slugParamSchema = z.object({
  slug: z.string().trim().min(1).max(120),
})

const moneyPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/

function moneyToCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
}

export const moneyAmountSchema = z
  .union([z.number(), z.string()])
  .refine((value) => Number.isFinite(value) || typeof value === 'string', {
    message: 'Amount must be a non-negative decimal with at most 2 decimal places',
  })
  .transform((value) => (typeof value === 'number' ? String(value) : value.trim()))
  .refine((value) => moneyPattern.test(value), {
    message: 'Amount must be a non-negative decimal with at most 2 decimal places',
  })

const optionalQueryMoney = z.preprocess(
  (value) => (value === undefined || value === '' ? undefined : value),
  moneyAmountSchema.optional(),
)

export const productQuerySchema = z
  .object({
    page: z.preprocess(
      (value) => (value === undefined || value === '' ? 1 : value),
      z.coerce.number().int().positive(),
    ),
    limit: z.preprocess(
      (value) => (value === undefined || value === '' ? 12 : value),
      z.coerce.number().int().positive().max(100),
    ),
    search: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(120).optional(),
    minPrice: optionalQueryMoney,
    maxPrice: optionalQueryMoney,
    inStock: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    sort: z
      .enum(['newest', 'price-asc', 'price-desc', 'name-asc', 'name-desc'])
      .default('newest'),
  })
  .strict()
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      moneyToCents(value.minPrice) <= moneyToCents(value.maxPrice),
    {
      message: 'minPrice cannot be greater than maxPrice',
      path: ['minPrice'],
    },
  )

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).optional().nullable(),
  })
  .strict()

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export const createProductSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(4000),
    sku: z.string().trim().min(1).max(64),
    price: moneyAmountSchema,
    categoryId: z.string().uuid(),
    initialInventoryQuantity: z.number().int().nonnegative().default(0),
    lowStockThreshold: z.number().int().nonnegative().default(5),
    isActive: z.boolean().default(true),
  })
  .strict()

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    slug: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
    sku: z.string().trim().min(1).max(64).optional(),
    price: moneyAmountSchema.optional(),
    categoryId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export const updateInventorySchema = z
  .object({
    quantity: z.number().int().nonnegative().optional(),
    lowStockThreshold: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export type ProductQuery = z.infer<typeof productQuerySchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>
