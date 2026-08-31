import { z } from 'zod'
import { moneyAmountSchema } from './catalog.validator.js'

const isoDateSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Must be a valid ISO date',
  })
  .transform((value) => new Date(value))

const promotionCodeInputSchema = z
  .string()
  .min(1)
  .max(64)
  .transform((value) => value.trim().toUpperCase())
  .refine((value) => /^[A-Z0-9_-]{3,32}$/.test(value), {
    message:
      'Promotion code must be 3–32 characters using letters, numbers, hyphen, or underscore.',
  })

export const promotionIdParamSchema = z.object({
  promotionId: z.string().uuid(),
})

export const adminPromotionQuerySchema = z
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
    status: z.preprocess(
      (value) => (value === undefined || value === '' ? 'all' : value),
      z.enum(['all', 'active', 'upcoming', 'expired', 'disabled']),
    ),
    discountType: z.preprocess(
      (value) => (value === undefined || value === '' ? 'all' : value),
      z.enum(['all', 'percentage', 'fixed']),
    ),
    sort: z
      .enum([
        'newest',
        'code-asc',
        'code-desc',
        'starts-soonest',
        'ends-soonest',
      ])
      .default('newest'),
  })
  .strict()

export const createPromotionSchema = z
  .object({
    code: promotionCodeInputSchema,
    description: z.string().trim().max(500).optional().nullable(),
    discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
    discountValue: moneyAmountSchema,
    minimumOrderValue: moneyAmountSchema.optional().nullable(),
    startsAt: isoDateSchema,
    endsAt: isoDateSchema,
    isActive: z.boolean(),
  })
  .strict()

export const updatePromotionSchema = z
  .object({
    code: promotionCodeInputSchema.optional(),
    description: z.string().trim().max(500).optional().nullable(),
    discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
    discountValue: moneyAmountSchema.optional(),
    minimumOrderValue: moneyAmountSchema.optional().nullable(),
    startsAt: isoDateSchema.optional(),
    endsAt: isoDateSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export const validatePromotionSchema = z
  .object({
    code: promotionCodeInputSchema,
  })
  .strict()

export type AdminPromotionQuery = z.infer<typeof adminPromotionQuerySchema>
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>
export type ValidatePromotionInput = z.infer<typeof validatePromotionSchema>
