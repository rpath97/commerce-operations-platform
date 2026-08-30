import { z } from 'zod'

export const addCartItemSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })
  .strict()

export const updateCartItemSchema = z
  .object({
    quantity: z.number().int().positive(),
  })
  .strict()

export const cartItemIdParamSchema = z.object({
  itemId: z.string().uuid(),
})

export type AddCartItemInput = z.infer<typeof addCartItemSchema>
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>
