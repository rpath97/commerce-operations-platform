import type { Address } from '@prisma/client'

export type AddressDto = {
  id: string
  firstName: string
  lastName: string
  addressLine1: string
  addressLine2: string | null
  suburb: string
  state: string
  postcode: string
  country: string
  phone: string | null
  createdAt: Date
  updatedAt: Date
}

export function toAddressDto(address: Address): AddressDto {
  return {
    id: address.id,
    firstName: address.firstName,
    lastName: address.lastName,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    suburb: address.suburb,
    state: address.state,
    postcode: address.postcode,
    country: address.country,
    phone: address.phone,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  }
}
