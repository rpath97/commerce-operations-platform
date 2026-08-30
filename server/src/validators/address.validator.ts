import { z } from 'zod'

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => {
      if (value === undefined || value === null || value === '') {
        return null
      }
      return value
    })
}

export const addressBodySchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    addressLine1: z.string().trim().min(1).max(200),
    addressLine2: optionalText(200),
    suburb: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    postcode: z.string().trim().min(1).max(20),
    country: z.string().trim().min(1).max(100),
    phone: optionalText(40),
  })
  .strict()

export const updateAddressBodySchema = addressBodySchema.partial().strict()

export const addressIdParamSchema = z.object({
  addressId: z.string().uuid(),
})

export type AddressBody = z.infer<typeof addressBodySchema>
export type UpdateAddressBody = z.infer<typeof updateAddressBodySchema>
