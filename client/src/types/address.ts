export type Address = {
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
  createdAt: string
  updatedAt: string
}

export type AddressInput = {
  firstName: string
  lastName: string
  addressLine1: string
  addressLine2?: string | null
  suburb: string
  state: string
  postcode: string
  country: string
  phone?: string | null
}

export const emptyAddressInput: AddressInput = {
  firstName: '',
  lastName: '',
  addressLine1: '',
  addressLine2: '',
  suburb: '',
  state: '',
  postcode: '',
  country: 'Australia',
  phone: '',
}
