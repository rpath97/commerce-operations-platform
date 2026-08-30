import { prisma } from '../lib/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AddressBody, UpdateAddressBody } from '../validators/address.validator.js'
import { toAddressDto, type AddressDto } from './address.mapper.js'

export async function listAddresses(userId: string): Promise<AddressDto[]> {
  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return addresses.map(toAddressDto)
}

export async function createAddress(
  userId: string,
  input: AddressBody,
): Promise<AddressDto> {
  const address = await prisma.address.create({
    data: {
      userId,
      ...input,
    },
  })

  return toAddressDto(address)
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: UpdateAddressBody,
): Promise<AddressDto> {
  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId },
  })

  if (!existing) {
    throw new AppError(404, 'Address not found')
  }

  const address = await prisma.address.update({
    where: { id: addressId },
    data: input,
  })

  return toAddressDto(address)
}

export async function deleteAddress(
  userId: string,
  addressId: string,
): Promise<void> {
  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId },
  })

  if (!existing) {
    throw new AppError(404, 'Address not found')
  }

  await prisma.address.delete({
    where: { id: addressId },
  })
}
