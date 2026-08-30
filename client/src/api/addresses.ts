import { api } from './apiClient.ts'
import type { Address, AddressInput } from '../types/address.ts'

type AddressResponse = {
  data: Address
}

type AddressListResponse = {
  data: Address[]
}

export async function listAddresses(signal?: AbortSignal): Promise<Address[]> {
  const response = await api.get<AddressListResponse>('/addresses', { signal })
  return response.data.data
}

export async function createAddress(input: AddressInput): Promise<Address> {
  const response = await api.post<AddressResponse>('/addresses', input)
  return response.data.data
}

export async function updateAddress(
  addressId: string,
  input: Partial<AddressInput>,
): Promise<Address> {
  const response = await api.patch<AddressResponse>(
    `/addresses/${addressId}`,
    input,
  )
  return response.data.data
}

export async function deleteAddress(addressId: string): Promise<void> {
  await api.delete(`/addresses/${addressId}`)
}
