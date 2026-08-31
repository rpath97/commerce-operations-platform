import { z } from 'zod'

export const analyticsQuerySchema = z
  .object({
    range: z.preprocess(
      (value) => (value === undefined || value === '' ? '30d' : value),
      z.enum(['7d', '30d', '90d', 'all']),
    ),
  })
  .strict()

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
